import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { Button, Field } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../state/session';

export function AuthArt() {
  const { t } = useI18n();
  return (
    <div className="art">
      <Logo light />
      <div>
        <h2>
          {t('heroTitle')}
          <br />
          <span style={{ color: 'var(--red)' }}>{t('heroTitle2')}</span>
        </h2>
        <p style={{ color: '#bdbdb8', marginTop: 16, maxWidth: 420 }}>{t('heroSub')}</p>
      </div>
      <div className="ring" />
    </div>
  );
}

export default function Login() {
  const { t, toggle } = useI18n();
  const session = useSession();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (session.status === 'ready') return <Navigate to="/app/orders" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      session.signIn(await api('/auth/login', { body: { email, password }, auth: false }));
      nav('/app/orders');
    } catch (err) {
      const e2 = err as ApiError;
      setError(e2.code === 'invalid_credentials' ? t('invalidCredentials') : e2.code === 'network' ? t('networkError') : e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <AuthArt />
      <div className="panel">
        <form onSubmit={submit}>
          <div className="row between">
            <Link to="/" style={{ textDecoration: 'none' }}>
              <Logo />
            </Link>
            <button type="button" className="btn ghost sm" onClick={toggle}>
              {t('language')}
            </button>
          </div>
          <div style={{ marginTop: 24 }}>
            <h1>{t('welcomeBack')}</h1>
            <p className="muted">{t('loginSubtitle')}</p>
          </div>
          {error ? <div className="form-error">{error}</div> : null}
          <Field label={t('email')}>
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t('password')}>
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
          </Field>
          <Button variant="red" size="lg" loading={busy} type="submit">
            {t('login')}
          </Button>
          <p className="small muted center">
            {t('noAccount')} <Link to="/register">{t('register')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
