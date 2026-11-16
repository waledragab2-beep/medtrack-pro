import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { PageLoading, useNow } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { deviceStore } from '../../lib/device';
import { clock, locale } from '../../lib/format';
import { useBrandDefaultLang, useI18n } from '../../lib/i18n';
import { enableWebPush, pushSupport, registerServiceWorker } from '../../lib/push';
import { openSocket } from '../../lib/socket';
import { startAlarm, stopAlarm, unlockAudio } from '../../lib/sound';
import type { BrandContent, OrderStatus, PublicBranch, PublicBrand } from '../../state/types';
import { BrandExtras, BrandShell, CenteredMessage } from './BrandSections';

interface PublicOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  estimatedReadyAt: string | null;
  readyAt: string | null;
  pickedUpAt: string | null;
  cancelledAt: string | null;
  queueAhead: number;
  rating: { stars: number; comment: string | null } | null;
  pushEnabled: boolean;
}
type Data = { serverTime: string; order: PublicOrder; brand: PublicBrand & { defaultLocale?: string }; branch: PublicBranch } & BrandContent;

const seenKey = (id: string) => `uyt.readySeen.${id}`;
const wasSeen = (id: string) => {
  try {
    return localStorage.getItem(seenKey(id)) === '1';
  } catch {
    return false;
  }
};

