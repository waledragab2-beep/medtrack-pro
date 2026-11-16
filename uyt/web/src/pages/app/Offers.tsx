import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { ImageInput } from '../../components/ImageInput';
import { Button, Field, Modal, PageLoading, Toggle } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../state/session';
import type { Offer } from '../../state/types';

/** ISO → value for <input type="datetime-local"> in local time. */
const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function Offers() {
  const { t, pick, lang } = useI18n();
  const s = useSession();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [edit, setEdit] = useState<Partial<Offer> | null>(null);
  const base = `/brands/${s.brandId}/offers`;
  const load = useCallback(() => api<{ items: Offer[] }>(base).then((r) => setOffers(r.items)), [base]);
  useEffect(() => void load(), [load]);
  if (!offers) return <PageLoading />;

  const live = (o: Offer) => o.isActive && (!o.startsAt || new Date(o.startsAt) <= new Date()) && (!o.endsAt || new Date(o.endsAt) > new Date());

  return (
    <>
      <div className="row between">
        <span className="muted small">{offers.filter(live).length} / {offers.length}</span>
        <Button variant="red" onClick={() => setEdit({ isActive: true })}>
          <Icon name="plus" /> {t('addOffer')}
        </Button>
      </div>
      {offers.length ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {offers.map((o) => (
            <div key={o.id} className="card col" style={{ gap: 10, opacity: live(o) ? 1 : 0.55 }}>
              <div style={{ height: 120, borderRadius: 12, background: o.imageUrl ? `center/cover url("${o.imageUrl}")` : 'linear-gradient(135deg, var(--red), #400)', position: 'relative' }}>
                {o.badge ? (
                  <span className="chip" style={{ position: 'absolute', top: 10, insetInlineStart: 10, background: '#fff', color: 'var(--red)' }}>
                    {o.badge}
                  </span>
                ) : null}
              </div>
              <h3>{pick(o.title, o.titleEn)}</h3>
              <p className="small muted">{pick(o.description, o.descriptionEn)}</p>
              <div className="tiny muted">
                {o.startsAt ? `${t('startsAt')}: ${dateTime(o.startsAt, lang)}` : ''} {o.endsAt ? `• ${t('endsAt')}: ${dateTime(o.endsAt, lang)}` : ''}
              </div>
              <div className="row between">
                <span className={`chip ${live(o) ? 'ok' : ''}`}>{live(o) ? t('active') : t('disabled')}</span>
                <Button variant="ghost" size="sm" onClick={() => setEdit(o)}>
                  {t('edit')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">{t('noItems')}</div>
      )}
      {edit ? <OfferForm offer={edit} onClose={() => setEdit(null)} onSaved={load} /> : null}
    </>
  );
}

function OfferForm({ offer, onClose, onSaved }: { offer: Partial<Offer>; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const s = useSession();
  const [d, setD] = useState(offer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof Offer>(k: K, v: Offer[K] | null) => setD({ ...d, [k]: v });
  const base = `/brands/${s.brandId}/offers`;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = {
      title: d.title,
      titleEn: d.titleEn || null,
      description: d.description || null,
      descriptionEn: d.descriptionEn || null,
      imageUrl: d.imageUrl ?? '',
      badge: d.badge || null,
      startsAt: d.startsAt || null,
      endsAt: d.endsAt || null,
      isActive: d.isActive ?? true,
    };
    try {
      if (d.id) await api(`${base}/${d.id}`, { method: 'PATCH', body });
      else await api(base, { body });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!d.id || !window.confirm(t('delete') + '?')) return;
    await api(`${base}/${d.id}`, { method: 'DELETE' });
    onSaved();
    onClose();
  }

  return (
    <Modal
      title={d.id ? t('edit') : t('addOffer')}
      onClose={onClose}
      footer={
        <>
          {d.id ? (
            <Button variant="ghost" type="button" onClick={remove} style={{ marginInlineEnd: 'auto', color: 'var(--red)' }}>
              {t('delete')}
            </Button>
          ) : null}
          <Button variant="ghost" type="button" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="red" loading={busy} type="submit" form="offer-form">
            {t('save')}
          </Button>
        </>
      }
    >
      <form id="offer-form" className="form-grid" onSubmit={save}>
        {error ? <div className="form-error full">{error}</div> : null}
        <Field label={t('title')}>
          <input className="input" required value={d.title ?? ''} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label={t('titleEn')}>
          <input className="input" value={d.titleEn ?? ''} onChange={(e) => set('titleEn', e.target.value)} dir="ltr" />
        </Field>
        <Field label={t('description')}>
          <input className="input" value={d.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label={t('descriptionEn')}>
          <input className="input" value={d.descriptionEn ?? ''} onChange={(e) => set('descriptionEn', e.target.value)} dir="ltr" />
        </Field>
        <Field label={t('badge')}>
          <input className="input" value={d.badge ?? ''} onChange={(e) => set('badge', e.target.value)} maxLength={20} />
        </Field>
        <div />
        <Field label={t('startsAt')}>
          <input className="input" type="datetime-local" value={toLocalInput(d.startsAt)} onChange={(e) => set('startsAt', e.target.value ? new Date(e.target.value).toISOString() : null)} />
        </Field>
        <Field label={t('endsAt')}>
          <input className="input" type="datetime-local" value={toLocalInput(d.endsAt)} onChange={(e) => set('endsAt', e.target.value ? new Date(e.target.value).toISOString() : null)} />
        </Field>
        <Field label={t('image')} className="full">
          <ImageInput brandId={s.brandId!} value={d.imageUrl} onChange={(v) => set('imageUrl', v)} wide />
        </Field>
        <div className="full">
          <Toggle checked={d.isActive ?? true} onChange={(v) => set('isActive', v)} label={t('active')} />
        </div>
      </form>
    </Modal>
  );
}
