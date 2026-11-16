import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Button, PageLoading } from '../../components/ui';
import { api } from '../../lib/api';
import { dateTime, humanDuration } from '../../lib/format';
import { useI18n, type Key } from '../../lib/i18n';
import { useSession } from '../../state/session';
import type { OrderStatus, StaffOrder } from '../../state/types';

const secs = (a: string | null, b: string | null) => (a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 1000 : null);

export default function History() {
  const { t, lang } = useI18n();
  const s = useSession();
  const [rows, setRows] = useState<StaffOrder[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (before?: string) => {
      setBusy(true);
      const params = new URLSearchParams({ scope: 'history', limit: '50' });
      if (s.branchId) params.set('branchId', s.branchId);
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      if (before) params.set('before', before);
      try {
        const r = await api<{ orders: StaffOrder[]; nextBefore: string | null }>(`/brands/${s.brandId}/orders?${params}`);
        setRows((cur) => (before ? [...(cur ?? []), ...r.orders] : r.orders));
        setNext(r.nextBefore);
      } finally {
        setBusy(false);
      }
    },
    [s.brandId, s.branchId, q, status],
  );

  useEffect(() => {
    const id = setTimeout(() => void load(), 250);
    return () => clearTimeout(id);
  }, [load]);

  return (
    <>
      <div className="row wrap">
        <div className="field grow" style={{ maxWidth: 260 }}>
          <input className="input" placeholder={`${t('search')} — ${t('orderNumber')}`} value={q} onChange={(e) => setQ(e.target.value)} dir="ltr" />
        </div>
        <div className="seg">
          {(['', 'picked_up', 'cancelled', 'ready', 'preparing'] as const).map((st) => (
            <button key={st || 'all'} className={status === st ? 'on' : ''} onClick={() => setStatus(st)}>
              {st ? t(`status_${st}` as Key) : t('all')}
            </button>
          ))}
        </div>
      </div>
      {!rows ? (
        <PageLoading />
      ) : rows.length === 0 ? (
        <div className="empty">{t('noHistory')}</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('orderNumber')}</th>
                <th>{t('status')}</th>
                <th>{t('created')}</th>
                <th>{t('prep')}</th>
                <th>{t('pickupAfterAlert')}</th>
                <th>{t('phoneLinked')}</th>
                <th>{t('rating')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="num" style={{ fontWeight: 700, fontSize: 16 }}><bdi dir="ltr">#{o.orderNumber}</bdi></td>
                  <td>
                    <span className={`chip ${o.status === 'picked_up' ? 'ok' : o.status === 'cancelled' ? 'red' : o.status === 'ready' ? 'warn' : ''}`}>{t(`status_${o.status}` as Key)}</span>
                  </td>
                  <td className="muted">{dateTime(o.createdAt, lang)}</td>
                  <td className="num">{humanDuration(secs(o.createdAt, o.readyAt), lang)}</td>
                  <td className="num">{humanDuration(secs(o.readyAt, o.pickedUpAt), lang)}</td>
                  <td>{o.devicesCount ? <Icon name="check" size={18} style={{ color: 'var(--ok)' }} /> : <span className="muted">—</span>}</td>
                  <td>{o.rating ? <span className="stars">{'★'.repeat(o.rating)}</span> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {next ? (
        <Button variant="ghost" loading={busy} onClick={() => void load(next)} style={{ alignSelf: 'center' }}>
          {t('loadMore')}
        </Button>
      ) : null}
    </>
  );
}
