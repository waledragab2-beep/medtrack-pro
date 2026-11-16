import type { PoolClient } from 'pg';
import { config } from '../config.js';
import { many, pool, withTx } from '../db/pool.js';
import { readNotificationSettings } from '../lib/settings.js';
import { getProvider } from './providers/index.js';
import type { PushMessage, ProviderName } from './types.js';

export const MAX_ATTEMPTS = 6;
/** Back-off schedule in seconds, indexed by attempt number. */
const BACKOFF = [0, 3, 10, 30, 90, 300];

/**
 * Queue one notification per linked device that has a push channel.
 * Runs inside the caller's transaction so the order update and the outbox rows commit together.
 * `dedupe_key` makes the "ready" alert impossible to send twice to the same device.
 */
export async function enqueueForOrder(
  db: PoolClient,
  orderId: string,
  kind: 'ready' | 'reminder',
  sequence = 0,
): Promise<number> {
  const res = await db.query(
    `INSERT INTO notifications (brand_id, order_id, device_id, kind, dedupe_key, provider)
     SELECT d.brand_id, d.order_id, d.id, $2::text::notification_kind,
            $2::text || ':' || d.id || CASE WHEN $3::int > 0 THEN ':' || $3 ELSE '' END,
            d.push_provider
       FROM order_devices d
      WHERE d.order_id = $1 AND d.revoked_at IS NULL AND d.push_provider IS NOT NULL
     ON CONFLICT (dedupe_key) DO NOTHING`,
    [orderId, kind, sequence],
  );
  return res.rowCount ?? 0;
}

interface Job {
  id: string;
  order_id: string;
  kind: 'ready' | 'reminder';
  provider: ProviderName;
  attempts: number;
  device_id: string;
  platform: 'web' | 'android' | 'ios';
  locale: string;
  push_token: string | null;
  push_subscription: unknown;
  order_number: string;
  order_status: string;
  brand_name: string;
  brand_name_en: string | null;
  notification_settings: unknown;
}

function buildMessage(job: Job): PushMessage {
  const s = readNotificationSettings(job.notification_settings);
  const en = job.locale.startsWith('en');
  const brand = en ? job.brand_name_en || job.brand_name : job.brand_name;
  const title = en ? `${brand} • Order #${job.order_number}` : `${brand} • طلب #${job.order_number}`;
  const body =
    job.kind === 'ready'
      ? en ? s.readyBodyEn : s.readyBodyAr
      : en
        ? `⏰ Reminder: order #${job.order_number} is waiting for you at the counter`
        : `⏰ تذكير: طلبك رقم #${job.order_number} في انتظارك عند الكاونتر`;
  return {
    notificationId: job.id,
    orderId: job.order_id,
    kind: job.kind,
    title,
    body,
    url: `${config.PUBLIC_WEB_URL}/o/${job.order_id}`,
  };
}

/** Lease a batch (SKIP LOCKED → safe with several API instances), send, record the outcome. */
export async function processOutboxBatch(limit = 25): Promise<number> {
  const jobs = await withTx(async (c) => {
    const { rows } = await c.query<Job>(
      `SELECT n.id, n.order_id, n.kind, n.provider, n.attempts, n.device_id,
              d.platform, d.locale, d.push_token, d.push_subscription,
              o.order_number, o.status AS order_status,
              b.name AS brand_name, b.name_en AS brand_name_en, b.notification_settings
         FROM notifications n
         JOIN order_devices d ON d.id = n.device_id
         JOIN orders o ON o.id = n.order_id
         JOIN brands b ON b.id = n.brand_id
        WHERE n.status = 'pending' AND n.next_attempt_at <= now()
        ORDER BY n.next_attempt_at
        LIMIT $1
        FOR UPDATE OF n SKIP LOCKED`,
      [limit],
    );
    if (rows.length) {
      // Lease: if this process dies mid-send another worker retries after 60s.
      await c.query(
        `UPDATE notifications SET attempts = attempts + 1, next_attempt_at = now() + interval '60 seconds'
          WHERE id = ANY($1::uuid[])`,
        [rows.map((r) => r.id)],
      );
    }
    return rows;
  });

  await Promise.all(jobs.map(sendOne));
  return jobs.length;
}

