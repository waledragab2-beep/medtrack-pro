import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import { Logo } from '../../components/Logo';
import { PageLoading, useOnline } from '../../components/ui';
import { useI18n, type Key } from '../../lib/i18n';
import { isAdmin, useSession } from '../../state/session';
import { useState } from 'react';

const NAV: { to: string; label: Key; icon: IconName; admin?: boolean }[] = [
  { to: 'orders', label: 'navOrders', icon: 'orders' },
  { to: 'history', label: 'navHistory', icon: 'history' },
  { to: 'analytics', label: 'navAnalytics', icon: 'chart', admin: true },
  { to: 'brand', label: 'navBrand', icon: 'brand', admin: true },
  { to: 'menu', label: 'navMenu', icon: 'menu', admin: true },
  { to: 'offers', label: 'navOffers', icon: 'offer', admin: true },
  { to: 'branches', label: 'navBranches', icon: 'qr', admin: true },
  { to: 'staff', label: 'navStaff', icon: 'staff', admin: true },
];

export default function AppLayout() {
  const { t, toggle, pick } = useI18n();
  const s = useSession();
  const online = useOnline();
  const loc = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  if (!s.me || !s.brand) return <PageLoading />;

  const nav = NAV.filter((n) => !n.admin || isAdmin(s.role));
  const current = nav.find((n) => loc.pathname.endsWith(n.to));
  const primaryTabs = nav.slice(0, 4);
  const moreTabs = nav.slice(4);
  const branchSwitch = s.branches.length > 1 && !s.lockedBranchId;

  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo light />
        <div className="brand-switch">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: s.brand.logoUrl ? `center/cover url("${s.brand.logoUrl}")` : 'var(--red)', flexShrink: 0 }} />
          {s.me.memberships.length > 1 ? (
            <select value={s.brandId ?? ''} onChange={(e) => s.setBrandId(e.target.value)} aria-label="brand">
              {s.me.memberships.map((m) => (
                <option key={m.brandId} value={m.brandId}>
                  {pick(m.name, m.nameEn)}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pick(s.brand.name, s.brand.nameEn)}</div>
              <div className="tiny" style={{ color: '#a5a5a0' }}>{t(`role_${s.role!}` as Key)}</div>
            </div>
          )}
        </div>
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} className="nav-link">
            <Icon name={n.icon} />
            {t(n.label)}
          </NavLink>
        ))}
        <div className="foot">
          {s.brand.subscriptionStatus === 'trialing' && s.brand.trialEndsAt ? (
            <div className="tiny" style={{ color: '#a5a5a0', padding: '0 12px' }}>
              {t('trialEnds')}: {new Date(s.brand.trialEndsAt).toLocaleDateString()}
            </div>
          ) : null}
          <button className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={toggle}>
            <Icon name="globe" />
            {t('language')}
          </button>
          <button className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => void s.signOut()}>
            <Icon name="logout" />
            {t('logout')}
          </button>
          <div className="tiny" style={{ color: '#77776f', padding: '0 12px' }}>{s.me.user.email}</div>
        </div>
      </aside>

      <div className="main">
        {!online ? (
          <div className="banner red">
            <Icon name="wifiOff" />
            {t('offline')}
          </div>
        ) : null}
        {s.brand.isDemo ? (
          <div className="banner dark">
            <span className="chip red">{t('demoBadge')}</span>
            <span className="small">{t('demoNotice')}</span>
          </div>
        ) : null}
        <header className="topbar">
          <h1 className="grow">{current ? t(current.label) : ''}</h1>
          {branchSwitch ? (
            <select className="select" style={{ width: 'auto', minHeight: 40 }} value={s.branchId ?? ''} onChange={(e) => s.setBranchId(e.target.value)} aria-label={t('branch')}>
              {s.branches.filter((b) => b.isActive).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="chip">{s.branches.find((b) => b.id === s.branchId)?.name}</span>
          )}
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="tabbar" style={{ gridTemplateColumns: `repeat(${primaryTabs.length + 1}, 1fr)` }}>
        {primaryTabs.map((n) => (
          <NavLink key={n.to} to={n.to}>
            <Icon name={n.icon} />
            {t(n.label)}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(true)}>
          <Icon name="more" />
          {t('navMore')}
        </button>
      </nav>
      {moreOpen ? (
        <div className="modal-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="body">
              {moreTabs.map((n) => (
                <NavLink key={n.to} to={n.to} className="btn ghost lg" onClick={() => setMoreOpen(false)} style={{ justifyContent: 'flex-start' }}>
                  <Icon name={n.icon} />
                  {t(n.label)}
                </NavLink>
              ))}
              <button className="btn ghost lg" style={{ justifyContent: 'flex-start' }} onClick={toggle}>
                <Icon name="globe" /> {t('language')}
              </button>
              <button className="btn ghost lg" style={{ justifyContent: 'flex-start' }} onClick={() => void s.signOut()}>
                <Icon name="logout" /> {t('logout')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
