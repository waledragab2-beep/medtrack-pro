import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Icon } from '../../components/Icon';
import { PageLoading } from '../../components/ui';
import { api } from '../../lib/api';
import { humanDuration, isoDay, num, pct, shortDate } from '../../lib/format';
import { useI18n, type Key } from '../../lib/i18n';
import { useSession } from '../../state/session';

interface Summary {
  totalOrders: number;
  pickedUp: number;
  cancelled: number;
  avgOrdersPerDay: number;
  avgPrepSeconds: number | null;
  avgPickupSeconds: number | null;
  latePickups: number;
  avgRating: number | null;
  ratingsCount: number;
  googleReviewClicks: number;
  notifications: { attempted: number; accepted: number; delivered: number; failed: number; pending: number; sendRate: number | null; deliveryRate: number | null };
  linkRate: number | null;
}
interface Report {
  isDemo: boolean;
  range: { from: string; to: string; days: number };
  previousRange: { from: string; to: string };
  allTimeOrders: number;
  current: Summary;
  previous: Summary;
  daily: { date: string; orders: number; pickedUp: number; avgPrepSeconds: number | null; avgPickupSeconds: number | null }[];
  hourly: { hour: number; orders: number }[];
  recentRatings: { stars: number; comment: string | null; createdAt: string; orderNumber: string }[];
}

type Preset = 'today' | 'last7' | 'last30' | 'thisMonth' | 'last90';
function rangeFor(p: Preset): [string, string] {
  const today = new Date();
  const back = (d: number) => isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - d));
  switch (p) {
    case 'today':
      return [back(0), back(0)];
    case 'last7':
      return [back(6), back(0)];
    case 'last30':
      return [back(29), back(0)];
    case 'thisMonth':
      return [isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), back(0)];
    case 'last90':
      return [back(89), back(0)];
  }
}

/** Relative change; `lowerIsBetter` flips the colour for time metrics. */
function Delta({ cur, prev, lowerIsBetter }: { cur: number | null; prev: number | null; lowerIsBetter?: boolean }) {
  const { lang } = useI18n();
  if (cur == null || prev == null || prev === 0) return null;
  const change = (cur - prev) / prev;
  if (!Number.isFinite(change) || Math.abs(change) < 0.005) return <span className="delta muted">±0%</span>;
  const good = lowerIsBetter ? change < 0 : change > 0;
  return (
    <span className={`delta ${good ? 'up' : 'down'}`} dir="ltr">
      {change > 0 ? '▲' : '▼'} {pct(Math.abs(change), lang)}
    </span>
  );
}

const INK = '#0A0A0A';
const RED = '#E10600';
const GRID = '#ECECE8';