async function sendOne(job: Job): Promise<void> {
  const attempt = job.attempts + 1;
  if (job.order_status !== 'ready') {
    await pool.query(`UPDATE notifications SET status = 'canceled', last_error = 'order_not_ready' WHERE id = $1`, [job.id]);
    return;
  }
  const provider = getProvider(job.provider);
  if (!provider.isConfigured()) {
    await fail(job, attempt, false, `${job.provider}_not_configured`);
    return;
  }
  const result = await provider
    .send({ token: job.push_token, subscription: job.push_subscription, platform: job.platform }, buildMessage(job))
    .catch((e: Error) => ({ ok: false as const, permanent: false, error: e.message }));

  if (result.ok) {
    await pool.query(
      `UPDATE notifications SET status = 'sent', sent_at = now(), provider_msg_id = $2, last_error = NULL WHERE id = $1`,
      [job.id, result.messageId ?? null],
    );
    return;
  }
  await fail(job, attempt, result.permanent, result.error);
}

async function fail(job: Job, attempt: number, permanent: boolean, error: string) {
  if (permanent || attempt >= MAX_ATTEMPTS) {
    await pool.query(`UPDATE notifications SET status = 'failed', last_error = $2 WHERE id = $1`, [job.id, error]);
    if (permanent) {
      // Token is dead: stop targeting it (the open page still gets realtime updates).
      await pool.query(
        `UPDATE order_devices SET push_provider = NULL, push_token = NULL, push_subscription = NULL WHERE id = $1`,
        [job.device_id],
      );
    }
    return;
  }
  const delay = BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
  await pool.query(
    `UPDATE notifications SET last_error = $2, next_attempt_at = now() + make_interval(secs => $3) WHERE id = $1`,
    [job.id, error, delay],
  );
}

/** Orders still waiting at the counter → automatic reminder (per brand settings). */
export async function scheduleAutoReminders(): Promise<number> {
  const due = await many<{ id: string; reminder_count: number }>(
    `SELECT o.id, o.reminder_count
       FROM orders o JOIN brands b ON b.id = o.brand_id
      WHERE o.status = 'ready'
        AND coalesce((b.notification_settings->>'autoReminder')::boolean, true)
        AND o.reminder_count < coalesce((b.notification_settings->>'maxReminders')::int, 3)
        AND coalesce(o.last_notified_at, o.ready_at) <
            now() - make_interval(mins => coalesce((b.notification_settings->>'autoReminderAfterMinutes')::int, 3))
        AND o.ready_at > now() - interval '2 hours'
      LIMIT 100`,
  );
  let queued = 0;
  for (const o of due) {
    queued += await withTx(async (c) => {
      const upd = await c.query(
        `UPDATE orders SET reminder_count = reminder_count + 1, last_notified_at = now()
          WHERE id = $1 AND status = 'ready' AND reminder_count = $2`,
        [o.id, o.reminder_count],
      );
      if (!upd.rowCount) return 0;
      await c.query(
        `INSERT INTO order_events (order_id, brand_id, type, data)
         SELECT id, brand_id, 'reminder_auto', jsonb_build_object('n', $2::int) FROM orders WHERE id = $1`,
        [o.id, o.reminder_count + 1],
      );
      return enqueueForOrder(c, o.id, 'reminder', o.reminder_count + 1);
    });
  }
  return queued;
}

let timer: NodeJS.Timeout | null = null;
let running = false;
let lastReminderScan = 0;

async function loop() {
  if (running) return;
  running = true;
  try {
    while ((await processOutboxBatch()) > 0) {
      /* drain */
    }
    if (Date.now() - lastReminderScan > 15_000) {
      lastReminderScan = Date.now();
      if (await scheduleAutoReminders()) await processOutboxBatch();
    }
  } catch (err) {
    console.error('[outbox] tick failed', err);
  } finally {
    running = false;
  }
}

export function startOutboxWorker(intervalMs = 1000): void {
  if (!timer) timer = setInterval(loop, intervalMs);
}

/** Send immediately after a state change instead of waiting for the next tick. */
export function kickOutbox(): void {
  if (timer) setImmediate(loop);
}

export function stopOutboxWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