export default function OrderPage() {
  const { orderId = '' } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { t, lang } = useI18n();
  const [token, setToken] = useState<string | null>(() => deviceStore.get(orderId)?.token ?? null);
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'unlinked' | 'invalid'>('loading');
  const [claimError, setClaimError] = useState('');
  const [showReady, setShowReady] = useState(false);
  const skew = useRef(0);
  const prevStatus = useRef<OrderStatus | null>(null);
  useBrandDefaultLang(data?.brand.defaultLocale);

  // 1) Link through the per-order QR (?k=secret) if this device is not linked yet.
  useEffect(() => {
    const secret = params.get('k');
    if (token || !secret) {
      if (!token) setState('unlinked');
      if (secret) nav(`/o/${orderId}`, { replace: true });
      return;
    }
    api<{ orderId: string; deviceToken: string }>(`/public/orders/${orderId}/claim`, { auth: false, body: { secret, platform: 'web', locale: lang } })
      .then((r) => {
        deviceStore.save({ orderId, token: r.deviceToken, linkedAt: new Date().toISOString() });
        setToken(r.deviceToken);
      })
      .catch((e: ApiError) => {
        setClaimError(e.code === 'order_already_linked' ? t('alreadyLinked') : e.code === 'network' ? t('networkError') : t('linkExpired'));
        setState('invalid');
      })
      .finally(() => nav(`/o/${orderId}`, { replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const applyStatus = useCallback(
    (status: OrderStatus) => {
      if (status === 'ready' && prevStatus.current !== 'ready' && !wasSeen(orderId)) setShowReady(true);
      if (status !== 'ready') setShowReady(false);
      prevStatus.current = status;
    },
    [orderId],
  );

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const d = await api<Data>(`/public/orders/${orderId}`, { device: token, auth: false });
      skew.current = new Date(d.serverTime).getTime() - Date.now();
      setData(d);
      setState('ok');
      applyStatus(d.order.status);
      document.title = `${d.brand.name} • #${d.order.orderNumber}`;
      deviceStore.save({ orderId, token, orderNumber: d.order.orderNumber, brandName: d.brand.name, branchSlug: d.branch.slug, linkedAt: deviceStore.get(orderId)?.linkedAt ?? new Date().toISOString() });
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401 || err.status === 403) {
        deviceStore.remove(orderId);
        setToken(null);
        setState('unlinked');
      }
    }
  }, [orderId, token, applyStatus]);

  // 2) Realtime + fallbacks (reconnect resync, polling while disconnected, tab visibility, SW push).
  useEffect(() => {
    if (!token) return;
    void load();
    void registerServiceWorker();
    const socket = openSocket({ deviceToken: token });
    socket.on('connect', () => void load());
    socket.on('order:status', (s: Partial<PublicOrder> & { status: OrderStatus }) => {
      setData((d) => (d ? { ...d, order: { ...d.order, ...s, queueAhead: s.status === 'preparing' ? d.order.queueAhead : 0 } } : d));
      applyStatus(s.status);
      if (s.status === 'ready' || s.status === 'picked_up') void load();
    });
    socket.on('order:reminder', () => {
      try {
        localStorage.removeItem(seenKey(orderId));
      } catch {
        /* ignore */
      }
      setShowReady(true);
    });
    socket.on('order:unlinked', () => {
      deviceStore.remove(orderId);
      setToken(null);
      setState('unlinked');
    });
    const poll = setInterval(() => !socket.connected && void load(), 8000);
    const onVisible = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    const onSw = (e: MessageEvent) => e.data?.type === 'uyt:push' && e.data.data?.orderId === orderId && void load();
    navigator.serviceWorker?.addEventListener('message', onSw);
    return () => {
      clearInterval(poll);
      socket.close();
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener('message', onSw);
    };
  }, [token, orderId, load, applyStatus]);

  // 3) Ring while the "ready" screen is up.
  useEffect(() => {
    if (!showReady || !data) return;
    startAlarm({ sound: data.brand.alertSound });
    const original = document.title;
    let flip = false;
    const id = setInterval(() => (document.title = (flip = !flip) ? `🔔 ${t('readyBig')}` : original), 1000);
    return () => {
      stopAlarm();
      clearInterval(id);
      document.title = original;
    };
  }, [showReady, data?.brand.alertSound, t]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === 'invalid') return <CenteredMessage icon="x" title={claimError || t('linkExpired')} />;
  if (state === 'unlinked' && !token) {
    const slug = deviceStore.get(orderId)?.branchSlug;
    return (
      <CenteredMessage
        icon="unlink"
        title={t('notLinkedHere')}
        action={slug ? (
          <Link className="cx-btn" to={`/s/${slug}`} style={{ maxWidth: 320 }}>
            {t('goToStore')}
          </Link>
        ) : null}
      />
    );
  }
  if (!data) return <PageLoading />;

  const { order, brand } = data;
  const dismiss = () => {
    stopAlarm();
    setShowReady(false);
    try {
      localStorage.setItem(seenKey(orderId), '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <BrandShell brand={brand}>
      <div key={order.status} className="fade-swap col" style={{ gap: 16 }}>
        {order.status === 'preparing' ? <Preparing order={order} skew={skew.current} /> : null}
        {order.status === 'ready' ? <ReadyCard order={order} onShow={() => setShowReady(true)} /> : null}
        {order.status === 'picked_up' ? <Thanks order={order} brand={brand} token={token!} onRated={load} /> : null}
        {order.status === 'cancelled' ? (
          <div className="cx-card cx-status">
            <div className="ord">
              <small>{t('order')}</small><bdi dir="ltr">#{order.orderNumber}</bdi>
            </div>
            <h2>{t('statusCancelled')}</h2>
            <p className="cx-muted">{t('statusCancelledSub')}</p>
          </div>
        ) : null}
        {order.status === 'preparing' || order.status === 'ready' ? <Alerts token={token!} enabled={order.pushEnabled} onEnabled={load} /> : null}
      </div>
      <BrandExtras brand={brand} branch={data.branch} content={data} />

      {showReady ? (
        <div className="cx-ready" role="alertdialog" aria-live="assertive" onClick={unlockAudio}>
          <div className="bell">
            <Icon name="bell" size={60} />
          </div>
          <div className="ord" dir="ltr">
            <bdi dir="ltr">#{order.orderNumber}</bdi>
          </div>
          <h1>{t('readyBig')}</h1>
          <p>{t('readyBigSub')}</p>
          <button className="cx-btn white" onClick={dismiss} style={{ color: brand.theme.primary }}>
            <Icon name="check" /> {t('gotIt')}
          </button>
        </div>
      ) : null}
    </BrandShell>
  );
}

function Steps({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  const idx = status === 'preparing' ? 0 : status === 'ready' ? 1 : 2;
  return (
    <div className="cx-steps">
      {[t('step1'), t('step2'), t('step3')].map((label, i) => (
        <div key={label} className={`cx-step ${i < idx ? 'done' : i === idx ? 'now done' : ''}`}>
          <i />
          {label}
        </div>
      ))}
    </div>
  );
}

function Preparing({ order, skew }: { order: PublicOrder; skew: number }) {
  const { t, lang } = useI18n();
  const now = useNow(1000) + skew;
  const start = new Date(order.createdAt).getTime();
  const eta = order.estimatedReadyAt ? new Date(order.estimatedReadyAt).getTime() : null;
  const remaining = eta ? (eta - now) / 1000 : null;
  const progress = eta ? Math.min(1, Math.max(0.02, (now - start) / (eta - start))) : 0.1;
  const R = 84;
  const C = 2 * Math.PI * R;
  return (
    <div className="cx-card cx-status">
      <div className="ord" dir="ltr">
        <small>{t('order')}</small><bdi dir="ltr">#{order.orderNumber}</bdi>
      </div>
      <div className="cx-ring">
        <svg width="190" height="190" viewBox="0 0 190 190">
          <circle cx="95" cy="95" r={R} fill="none" stroke="var(--c-line)" strokeWidth="10" />
          <circle cx="95" cy="95" r={R} fill="none" stroke="var(--c-primary)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div className="inner">
          {remaining != null && remaining > 0 ? (
            <div>
              <span>{t('estimatedIn')}</span>
              <b className="num" dir="ltr">
                {clock(remaining)}
              </b>
            </div>
          ) : (
            <div>
              <Icon name="clock" size={30} />
              <span style={{ display: 'block', marginTop: 6 }}>{t('almostReady')}</span>
            </div>
          )}
        </div>
      </div>
      <h2>{t('statusPreparing')}</h2>
      <p className="cx-muted">{t('statusPreparingSub')}</p>
      {order.queueAhead > 0 ? (
        <p style={{ marginTop: 10, fontWeight: 600 }}>
          <span className="num">{new Intl.NumberFormat(locale(lang)).format(order.queueAhead)}</span> {t('aheadOfYou')}
        </p>
      ) : null}
      <Steps status="preparing" />
    </div>
  );
}

function ReadyCard({ order, onShow }: { order: PublicOrder; onShow: () => void }) {
  const { t } = useI18n();
  return (
    <div className="cx-card cx-status" style={{ background: 'var(--c-primary)', color: '#fff', borderColor: 'transparent' }} onClick={onShow}>
      <div className="ord" dir="ltr">
        <small style={{ color: 'rgb(255 255 255 / 0.8)' }}>{t('order')}</small><bdi dir="ltr">#{order.orderNumber}</bdi>
      </div>
      <h2 style={{ fontSize: 28 }}>
        <Icon name="bell" size={26} style={{ color: '#fff' }} /> {t('statusReady')}
      </h2>
      <p style={{ fontSize: 17 }}>{t('statusReadySub')}</p>
    </div>
  );
}

function Alerts({ token, enabled, onEnabled }: { token: string; enabled: boolean; onEnabled: () => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<'idle' | 'busy' | 'denied' | 'unsupported'>('idle');
  const [wake, setWake] = useState<any>(null);
  const support = pushSupport();

  async function enable() {
    unlockAudio();
    setState('busy');
    const r = await enableWebPush(token);
    if (r === 'granted') {
      setState('idle');
      onEnabled();
    } else setState(r === 'denied' ? 'denied' : 'unsupported');
  }

  async function toggleWake() {
    unlockAudio();
    if (wake) {
      await wake.release().catch(() => {});
      setWake(null);
      return;
    }
    try {
      setWake(await (navigator as any).wakeLock.request('screen'));
    } catch {
      /* not supported */
    }
  }

  return (
    <div className="cx-card col" style={{ gap: 12 }}>
      <div className={`cx-alerts ${enabled ? 'on' : ''}`}>
        <div className="ic">
          <Icon name={enabled ? 'check' : 'bell'} size={22} />
        </div>
        <div className="grow">
          <div style={{ fontWeight: 700 }}>{enabled ? t('alertsEnabled') : t('enableAlerts')}</div>
          {!enabled ? <div className="cx-muted small">{state === 'denied' || state === 'unsupported' ? t('alertsDenied') : t('enableAlertsSub')}</div> : null}
        </div>
      </div>
      {!enabled && support === 'supported' && state !== 'denied' ? (
        <button className="cx-btn" onClick={enable} disabled={state === 'busy'}>
          {state === 'busy' ? <span className="spinner" /> : <Icon name="bell" />} {t('enableAlerts')}
        </button>
      ) : null}
      {!enabled && support === 'ios-needs-install' ? <div className="cx-muted small">{t('iosInstall')}</div> : null}
      <div className="row between small">
        <span className="cx-muted">{t('keepOpen')}</span>
        {'wakeLock' in navigator ? (
          <button className="cx-pill" style={{ background: wake ? 'var(--c-primary)' : undefined }} onClick={toggleWake}>
            <Icon name="sun" size={14} /> {t('keepScreenOn')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Thanks({ order, brand, token, onRated }: { order: PublicOrder; brand: PublicBrand; token: string; onRated: () => void }) {
  const { t } = useI18n();
  const [stars, setStars] = useState(order.rating?.stars ?? 0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const rated = Boolean(order.rating);

  async function send() {
    setBusy(true);
    try {
      await api(`/public/orders/${order.id}/rating`, { device: token, auth: false, body: { stars, comment: comment || null } });
      onRated();
    } finally {
      setBusy(false);
    }
  }

  const google = () => void api(`/public/orders/${order.id}/review-click`, { device: token, auth: false, method: 'POST' }).catch(() => {});

  return (
    <div className="cx-card cx-status col" style={{ gap: 14 }}>
      <div className="cx-logo" style={{ margin: '0 auto', width: 72, height: 72, borderRadius: 22, background: 'color-mix(in srgb, #22c55e 20%, transparent)', color: '#22c55e' }}>
        <Icon name="check" size={36} />
      </div>
      <div>
        <h2 style={{ margin: 0 }}>{t('thanks')}</h2>
        <p className="cx-muted">
          {t('statusPicked')} • <span className="num"><bdi dir="ltr">#{order.orderNumber}</bdi></span>
        </p>
      </div>
      <Steps status="picked_up" />
      {rated ? (
        <p style={{ fontWeight: 600 }}>{t('ratingThanks')}</p>
      ) : (
        <>
          <p style={{ fontWeight: 600 }}>{t('rateExperience')}</p>
          <div className="cx-stars" role="radiogroup">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)} aria-label={`${n}`} role="radio" aria-checked={n === stars}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" />
                </svg>
              </button>
            ))}
          </div>
          {stars ? (
            <>
              <textarea className="cx-textarea" placeholder={t('commentPlaceholder')} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
              <button className="cx-btn" onClick={send} disabled={busy}>
                {busy ? <span className="spinner" /> : null} {t('sendRating')}
              </button>
            </>
          ) : null}
        </>
      )}
      {/* Shown to every customer (Google's policy forbids only asking happy customers). */}
      {brand.googleReviewUrl ? (
        <a className="cx-btn cx-google" href={brand.googleReviewUrl} target="_blank" rel="noopener noreferrer" onClick={google}>
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
            <path fill="#4285F4" d="M45 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.2-3.8 6.5-9.5 6.5-16.1z" />
            <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C8 41.1 15.4 46 24 46z" />
            <path fill="#FBBC05" d="M11.7 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.4C2.9 17.2 2 20.5 2 24s.9 6.8 2.4 9.8l7.3-5.7z" />
            <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 8 6.9 4.4 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.3-9.1z" />
          </svg>
          {t('rateOnGoogle')}
        </a>
      ) : null}
    </div>
  );
}
