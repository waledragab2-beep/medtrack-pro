import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ImageInput } from '../../components/ImageInput';
import { Button, Field, PageLoading, Toggle, useToast } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../state/session';
import type { Brand } from '../../state/types';
import { themeVars } from '../public/BrandSections';

const PRESETS = [
  { primary: '#E10600', background: '#0A0A0A', surface: '#161616', text: '#FFFFFF' },
  { primary: '#E10600', background: '#FFFFFF', surface: '#F5F5F3', text: '#0A0A0A' },
  { primary: '#C8A165', background: '#14110E', surface: '#1F1A15', text: '#F6EFE6' },
  { primary: '#0F7B5F', background: '#F7F5EF', surface: '#FFFFFF', text: '#13201B' },
];

export default function BrandSettings() {
  const { t } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [b, setB] = useState<Brand | null>(s.brand);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setB(s.brand), [s.brand]);
  if (!b) return <PageLoading />;

  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => setB({ ...b, [k]: v });
  const setSocial = (k: keyof Brand['social'], v: string) => setB({ ...b, social: { ...b.social, [k]: v } });
  const setNs = <K extends keyof Brand['notificationSettings']>(k: K, v: Brand['notificationSettings'][K]) =>
    setB({ ...b, notificationSettings: { ...b.notificationSettings, [k]: v } });

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ brand: Brand }>(`/brands/${b!.id}`, {
        method: 'PATCH',
        body: {
          name: b!.name,
          nameEn: b!.nameEn || null,
          tagline: b!.tagline || null,
          taglineEn: b!.taglineEn || null,
          logoUrl: b!.logoUrl ?? '',
          coverUrl: b!.coverUrl ?? '',
          gallery: b!.gallery,
          theme: b!.theme,
          social: Object.fromEntries(Object.entries(b!.social).map(([k, v]) => [k, v ?? ''])),
          googleReviewUrl: b!.googleReviewUrl ?? '',
          notificationSettings: b!.notificationSettings,
          defaultLocale: b!.defaultLocale,
          timezone: b!.timezone,
          currency: b!.currency,
        },
      });
      s.setBrand(r.brand);
      toast(t('saved'));
    } catch (err) {
      const e2 = err as ApiError;
      const fields = (e2.details as any)?.fieldErrors;
      setError(fields ? Object.keys(fields).join(', ') + ': ' + Object.values(fields).flat().join(' • ') : e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="settings" onSubmit={save}>
      <div className="col" style={{ gap: 16 }}>
        {error ? <div className="form-error">{error}</div> : null}
        <Section title={t('identity')}>
          <div className="form-grid">
            <Field label={t('nameAr')}>
              <input className="input" value={b.name} onChange={(e) => set('name', e.target.value)} required minLength={2} />
            </Field>
            <Field label={t('nameEn')}>
              <input className="input" value={b.nameEn ?? ''} onChange={(e) => set('nameEn', e.target.value)} dir="ltr" />
            </Field>
            <Field label={t('taglineAr')}>
              <input className="input" value={b.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} maxLength={140} />
            </Field>
            <Field label={t('taglineEn')}>
              <input className="input" value={b.taglineEn ?? ''} onChange={(e) => set('taglineEn', e.target.value)} maxLength={140} dir="ltr" />
            </Field>
            <Field label={t('logo')}>
              <ImageInput brandId={b.id} value={b.logoUrl} onChange={(v) => set('logoUrl', v)} />
            </Field>
            <Field label={t('cover')}>
              <ImageInput brandId={b.id} value={b.coverUrl} onChange={(v) => set('coverUrl', v)} wide />
            </Field>
            <div className="field full">
              <span>{t('gallery')}</span>
              <div className="row wrap">
                {b.gallery.map((g) => (
                  <div key={g} className="col" style={{ gap: 4, alignItems: 'center' }}>
                    <div className="image-slot">
                      <div className="thumb" style={{ backgroundImage: `url("${g}")` }} />
                    </div>
                    <button type="button" className="btn link sm" onClick={() => set('gallery', b.gallery.filter((x) => x !== g))}>
                      {t('remove')}
                    </button>
                  </div>
                ))}
                {b.gallery.length < 12 ? <ImageInput brandId={b.id} value={null} onChange={(v) => v && set('gallery', [...b.gallery, v])} /> : null}
              </div>
            </div>
          </div>
        </Section>

        <Section title={t('colors')}>
          <div className="row wrap" style={{ gap: 10 }}>
            {PRESETS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => set('theme', p)}
                aria-label={`preset ${i + 1}`}
                style={{ width: 54, height: 54, borderRadius: 16, border: '2px solid var(--line-2)', background: `linear-gradient(135deg, ${p.background} 55%, ${p.primary} 55%)`, cursor: 'pointer' }}
              />
            ))}
          </div>
          <div className="form-grid">
            {(['primary', 'background', 'surface', 'text'] as const).map((k) => (
              <Field key={k} label={t(k === 'primary' ? 'primaryColor' : k === 'background' ? 'backgroundColor' : k === 'surface' ? 'surfaceColor' : 'textColor')}>
                <div className="row" style={{ gap: 8 }}>
                  <input className="input" type="color" value={b.theme[k]} onChange={(e) => set('theme', { ...b.theme, [k]: e.target.value.toUpperCase() })} />
                  <input className="input num" value={b.theme[k]} onChange={(e) => set('theme', { ...b.theme, [k]: e.target.value })} pattern="#[0-9a-fA-F]{6}" dir="ltr" />
                </div>
              </Field>
            ))}
          </div>
        </Section>

        <Section title={t('social')}>
          <div className="form-grid">
            {(['instagram', 'facebook', 'tiktok', 'x', 'snapchat', 'website'] as const).map((k) => (
              <Field key={k} label={k === 'website' ? t('website') : k[0].toUpperCase() + k.slice(1)}>
                <input className="input" type="url" placeholder="https://" value={b.social[k] ?? ''} onChange={(e) => setSocial(k, e.target.value)} dir="ltr" />
              </Field>
            ))}
            <Field label={t('whatsapp')}>
              <input className="input" placeholder="+201000000000" value={b.social.whatsapp ?? ''} onChange={(e) => setSocial('whatsapp', e.target.value.replace(/[^\d+]/g, ''))} dir="ltr" />
            </Field>
          </div>
        </Section>

        <Section title={t('googleReview')}>
          <Field label={t('googleReview')} hint={t('googleReviewHelp')}>
            <input className="input" type="url" placeholder="https://g.page/r/…/review" value={b.googleReviewUrl ?? ''} onChange={(e) => set('googleReviewUrl', e.target.value)} dir="ltr" />
          </Field>
        </Section>

        <Section title={t('notifications')}>
          <div className="form-grid">
            <Field label={t('readyMessageAr')}>
              <input className="input" value={b.notificationSettings.readyBodyAr} onChange={(e) => setNs('readyBodyAr', e.target.value)} maxLength={160} required />
            </Field>
            <Field label={t('readyMessageEn')}>
              <input className="input" value={b.notificationSettings.readyBodyEn} onChange={(e) => setNs('readyBodyEn', e.target.value)} maxLength={160} required dir="ltr" />
            </Field>
            <div className="full">
              <Toggle checked={b.notificationSettings.autoReminder} onChange={(v) => setNs('autoReminder', v)} label={t('autoReminder')} />
            </div>
            <Field label={t('reminderAfter')}>
              <input className="input" type="number" min={1} max={60} value={b.notificationSettings.autoReminderAfterMinutes} onChange={(e) => setNs('autoReminderAfterMinutes', Number(e.target.value))} />
            </Field>
            <Field label={t('maxReminders')}>
              <input className="input" type="number" min={0} max={5} value={b.notificationSettings.maxReminders} onChange={(e) => setNs('maxReminders', Number(e.target.value))} />
            </Field>
            <div className="full">
              <Toggle checked={b.notificationSettings.alertSound} onChange={(v) => setNs('alertSound', v)} label={t('alertSound')} />
            </div>
          </div>
        </Section>

        <Section title={t('regional')}>
          <div className="form-grid">
            <Field label={t('defaultLanguage')}>
              <select className="select" value={b.defaultLocale} onChange={(e) => set('defaultLocale', e.target.value as 'ar' | 'en')}>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </Field>
            <Field label={t('currency')}>
              <input className="input" value={b.currency} onChange={(e) => set('currency', e.target.value.toUpperCase().slice(0, 3))} maxLength={3} dir="ltr" />
            </Field>
            <Field label={t('timezone')} className="full">
              <input className="input" value={b.timezone} onChange={(e) => set('timezone', e.target.value)} list="tz-list" dir="ltr" />
              <datalist id="tz-list">
                {['Africa/Cairo', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Amman', 'Asia/Baghdad', 'Africa/Casablanca', 'Europe/London', 'UTC'].map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </Field>
          </div>
        </Section>

        <div className="sticky-save">
          <Button variant="red" size="lg" loading={busy} type="submit">
            {t('save')}
          </Button>
        </div>
      </div>

      <aside className="col" style={{ position: 'sticky', top: 90 }}>
        <span className="section-title">{t('preview')}</span>
        <BrandPreview brand={b} />
      </aside>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card col" style={{ gap: 14 }}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** Live mini-preview of the customer page with the current colours. */
function BrandPreview({ brand }: { brand: Brand }) {
  const { t, pick } = useI18n();
  const name = pick(brand.name, brand.nameEn);
  return (
    <div className="phone-frame">
      <div className="inner cx" style={{ ...themeVars(brand.theme), minHeight: '100%', display: 'block' }}>
        <div className="cx-hero" style={{ height: 120, ...(brand.coverUrl ? { backgroundImage: `url("${brand.coverUrl}")` } : {}) }} />
        <div className="cx-id" style={{ marginTop: -46 }}>
          <div className="cx-logo" style={{ width: 70, height: 70, fontSize: 28, ...(brand.logoUrl ? { backgroundImage: `url("${brand.logoUrl}")` } : {}) }}>
            {brand.logoUrl ? null : name.slice(0, 1)}
          </div>
          <h1 style={{ fontSize: 18 }}>{name}</h1>
          <p style={{ fontSize: 12 }}>{pick(brand.tagline, brand.taglineEn)}</p>
        </div>
        <div className="cx-body" style={{ padding: 12 }}>
          <div className="cx-card cx-status" style={{ padding: 14 }}>
            <div className="ord" style={{ fontSize: 36 }} dir="ltr">
              #128
            </div>
            <h2 style={{ fontSize: 16, margin: '10px 0 2px' }}>{t('statusPreparing')}</h2>
            <div className="cx-steps" style={{ marginTop: 10 }}>
              <div className="cx-step done now"><i />{t('step1')}</div>
              <div className="cx-step"><i />{t('step2')}</div>
              <div className="cx-step"><i />{t('step3')}</div>
            </div>
          </div>
          <div className="cx-card cx-status" style={{ background: 'var(--c-primary)', color: '#fff', padding: 14 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>{t('readyBig')}</h2>
            <p style={{ fontSize: 13 }}>{t('readyBigSub')}</p>
          </div>
          <button type="button" className="cx-btn" style={{ minHeight: 44, fontSize: 14 }}>
            {t('openOrder')}
          </button>
        </div>
      </div>
    </div>
  );
}
