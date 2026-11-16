import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { Button, Field, Modal, PageLoading, useToast } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { useI18n, type Key } from '../../lib/i18n';
import { useSession } from '../../state/session';
import type { Role } from '../../state/types';

interface Member { id: string; email: string; fullName: string; role: Role; branchId: string | null; isActive: boolean; lastLoginAt: string | null }

export default function Staff() {
  const { t, lang } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [staff, setStaff] = useState<Member[] | null>(null);
  const [adding, setAdding] = useState(false);
  const base = `/brands/${s.brandId}/staff`;
  const load = useCallback(() => api<{ staff: Member[] }>(base).then((r) => setStaff(r.staff)), [base]);
  useEffect(() => void load(), [load]);

  const canEdit = (m: Member) => m.id !== s.me?.user.id && (s.role === 'owner' || m.role === 'cashier');
  const patch = async (m: Member, body: Record<string, unknown>) => {
    await api(`${base}/${m.id}`, { method: 'PATCH', body }).catch((e: ApiError) => toast(e.message, 'error'));
    void load();
  };

  if (!staff) return <PageLoading />;
  return (
    <>
      <div className="row between wrap">
        <p className="small muted">{t('permissionsHelp')}</p>
        <Button variant="red" onClick={() => setAdding(true)}>
          <Icon name="plus" /> {t('addStaff')}
        </Button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t('fullName')}</th>
              <th>{t('email')}</th>
              <th>{t('role')}</th>
              <th>{t('branch')}</th>
              <th>{t('lastLogin')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {staff.map((m) => (
              <tr key={m.id} style={{ opacity: m.isActive ? 1 : 0.5 }}>
                <td style={{ fontWeight: 600 }}>{m.fullName}</td>
                <td dir="ltr" style={{ textAlign: 'start' }}>{m.email}</td>
                <td>
                  {canEdit(m) ? (
                    <select className="select" style={{ minHeight: 36, width: 'auto' }} value={m.role} onChange={(e) => patch(m, { role: e.target.value })}>
                      {(s.role === 'owner' ? (['owner', 'manager', 'cashier'] as Role[]) : (['cashier'] as Role[])).map((r) => (
                        <option key={r} value={r}>
                          {t(`role_${r}` as Key)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`chip ${m.role === 'owner' ? 'dark' : ''}`}>{t(`role_${m.role}` as Key)}</span>
                  )}
                </td>
                <td>
                  {canEdit(m) ? (
                    <select className="select" style={{ minHeight: 36, width: 'auto' }} value={m.branchId ?? ''} onChange={(e) => patch(m, { branchId: e.target.value || null })}>
                      <option value="">{t('anyBranch')}</option>
                      {s.branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    s.branches.find((b) => b.id === m.branchId)?.name ?? t('anyBranch')
                  )}
                </td>
                <td className="muted small">{dateTime(m.lastLoginAt, lang)}</td>
                <td>
                  {canEdit(m) ? (
                    <div className="row" style={{ gap: 6 }}>
                      <Button variant="ghost" size="sm" onClick={() => patch(m, { isActive: !m.isActive })}>
                        {m.isActive ? t('disable') : t('enable')}
                      </Button>
                      {s.role === 'owner' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="icon"
                          aria-label={t('delete')}
                          onClick={async () => {
                            if (!window.confirm(`${t('delete')} ${m.fullName}?`)) return;
                            await api(`${base}/${m.id}`, { method: 'DELETE' });
                            void load();
                          }}
                        >
                          <Icon name="trash" size={16} />
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding ? <AddStaff onClose={() => setAdding(false)} onSaved={load} /> : null}
    </>
  );
}

function AddStaff({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const s = useSession();
  const [f, setF] = useState({ fullName: '', email: '', role: 'cashier' as Role, branchId: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/brands/${s.brandId}/staff`, { body: { ...f, branchId: f.branchId || null, password: f.password || undefined } });
      onSaved();
      onClose();
    } catch (err) {
      const e2 = err as ApiError;
      setError(e2.code === 'validation_error' ? t('passwordHint') : e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={t('addStaff')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="red" loading={busy} type="submit" form="staff-form">
            {t('add')}
          </Button>
        </>
      }
    >
      <form id="staff-form" className="form-grid" onSubmit={save}>
        {error ? <div className="form-error full">{error}</div> : null}
        <Field label={t('fullName')}>
          <input className="input" required minLength={2} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
        </Field>
        <Field label={t('email')}>
          <input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} dir="ltr" />
        </Field>
        <Field label={t('role')}>
          <select className="select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {(s.role === 'owner' ? (['cashier', 'manager', 'owner'] as Role[]) : (['cashier'] as Role[])).map((r) => (
              <option key={r} value={r}>
                {t(`role_${r}` as Key)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('branch')}>
          <select className="select" value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>
            <option value="">{t('anyBranch')}</option>
            {s.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('initialPassword')} hint={t('initialPasswordHelp')} className="full">
          <input className="input" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} dir="ltr" autoComplete="new-password" />
        </Field>
      </form>
    </Modal>
  );
}
