import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { LogoMark } from '../../components/Logo';
import { money } from '../../lib/format';
import { useI18n, type Key } from '../../lib/i18n';
import type { BrandContent, PublicBranch, PublicBrand, Theme } from '../../state/types';

export const themeVars = (t: Theme): CSSProperties =>
  ({ '--c-primary': t.primary, '--c-bg': t.background, '--c-surface': t.surface, '--c-text': t.text }) as CSSProperties;

/** Brand header used by every customer page (cover, logo, name, language switch). */
export function BrandShell({ brand, children }: { brand: PublicBrand; children: ReactNode }) {
  const { t, toggle, pick } = useI18n();
  const name = pick(brand.name, brand.nameEn);
  return (
    <div className="cx" style={themeVars(brand.theme)}>
      <div className="cx-wrap" style={{ position: 'relative' }}>
        {brand.isDemo ? <div className="cx-demo">{t('demoBadge')}</div> : null}
        <div className="cx-top" style={brand.isDemo ? { top: 26 } : undefined}>
          <span />
          <button className="cx-pill" onClick={toggle}>
            <Icon name="globe" size={15} /> {t('language')}
          </button>
        </div>
        <div className="cx-hero" style={brand.coverUrl ? { backgroundImage: `url("${brand.coverUrl}")` } : undefined} />
        <div className="cx-id">
          <div className="cx-logo" style={brand.logoUrl ? { backgroundImage: `url("${brand.logoUrl}")` } : undefined}>
            {brand.logoUrl ? null : name.slice(0, 1)}
          </div>
          <h1>{name}</h1>
          {pick(brand.tagline, brand.taglineEn) ? <p>{pick(brand.tagline, brand.taglineEn)}</p> : null}
        </div>
        <div className="cx-body">{children}</div>
        <div className="cx-foot" dir="ltr">
          <LogoMark size={16} /> {t('poweredBy')}
        </div>
      </div>
    </div>
  );
}

type Tab = 'offers' | 'menu' | 'social' | 'location';

/** Offers, menu, socials and location – shown under the order status. */
export function BrandExtras({ brand, branch, content }: { brand: PublicBrand; branch: PublicBranch; content: BrandContent }) {
  const { t } = useI18n();
  const socials = Object.entries(brand.social).filter(([, v]) => v);
  const hasLocation = Boolean(branch.lat != null || branch.mapsUrl || branch.address);
  const tabs = useMemo(
    () =>
      (
        [
          content.offers.length ? ['offers', 'offersSection'] : null,
          content.menu.items.length ? ['menu', 'menuSection'] : null,
          socials.length ? ['social', 'followUs'] : null,
          hasLocation ? ['location', 'ourLocation'] : null,
        ].filter(Boolean) as [Tab, Key][]
      ),
    [content, socials.length, hasLocation],
  );
  const [tab, setTab] = useState<Tab | null>(null);
  const active = tab ?? tabs[0]?.[0] ?? null;
  if (!tabs.length) return null;

  return (
    <>
      <div className="cx-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} className={active === id ? 'on' : ''} onClick={() => setTab(id)} role="tab" aria-selected={active === id}>
            {t(label)}
          </button>
        ))}
      </div>
      {active === 'offers' ? <Offers content={content} /> : null}
      {active === 'menu' ? <Menu content={content} currency={brand.currency} /> : null}
      {active === 'social' ? <Social social={brand.social} /> : null}
      {active === 'location' ? <Location branch={branch} gallery={brand.gallery} /> : null}
    </>
  );
}

function Offers({ content }: { content: BrandContent }) {
  const { pick } = useI18n();
  return (
    <div className="cx-offers">
      {content.offers.map((o) => (
        <div key={o.id} className={`cx-offer ${o.imageUrl ? 'has-img' : ''}`} style={o.imageUrl ? { backgroundImage: `url("${o.imageUrl}")` } : undefined}>
          {o.badge ? (
            <span className="badge" dir="ltr">
              {o.badge}
            </span>
          ) : null}
          <h3>{pick(o.title, o.titleEn)}</h3>
          {pick(o.description, o.descriptionEn) ? <p>{pick(o.description, o.descriptionEn)}</p> : null}
        </div>
      ))}
    </div>
  );
}