export default function Analytics() {
  const { t, lang } = useI18n();
  const s = useSession();
  const [preset, setPreset] = useState<Preset | null>('last30');
  const [[from, to], setRange] = useState(rangeFor('last30'));
  const [branchId, setBranchId] = useState<string>(s.lockedBranchId ?? '');
  const [data, setData] = useState<Report | null>(null);

  useEffect(() => {
    setData(null);
    const p = new URLSearchParams({ from, to });
    if (branchId) p.set('branchId', branchId);
    void api<Report>(`/brands/${s.brandId}/analytics?${p}`).then(setData).catch(() => {});
  }, [s.brandId, from, to, branchId]);

  const daily = useMemo(
    () =>
      data?.daily.map((d) => ({
        ...d,
        label: shortDate(d.date, lang),
        prepMin: d.avgPrepSeconds != null ? +(d.avgPrepSeconds / 60).toFixed(1) : null,
        pickupMin: d.avgPickupSeconds != null ? +(d.avgPickupSeconds / 60).toFixed(1) : null,
      })) ?? [],
    [data, lang],
  );

  const c = data?.current;
  const p = data?.previous;

  return (
    <>
      <div className="row wrap between">
        <div className="seg">
          {(['today', 'last7', 'last30', 'thisMonth', 'last90'] as Preset[]).map((k) => (
            <button
              key={k}
              className={preset === k ? 'on' : ''}
              onClick={() => {
                setPreset(k);
                setRange(rangeFor(k));
              }}
            >
              {t(k as Key)}
            </button>
          ))}
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <input className="input" type="date" value={from} max={to} onChange={(e) => (setPreset(null), setRange([e.target.value, to]))} style={{ width: 160 }} aria-label={t('from')} />
          <input className="input" type="date" value={to} min={from} onChange={(e) => (setPreset(null), setRange([from, e.target.value]))} style={{ width: 160 }} aria-label={t('to')} />
          {s.branches.length > 1 && !s.lockedBranchId ? (
            <select className="select" style={{ width: 'auto' }} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t('allBranches')}</option>
              {s.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {!data || !c || !p ? (
        <PageLoading />
      ) : (
        <>
          {data.isDemo ? (
            <div className="banner warn" style={{ borderRadius: 12 }}>
              <Icon name="sparkle" /> {t('demoNotice')}
            </div>
          ) : null}
          <div className="kpis">
            <div className="kpi hero">
              <div className="label">{t('kpiOrders')}</div>
              <div className="value">{num(c.totalOrders, lang)}</div>
              <div className="row" style={{ gap: 8 }}>
                <Delta cur={c.totalOrders} prev={p.totalOrders} />
                <span className="tiny" style={{ color: '#9a9a95' }}>
                  {t('allTime')}: {num(data.allTimeOrders, lang)}
                </span>
              </div>
            </div>
            <Kpi label={t('kpiPrep')} value={humanDuration(c.avgPrepSeconds, lang)} delta={<Delta cur={c.avgPrepSeconds} prev={p.avgPrepSeconds} lowerIsBetter />} icon="clock" />
            <Kpi label={t('kpiPickup')} value={humanDuration(c.avgPickupSeconds, lang)} delta={<Delta cur={c.avgPickupSeconds} prev={p.avgPickupSeconds} lowerIsBetter />} icon="bolt" />
            <Kpi
              label={t('kpiDelivery')}
              value={pct(c.notifications.sendRate, lang)}
              icon="bell"
              delta={
                <span className="tiny muted">
                  {t('confirmedByDevice')}: {pct(c.notifications.deliveryRate, lang)}
                </span>
              }
            />
            <Kpi
              label={t('kpiRating')}
              value={
                <>
                  {num(c.avgRating, lang, 2)} <small className="stars">★</small>
                </>
              }
              delta={
                <span className="tiny muted">
                  {num(c.ratingsCount, lang)} {t('kpiRatingsCount')}
                </span>
              }
              icon="star"
            />
            <Kpi label={t('kpiDaily')} value={num(c.avgOrdersPerDay, lang, 1)} delta={<Delta cur={c.avgOrdersPerDay} prev={p.avgOrdersPerDay} />} icon="chart" />
            <Kpi label={t('kpiPickedUp')} value={num(c.pickedUp, lang)} delta={<Delta cur={c.pickedUp} prev={p.pickedUp} />} icon="check" />
            <Kpi label={t('kpiLate')} value={num(c.latePickups, lang)} delta={<Delta cur={c.latePickups} prev={p.latePickups} lowerIsBetter />} icon="clock" />
            <Kpi label={t('kpiLink')} value={pct(c.linkRate, lang)} icon="phone" delta={<Delta cur={c.linkRate} prev={p.linkRate} />} />
            <Kpi label={t('kpiGoogle')} value={num(c.googleReviewClicks, lang)} icon="external" />
          </div>
          <p className="tiny muted">
            {t('vsPrevious')}: <span dir="ltr">{data.previousRange.from} → {data.previousRange.to}</span>
          </p>

          <div className="chart-grid">
            <div className="card">
              <h3>{t('dailyOrders')}</h3>
              {c.totalOrders ? (
                <div style={{ height: 280, marginTop: 12 }} dir="ltr">
                  <ResponsiveContainer>
                    <AreaChart data={daily} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={RED} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={RED} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8a8a85' }} tickLine={false} axisLine={false} minTickGap={16} reversed={lang === 'ar'} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8a8a85' }} tickLine={false} axisLine={false} orientation={lang === 'ar' ? 'right' : 'left'} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e7e4' }} formatter={(v) => [num(Number(v), lang), t('orders')]} />
                      <Area type="monotone" dataKey="orders" stroke={RED} strokeWidth={2.5} fill="url(#ordersFill)" dot={false} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty" style={{ marginTop: 12 }}>{t('noData')}</div>
              )}
            </div>
            <div className="card">
              <h3>{t('peakHours')}</h3>
              <div style={{ height: 280, marginTop: 12 }} dir="ltr">
                <ResponsiveContainer>
                  <BarChart data={data.hourly} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#8a8a85' }} tickLine={false} axisLine={false} interval={2} reversed={lang === 'ar'} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#8a8a85' }} tickLine={false} axisLine={false} orientation={lang === 'ar' ? 'right' : 'left'} />
                    <Tooltip cursor={{ fill: '#f3f3f0' }} contentStyle={{ borderRadius: 12 }} labelFormatter={(h) => `${h}:00`} formatter={(v) => [num(Number(v), lang), t('orders')]} />
                    <Bar dataKey="orders" fill={INK} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="chart-grid">
            <div className="card">
              <h3>{t('timesTrend')}</h3>
              <div className="row small" style={{ gap: 16, marginTop: 6 }}>
                <span className="row" style={{ gap: 6 }}>
                  <i style={{ width: 14, height: 3, background: INK, display: 'inline-block', borderRadius: 2 }} /> {t('kpiPrep')}
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <i style={{ width: 14, height: 3, background: RED, display: 'inline-block', borderRadius: 2 }} /> {t('kpiPickup')}
                </span>
              </div>
              <div style={{ height: 240, marginTop: 8 }} dir="ltr">
                <ResponsiveContainer>
                  <LineChart data={daily} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8a8a85' }} tickLine={false} axisLine={false} minTickGap={16} reversed={lang === 'ar'} />
                    <YAxis tick={{ fontSize: 11, fill: '#8a8a85' }} tickLine={false} axisLine={false} orientation={lang === 'ar' ? 'right' : 'left'} />
                    <Tooltip contentStyle={{ borderRadius: 12 }} formatter={(v, name) => [`${v} ${t('minutes')}`, name === 'prepMin' ? t('kpiPrep') : t('kpiPickup')]} />
                    <Line type="monotone" dataKey="prepMin" stroke={INK} strokeWidth={2.2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="pickupMin" stroke={RED} strokeWidth={2.2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card col">
              <h3>{t('recentRatings')}</h3>
              {data.recentRatings.length ? (
                data.recentRatings.map((r, i) => (
                  <div key={i} className="row between" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                    <div className="grow">
                      <span className="stars">{'★'.repeat(r.stars)}</span>
                      <span style={{ color: '#ddd' }}>{'★'.repeat(5 - r.stars)}</span>
                      {r.comment ? <div className="small">{r.comment}</div> : null}
                    </div>
                    <span className="tiny muted num"><bdi dir="ltr">#{r.orderNumber}</bdi></span>
                  </div>
                ))
              ) : (
                <div className="empty">{t('noData')}</div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Kpi({ label, value, delta, icon }: { label: string; value: React.ReactNode; delta?: React.ReactNode; icon: Parameters<typeof Icon>[0]['name'] }) {
  return (
    <div className="kpi">
      <div className="label">
        <Icon name={icon} size={16} /> {label}
      </div>
      <div className="value">{value}</div>
      <div>{delta}</div>
    </div>
  );
}
