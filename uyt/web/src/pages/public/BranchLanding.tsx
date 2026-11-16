import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { PageLoading } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { deviceStore } from '../../lib/device';
import { useBrandDefaultLang, useI18n } from '../../lib/i18n';
import { registerServiceWorker } from '../../lib/push';
import { unlockAudio } from '../../lib/sound';
import type { BrandContent, PublicBranch, PublicBrand } from '../../state/types';
import { BrandExtras, BrandShell, CenteredMessage } from './BrandSections';

type Data = { brand: PublicBrand & { defaultLocale?: string }; branch: PublicBranch } & BrandContent;

const toLatinDigits = (v: string) => v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

/** Landing page behind the static store QR: customer enters the order number to link this phone. */
export default function BranchLanding() {
  const { slug = '' } = useParams();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useBrandDefaultLang(data?.brand.defaultLocale);

  useEffect(() => {
    void registerServiceWorker();
    api<Data>(`/public/branches/${encodeURIComponent(slug)}`, { auth: false })
      .then((d) => {
        setData(d);
        document.title = d.brand.name;
      })
      .catch((e: ApiError) => e.status === 404 && setMissing(true));
  }, [slug]);

  if (missing) return <CenteredMessage icon="x" title={t('storeNotFound')} />;
  if (!data) return <PageLoading />;

  const recent = deviceStore.recent().filter((o) => o.branchSlug === slug);

  async function submit(e: FormEvent) {
    e.preventDefault();
    unlockAudio(); // user gesture – lets the page ring later
    setBusy(true);
    setError('');
    try {
      const r = await api<{ orderId: string; deviceToken: string }>(`/public/branches/${encodeURIComponent(slug)}/claim`, {
        auth: false,
        body: { orderNumber: toLatinDigits(number.trim()), claimCode: code ? toLatinDigits(code) : undefined, platform: 'web', locale: lang },
      });
      deviceStore.save({ orderId: r.orderId, token: r.deviceToken, orderNumber: number.trim(), brandName: data!.brand.name, branchSlug: slug, linkedAt: new Date().toISOString() });
      nav(`/o/${r.orderId}`, { state: { fresh: true } });
    } catch (err) {
      const e2 = err as ApiError;
      setError(
        e2.code === 'order_not_found'
          ? t('orderNotFound')
          : e2.code === 'invalid_claim_code'
            ? t('invalidCode')
            : e2.code === 'order_already_linked'
              ? t('alreadyLinked')
              : e2.code === 'network'
                ? t('networkError')
                : e2.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <BrandShell brand={data.brand}>
      <form className="cx-card col" style={{ gap: 14 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>
          <Icon name="bell" /> {t('trackYourOrder')}
        </h2>
        <p className="cx-muted small" style={{ marginTop: -6 }}>
          {t('enterOrderNumber')}
        </p>
        <input
          className="cx-input"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="#"
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          dir="ltr"
          aria-label={t('orderNumber')}
          required
        />
        {data.branch.requireClaimCode ? (
          <input
            className="cx-input code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d٠-٩]/g, '').slice(0, 4))}
            placeholder={t('orderCode')}
            inputMode="numeric"
            dir="ltr"
            aria-label={t('orderCode')}
            required
          />
        ) : null}
        {error ? <div className="cx-error">{error}</div> : null}
        <button className="cx-btn" disabled={busy || !number.trim()}>
          {busy ? <span className="spinner" /> : <Icon name="arrow" style={{ transform: lang === 'ar' ? 'scaleX(-1)' : undefined }} />}
          {t('openOrder')}
        </button>
      </form>

      {recent.length ? (
        <div className="cx-card cx-recent">
          <h2>{t('yourOrders')}</h2>
          {recent.map((o) => (
            <Link key={o.orderId} to={`/o/${o.orderId}`}>
              <span>
                {t('order')} <b className="num"><bdi dir="ltr">#{o.orderNumber}</bdi></b>
              </span>
              <span className="cx-muted small">{new Date(o.linkedAt).toLocaleTimeString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <BrandExtras brand={data.brand} branch={data.branch} content={data} />
    </BrandShell>
  );
}