function Menu({ content, currency }: { content: BrandContent; currency: string }) {
  const { t, pick, lang } = useI18n();
  const groups = [
    ...content.menu.categories.map((c) => ({ id: c.id, name: pick(c.name, c.nameEn), items: content.menu.items.filter((i) => i.categoryId === c.id) })),
    { id: 'none', name: t('uncategorized'), items: content.menu.items.filter((i) => !i.categoryId || !content.menu.categories.some((c) => c.id === i.categoryId)) },
  ].filter((g) => g.items.length);
  return (
    <div className="cx-card">
      {groups.map((g) => (
        <div key={g.id}>
          <div className="cx-menu-cat">{g.name}</div>
          {g.items.map((i) => (
            <div className="cx-item" key={i.id}>
              {i.imageUrl ? <div className="img" style={{ backgroundImage: `url("${i.imageUrl}")` }} /> : null}
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{pick(i.name, i.nameEn)}</div>
                {pick(i.description, i.descriptionEn) ? <div className="cx-muted small">{pick(i.description, i.descriptionEn)}</div> : null}
              </div>
              <div className="price">{money(i.price, currency, lang)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const SOCIAL: Record<string, { icon: IconName; label: string }> = {
  instagram: { icon: 'instagram', label: 'Instagram' },
  facebook: { icon: 'facebook', label: 'Facebook' },
  tiktok: { icon: 'tiktok', label: 'TikTok' },
  x: { icon: 'x_social', label: 'X' },
  snapchat: { icon: 'sparkle', label: 'Snapchat' },
  website: { icon: 'globe', label: 'Website' },
  whatsapp: { icon: 'whatsapp', label: 'WhatsApp' },
};

function Social({ social }: { social: PublicBrand['social'] }) {
  return (
    <div className="cx-social">
      {Object.entries(social)
        .filter(([k, v]) => v && SOCIAL[k])
        .map(([k, v]) => (
          <a key={k} href={k === 'whatsapp' ? `https://wa.me/${String(v).replace(/\D/g, '')}` : String(v)} target="_blank" rel="noopener noreferrer">
            <Icon name={SOCIAL[k].icon} size={22} />
            {SOCIAL[k].label}
          </a>
        ))}
    </div>
  );
}

function Location({ branch, gallery }: { branch: PublicBranch; gallery: string[] }) {
  const { t } = useI18n();
  const q = branch.lat != null && branch.lng != null ? `${branch.lat},${branch.lng}` : branch.address ?? '';
  const mapsLink = branch.mapsUrl || (q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null);
  return (
    <div className="cx-card col" style={{ gap: 14 }}>
      <h2 style={{ margin: 0 }}>
        <Icon name="map" /> {branch.name}
      </h2>
      {q ? (
        <iframe
          className="cx-map"
          title={t('ourLocation')}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`}
        />
      ) : null}
      {branch.address ? <div className="cx-muted">{branch.address}</div> : null}
      {branch.openingHours ? (
        <div className="row small">
          <Icon name="clock" size={16} /> {t('hours')}: <span dir="ltr">{branch.openingHours}</span>
        </div>
      ) : null}
      <div className="row" style={{ gap: 10 }}>
        {mapsLink ? (
          <a className="cx-btn" href={mapsLink} target="_blank" rel="noopener noreferrer" style={{ minHeight: 50 }}>
            <Icon name="map" /> {t('openInMaps')}
          </a>
        ) : null}
        {branch.phone ? (
          <a className="cx-btn outline" href={`tel:${branch.phone}`} style={{ minHeight: 50, width: 'auto', padding: '0 18px' }}>
            <Icon name="phone" /> {t('call')}
          </a>
        ) : null}
      </div>
      {gallery.length ? (
        <div className="cx-gallery">
          {gallery.slice(0, 6).map((g) => (
            <div key={g} style={{ backgroundImage: `url("${g}")` }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CenteredMessage({ icon, title, sub, action }: { icon: IconName; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="cx" style={themeVars({ primary: '#E10600', background: '#0A0A0A', surface: '#161616', text: '#FFFFFF' })}>
      <div className="cx-wrap" style={{ justifyContent: 'center', padding: 24, gap: 16, textAlign: 'center', alignItems: 'center' }}>
        <div className="cx-logo" style={{ borderRadius: 30 }}>
          <Icon name={icon} size={40} />
        </div>
        <h1 style={{ fontSize: 22 }}>{title}</h1>
        {sub ? <p className="cx-muted">{sub}</p> : null}
        {action}
      </div>
    </div>
  );
}
