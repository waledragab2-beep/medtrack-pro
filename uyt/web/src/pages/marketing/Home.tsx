import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import { Logo } from '../../components/Logo';
import { useI18n, type Key } from '../../lib/i18n';
import { useSession } from '../../state/session';
import { themeVars } from '../public/BrandSections';

/** Public product page (sells the monthly subscription). */
export default function Home() {
  const { t, toggle, lang } = useI18n();
  const s = useSession();
  const features: [IconName, Key][] = [
    ['bell', 'f1'],
    ['orders', 'f2'],
    ['brand', 'f3'],
    ['chart', 'f4'],
    ['star', 'f5'],
    ['shield', 'f6'],
  ];
  // Indicative pricing (assumption) – clearly labelled on the page.
  const plans: { key: Key; desc: Key; price: string; featured?: boolean }[] = [
    { key: 'planStarter', desc: 'planStarterDesc', price: lang === 'ar' ? '499 ج.م' : 'EGP 499' },
    { key: 'planPro', desc: 'planProDesc', price: lang === 'ar' ? '999 ج.م' : 'EGP 999', featured: true },
    { key: 'planBusiness', desc: 'planBusinessDesc', price: lang === 'ar' ? '1,999 ج.م' : 'EGP 1,999' },
  ];

  return (
    <div style={{ background: 'var(--bg)' }}>
      <nav className="mk-nav">
        <Logo light />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm" style={{ background: 'transparent', borderColor: '#333' }} onClick={toggle}>
            {t('language')}
          </button>
          {s.status === 'ready' ? (
            <Link className="btn red sm" to="/app/orders">
              {t('navOrders')}
            </Link>
          ) : (
            <>
              <Link className="btn sm hide-sm" style={{ background: 'transparent', borderColor: '#333' }} to="/login">
                {t('login')}
              </Link>
              <Link className="btn red sm" to="/register">
                {t('ctaStart')}
              </Link>
            </>
          )}
        </div>
      </nav>

      <header className="mk-hero">
        <div>
          <span className="chip red" style={{ marginBottom: 18 }}>
            <Icon name="bolt" size={14} /> {t('tagline')}
          </span>
          <h1>
            {t('heroTitle')}
            <em>{t('heroTitle2')}</em>
          </h1>
          <p>{t('heroSub')}</p>
          <div className="row wrap" style={{ marginTop: 32 }}>
            <Link className="btn red lg" to="/register">
              {t('ctaStart')}
            </Link>
            <Link className="btn light lg" to="/s/demo">
              {t('ctaDemo')}
            </Link>
          </div>
        </div>
        <PhoneMock />
      </header>

      <section className="mk-section">
        <div className="mk-steps">
          {(['how1', 'how2', 'how3'] as Key[]).map((k, i) => (
            <div className="mk-step" key={k}>
              <b>0{i + 1}</b>
              <h3 style={{ fontSize: 20 }}>{t(k)}</h3>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section" style={{ paddingTop: 0 }}>
        <h2>{t('featuresTitle')}</h2>
        <div className="mk-features">
          {features.map(([icon, k]) => (
            <div className="mk-feature" key={k}>
              <Icon name={icon} />
              <span>{t(k)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section" style={{ paddingTop: 0 }}>
        <h2>{t('pricingTitle')}</h2>
        <div className="mk-plans">
          {plans.map((p) => (
            <div key={p.key} className={`mk-plan ${p.featured ? 'featured' : ''}`}>
              <h3 style={{ fontSize: 20 }}>{t(p.key)}</h3>
              <div>
                <span className="price">{p.price}</span> <span className="muted">{t('perMonth')}</span>
              </div>
              <p style={{ opacity: 0.8 }}>{t(p.desc)}</p>
              <Link className={`btn ${p.featured ? 'red' : 'ghost'} block`} to="/register" style={{ marginTop: 'auto' }}>
                {t('startTrial')}
              </Link>
            </div>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 12 }}>
          {t('pricingNote')}
        </p>
      </section>

      <footer style={{ background: 'var(--ink)', color: '#888', padding: '32px clamp(16px,5vw,64px)' }} className="row between wrap">
        <Logo light size={26} />
        <span className="small">© {new Date().getFullYear()} UYT</span>
      </footer>
    </div>
  );
}

function PhoneMock() {
  const { t } = useI18n();
  return (
    <div className="phone-frame" style={{ borderColor: '#222', transform: 'rotate(-3deg)', ...themeVars({ primary: '#E10600', background: '#0A0A0A', surface: '#161616', text: '#FFFFFF' }) }}>
      <div className="cx-ready" style={{ position: 'absolute', animation: 'none' }}>
        <div className="bell" style={{ width: 90, height: 90 }}>
          <Icon name="bell" size={44} />
        </div>
        <div className="ord" style={{ fontSize: 64 }} dir="ltr">
          #128
        </div>
        <h1 style={{ fontSize: 40 }}>{t('readyBig')}</h1>
        <p style={{ fontSize: 17 }}>{t('readyBigSub')}</p>
      </div>
    </div>
  );
}
