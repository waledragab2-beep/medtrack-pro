import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { QR } from '../../components/QR';
import { Button, Modal, Toggle, useNow, useOnline, useToast } from '../../components/ui';
import { actionQueue, isNetworkError } from '../../lib/actionQueue';
import { api, ApiError, tokenStore } from '../../lib/api';
import { clock } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { openSocket } from '../../lib/socket';
import { useSession } from '../../state/session';
import type { StaffOrder } from '../../state/types';

const PREP_PRESETS = [3, 5, 10, 15];
const QR_PREF = 'uyt.showQrAfterAdd';

export default function Orders() {
  const { t } = useI18n();
  const s = useSession();
  const toast = useToast();
  const online = useOnline();
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [socketUp, setSocketUp] = useState(true);
  const [number, setNumber] = useState('');
  const [prep, setPrep] = useState<number | undefined>();
  const [adding, setAdding] = useState(false);
  const [qrOrder, setQrOrder] = useState<StaffOrder | null>(null);
  const [showQrAfterAdd, setShowQrAfterAdd] = useState(() => localStorage.getItem(QR_PREF) !== 'false');
  const inputRef = useRef<HTMLInputElement>(null);
  const branch = s.branches.find((b) => b.id === s.branchId) ?? null;
  const brandId = s.brandId!;

  const upsert = useCallback((o: StaffOrder) => {
    setOrders((cur) => {
      const active = o.status === 'preparing' || o.status === 'ready';
      const rest = cur.filter((x) => x.id !== o.id);
      return active ? [...rest, o].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : rest;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!s.branchId) return;
    try {
      const r = await api<{ orders: StaffOrder[] }>(`/brands/${brandId}/orders?branchId=${s.branchId}&scope=active`);
      // Keep offline-created orders that have not synced yet.
      setOrders((cur) => [...r.orders, ...cur.filter((o) => o.pending)]);
      setLoaded(true);
    } catch {
      /* offline – keep what we have */
    }
  }, [brandId, s.branchId]);

  // Realtime subscription for the selected branch + resync on reconnect.
  useEffect(() => {
    if (!s.branchId) return;
    void refresh();
    const tokens = tokenStore.get();
    const socket = openSocket({ accessToken: tokens?.accessToken });
    socket.on('connect', () => {
      setSocketUp(true);
      socket.emit('subscribe:branch', { brandId, branchId: s.branchId });
      void refresh();
    });
    socket.on('disconnect', () => setSocketUp(false));
    socket.on('connect_error', () => {
      setSocketUp(false);
      // token may have expired: update auth for the next attempt
      socket.auth = { accessToken: tokenStore.get()?.accessToken };
    });
    socket.on('order:upsert', (o: StaffOrder) => upsert(o));
    const poll = setInterval(() => !socket.connected && void refresh(), 15000);
    return () => {
      clearInterval(poll);
      socket.close();
    };
  }, [brandId, s.branchId, refresh, upsert]);

  // Replay queued actions when back online.
  useEffect(() => {
    if (!online || !actionQueue.size()) return;
    void actionQueue
      .flush((tempId, order) => {
        setOrders((cur) => cur.filter((o) => o.id !== tempId));
        upsert(order as StaffOrder);
      })
      .then(() => refresh());
  }, [online, refresh, upsert]);

  async function add(e: FormEvent) {
    e.preventDefault();
    const orderNumber = number.trim();
    if (!orderNumber || !s.branchId) return;
    setAdding(true);
    try {
      const r = await api<{ order: StaffOrder }>(`/brands/${brandId}/orders`, { body: { branchId: s.branchId, orderNumber, prepMinutes: prep } });
      upsert(r.order);
      setNumber('');
      if (showQrAfterAdd) setQrOrder(r.order);
      else toast(`${t('orderAdded')} #${r.order.orderNumber}`);
    } catch (err) {
      if (isNetworkError(err)) {
        const tempId = `tmp-${Date.now()}`;
        actionQueue.push({ id: tempId, kind: 'create', brandId, tempId, body: { branchId: s.branchId, orderNumber, prepMinutes: prep } });
        const now = new Date().toISOString();
        setOrders((cur) => [
          ...cur,
          {
            id: tempId, branchId: s.branchId!, orderNumber, status: 'preparing', note: null, claimCode: '', claimUrl: '', reminderCount: 0,
            estimatedReadyAt: null, lastNotifiedAt: null, createdAt: now, readyAt: null, pickedUpAt: null, cancelledAt: null,
            devicesCount: 0, pushDevicesCount: 0, deliveredCount: 0, pending: true,
          },
        ]);
        setNumber('');
        toast(t('queuedOffline'));
      } else {
        const e2 = err as ApiError;
        toast(e2.code === 'order_number_active' ? t('orderActiveExists') : e2.message, 'error');
      }
    } finally {
      setAdding(false);
      inputRef.current?.focus();
    }
  }

  async function act(o: StaffOrder, kind: 'ready' | 'pickup' | 'cancel' | 'remind' | 'unlink') {
    try {
      const r = await api<{ order: StaffOrder }>(`/brands/${brandId}/orders/${o.id}/${kind}`, { method: 'POST' });
      upsert(r.order);
      if (kind === 'remind') toast(t('reminderSent'));
      if (kind === 'unlink' && qrOrder?.id === o.id) setQrOrder(r.order);
    } catch (err) {
      if (isNetworkError(err) && (kind === 'ready' || kind === 'pickup' || kind === 'cancel')) {
        actionQueue.push({ id: `${kind}-${o.id}`, kind, brandId, orderId: o.id });
        const now = new Date().toISOString();
        upsert({ ...o, status: kind === 'ready' ? 'ready' : kind === 'pickup' ? 'picked_up' : 'cancelled', readyAt: o.readyAt ?? now });
        toast(t('queuedOffline'));
      } else {
        toast((err as ApiError).message || t('error'), 'error');
      }
    }
  }

  const preparing = useMemo(() => orders.filter((o) => o.status === 'preparing'), [orders]);
  const ready = useMemo(() => orders.filter((o) => o.status === 'ready'), [orders]);

  return (
    <>
      {online && !socketUp && loaded ? (
        <div className="banner warn" style={{ borderRadius: 12 }}>
          <span className="spinner" style={{ width: 16, height: 16 }} /> {t('reconnecting')}
        </div>
      ) : null}

      <form className="card composer" onSubmit={add}>
        <div className="col" style={{ gap: 10 }}>
          <label className="field">
            <span>{t('orderNumber')}</span>
            <input
              ref={inputRef}
              className="input order-input"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder={t('orderNumberPlaceholder')}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              maxLength={12}
              dir="ltr"
              aria-label={t('orderNumber')}
            />
          </label>
          <div className="row wrap between">
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="small muted">{t('prepTime')}</span>
              <div className="prep-chips">
                <button type="button" className={prep === undefined ? 'on' : ''} onClick={() => setPrep(undefined)}>
                  {t('auto')}
                </button>
                {PREP_PRESETS.map((m) => (
                  <button type="button" key={m} className={prep === m ? 'on' : ''} onClick={() => setPrep(m)}>
                    {m} {t('minutesShort')}
                  </button>
                ))}
              </div>
            </div>
            <Toggle
              checked={showQrAfterAdd}
              onChange={(v) => {
                setShowQrAfterAdd(v);
                localStorage.setItem(QR_PREF, String(v));
              }}
              label={<span className="small">{t('showQrAfterAdd')}</span>}
            />
          </div>
        </div>
        <Button variant="red" size="xl" loading={adding} disabled={!number.trim()} type="submit" style={{ minHeight: 72 }}>
          <Icon name="plus" size={24} />
          <span className="hide-sm">{t('addOrder')}</span>
        </Button>
      </form>

      <div className="board">
        <Lane title={t('preparing')} count={preparing.length} empty={t('noPreparing')}>
          {preparing.map((o) => (
            <Ticket key={o.id} o={o} lateAfter={branch?.latePickupMinutes ?? 5} requireCode={branch?.requireClaimCode ?? false} onAct={act} onQr={setQrOrder} />
          ))}
        </Lane>
        <Lane title={t('readyWaiting')} count={ready.length} empty={t('noReady')} ready>
          {ready.map((o) => (
            <Ticket key={o.id} o={o} lateAfter={branch?.latePickupMinutes ?? 5} requireCode={branch?.requireClaimCode ?? false} onAct={act} onQr={setQrOrder} />
          ))}
        </Lane>
      </div>

      {qrOrder ? <OrderQrModal order={orders.find((o) => o.id === qrOrder.id) ?? qrOrder} requireCode={branch?.requireClaimCode ?? false} onClose={() => setQrOrder(null)} /> : null}
    </>
  );
}

function Lane({ title, count, empty, ready, children }: { title: string; count: number; empty: string; ready?: boolean; children: React.ReactNode }) {
  return (
    <section className={`lane ${ready ? 'ready-lane' : ''}`}>
      <div className="lane-head">
        {ready ? <span className="dot pulse" style={{ color: 'var(--red)' }} /> : <Icon name="clock" />}
        <h2>{title}</h2>
        <span className="count">{count}</span>
      </div>
      {count ? children : <div className="empty">{empty}</div>}
    </section>
  );
}

function Ticket({
  o,
  lateAfter,
  requireCode,
  onAct,
  onQr,
}: {
  o: StaffOrder;
  lateAfter: number;
  requireCode: boolean;
  onAct: (o: StaffOrder, kind: 'ready' | 'pickup' | 'cancel' | 'remind' | 'unlink') => Promise<void>;
  onQr: (o: StaffOrder) => void;
}) {
  const { t } = useI18n();
  const now = useNow(1000);
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const isReady = o.status === 'ready';
  const elapsed = (now - new Date(isReady && o.readyAt ? o.readyAt : o.createdAt).getTime()) / 1000;
  const total = o.estimatedReadyAt ? (new Date(o.estimatedReadyAt).getTime() - new Date(o.createdAt).getTime()) / 1000 : 0;
  const over = isReady ? elapsed > lateAfter * 60 : total > 0 && elapsed > total;
  const progress = total ? Math.min(100, (elapsed / total) * 100) : 0;

  const run = async (kind: 'ready' | 'pickup' | 'cancel' | 'remind' | 'unlink') => {
    setMenu(false);
    if (kind === 'cancel' && !window.confirm(t('cancelOrderConfirm'))) return;
    setBusy(kind);
    await onAct(o, kind);
    setBusy(null);
  };

  return (
    <article className={`ticket ${isReady ? 'is-ready' : ''} ${isReady && over ? 'is-late' : ''}`} data-testid={`ticket-${o.orderNumber}`}>
      <div className="no" dir="ltr">
        {o.orderNumber}
      </div>
      <div className="meta">
        <div className="row" style={{ gap: 10 }}>
          <span className={`timer ${over ? 'over' : ''}`}>{clock(elapsed)}</span>
          <span className="small muted">{isReady ? t('sinceReady') : t('elapsed')}</span>
          {isReady && over ? <span className="chip red">{t('late')}</span> : null}
        </div>
        {!isReady && total ? (
          <div className="bar">
            <i className={over ? 'over' : ''} style={{ width: `${progress}%` }} />
          </div>
        ) : null}
        <div className="row wrap" style={{ gap: 6 }}>
          {o.pending ? (
            <span className="chip warn">
              <Icon name="wifiOff" size={14} /> {t('pendingSync')}
            </span>
          ) : o.devicesCount ? (
            <span className="chip ok" title={t('phoneLinked')}>
              <Icon name="phone" size={14} /> {o.devicesCount > 1 ? `×${o.devicesCount}` : t('phoneLinked')}
            </span>
          ) : (
            <span className="chip" title={t('phoneNotLinked')}>
              <Icon name="phone" size={14} /> {t('phoneNotLinked')}
            </span>
          )}
          {o.devicesCount ? (
            o.pushDevicesCount ? (
              <span className={`chip ${isReady && o.deliveredCount ? 'ok' : ''}`}>
                <Icon name={isReady && o.deliveredCount ? 'checks' : 'bell'} size={14} /> {isReady && o.deliveredCount ? t('alertDelivered') : t('alertsOn')}
              </span>
            ) : (
              <span className="chip warn">
                <Icon name="bellOff" size={14} /> {t('alertsOff')}
              </span>
            )
          ) : null}
          {requireCode && o.claimCode ? (
            <span className="chip dark num" title={t('orderCode')}>
              {o.claimCode}
            </span>
          ) : null}
          {o.reminderCount ? <span className="chip">⏰ ×{o.reminderCount}</span> : null}
        </div>
      </div>
      <div className="actions">
        {isReady ? (
          <>
            <Button size="lg" loading={busy === 'pickup'} onClick={() => run('pickup')} disabled={o.pending}>
              <Icon name="check" /> {t('markPickedUp')}
            </Button>
            {o.pushDevicesCount ? (
              <Button variant="ghost" size="lg" className="icon" title={t('remind')} loading={busy === 'remind'} onClick={() => run('remind')} aria-label={t('remind')}>
                {busy === 'remind' ? null : <Icon name="bell" />}
              </Button>
            ) : null}
          </>
        ) : (
          <Button variant="red" size="xl" loading={busy === 'ready'} onClick={() => run('ready')} disabled={o.pending}>
            {t('markReady')}
          </Button>
        )}
        <div style={{ position: 'relative' }}>
          <button className="btn ghost icon" onClick={() => setMenu((m) => !m)} aria-label="more" disabled={o.pending} style={{ minHeight: 56, width: 44 }}>
            <Icon name="dots" />
          </button>
          {menu ? (
            <div className="menu-pop" onMouseLeave={() => setMenu(false)}>
              <button onClick={() => (setMenu(false), onQr(o))}>
                <Icon name="qr" /> {t('showQr')}
              </button>
              {o.devicesCount ? (
                <button onClick={() => run('unlink')}>
                  <Icon name="unlink" /> {t('unlink')}
                </button>
              ) : null}
              <button className="danger" onClick={() => run('cancel')}>
                <Icon name="trash" /> {t('cancelOrder')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function OrderQrModal({ order, requireCode, onClose }: { order: StaffOrder; requireCode: boolean; onClose: () => void }) {
  const { t } = useI18n();
  // Auto-close once the customer's phone is linked.
  const linkedAtOpen = useRef(order.devicesCount);
  useEffect(() => {
    if (order.devicesCount > linkedAtOpen.current) {
      const id = setTimeout(onClose, 1200);
      return () => clearTimeout(id);
    }
  }, [order.devicesCount, onClose]);
  return (
    <Modal title={`${t('order')} #${order.orderNumber}`} onClose={onClose} width={460}>
      <div className="qr-display">
        <div className="big-no" dir="ltr">
          #{order.orderNumber}
        </div>
        <h3>{t('scanToTrack')}</h3>
        {order.claimUrl ? <QR value={order.claimUrl} size={280} /> : null}
        <p className="small muted" style={{ maxWidth: 340 }}>
          {t('scanToTrackHint')}
        </p>
        {requireCode ? (
          <div className="col" style={{ alignItems: 'center', gap: 4 }}>
            <span className="small muted">{t('orCode')}</span>
            <span className="chip dark num" style={{ fontSize: 22, height: 40, padding: '0 16px' }}>
              {order.claimCode}
            </span>
          </div>
        ) : null}
        {order.devicesCount ? (
          <span className="chip ok" style={{ height: 34, fontSize: 14 }}>
            <Icon name="check" size={16} /> {t('phoneLinked')}
          </span>
        ) : null}
      </div>
    </Modal>
  );
}
