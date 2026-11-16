import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { Button, Field } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../state/session';
import { AuthArt } from './Login';

export default function Register() {
  const { t, lang, toggle } = useI18n();
  const session = useSession();
  const nav = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', brandName: '', branchName: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  if (session.status === 'ready') return <Navigate to="/app/orders" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/auth/register', { auth: false, body: { ...form, branchName: form.branchName || undefined, locale: lang } });
      session.signIn(r);
      nav('/app/brand');
    } catch (err) {
      const e2 = err as ApiError;
      setError(e2.code === 'email_taken' ? t('emailTaken') : e2.code === 'network' ? t('networkError') : e2.code === 'validation_error' ? t('passwordHint') : e2.message);
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
          <div style={{ marginTop: 16 }}>
            <h1>{t('startTrial')}</h1>
            <p className="muted">{t('registerSubtitle')}</p>
          </div>
          {error ? <div className="form-error">{error}</div> : null}
          <Field label={t('brandName')}>
            <input className="input" required minLength={2} value={form.brandName} onChange={set('brandName')} />
          </Field>
          <Field label={`${t('branchName')} (${t('optional')})`}>
            <input className="input" value={form.branchName} onChange={set('branchName')} />
          </Field>
          <Field label={t('fullName')}>
            <input className="input" required minLength={2} autoComplete="name" value={form.fullName} onChange={set('fullName')} />
          </Field>
          <Field label={t('email')}>
            <input className="input" type="email" required autoComplete="email" value={form.email} onChange={set('email')} dir="ltr" />
          </Field>
          <Field label={t('password')} hint={t('passwordHint')}>
            <input className="input" type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} dir="ltr" />
          </Field>
          <Button variant="red" size="lg" loading={busy} type="submit">
            {t('register')}
          </Button>
          <p className="small muted center">
            {t('haveAccount')} <Link to="/login">{t('login')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
