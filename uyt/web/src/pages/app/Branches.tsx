import { useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { QR, qrDataUrl } from '../../components/QR';
import { Button, Field, Modal, Toggle, useToast } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../state/session';
import type { Branch } from '../../state/types';

type Draft = Partial<Omit<Branch, 'id' | 'slug' | 'qrUrl'>>;

export default function Branches() {
  const { t } = useI18n();
  const s = useSession();
  const [editing, setEditing] = useState<Branch | 'new' | null>(null);

  return (
    <>
      <div className="row between">
        <p className="muted">{t('storeQrHelp')}</p>
        <Button variant="red" onClick={() => setEditing('new')}>
          <Icon name="plus" /> {t('addBranch')}
        </Button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {s.branches.map((b) => (
          <BranchCard key={b.id} branch={b} onEdit={() => setEditing(b)} />
        ))}
      </div>
      {editing ? <BranchForm branch={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function BranchCard({ branch, onEdit }: { branch: Branch; onEdit: () => void }) {
  const { t, pick } = useI18n();
  const s = useSession();
  const toast = useToast();

  async function download() {
    const a = document.createElement('a');
    a.href = await qrDataUrl(branch.qrUrl, 1200);
    a.download = `uyt-qr-${branch.slug}.png`;
    a.click();
  }

  async function poster() {
    const qr = await qrDataUrl(branch.qrUrl, 900);
    const brand = s.brand!;
    const w = window.open('', '_blank');
    if (!w) return;
    const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>QR – ${esc(branch.name)}</title>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@500;700&display=swap" rel="stylesheet">
      <style>@page{size:A5;margin:0}body{margin:0;font-family:'IBM Plex Sans Arabic',sans-serif;background:#fff}
      .p{width:148mm;height:210mm;box-sizing:border-box;padding:14mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;border-top:10mm solid ${brand.theme.primary}}
      h1{font-size:30px;margin:0}h2{font-size:22px;margin:0}p{margin:0;color:#555;font-size:14px}img.qr{width:100mm;height:100mm}
      .logo{width:22mm;height:22mm;border-radius:6mm;object-fit:cover}.f{font-size:11px;color:#999;letter-spacing:.1em}</style></head>
      <body><div class="p">${brand.logoUrl ? `<img class="logo" src="${esc(brand.logoUrl)}">` : ''}
      <div><h1>${esc(pick(brand.name, brand.nameEn))}</h1><p>${esc(branch.name)}</p></div>
      <img class="qr" src="${qr}"><div><h2>امسح الكود لتتبع طلبك 🔔</h2><p>Scan to track your order — we'll ping your phone when it's ready</p></div>
      <div class="f">UYT</div></div><script>onload=()=>setTimeout(()=>print(),400)</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="card col" style={{ gap: 14, opacity: branch.isActive ? 1 : 0.6 }}>
      <div className="row between">
        <div>
          <h3>{branch.name}</h3>
          <div className="small muted">{branch.address || '—'}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          {t('edit')}
        </Button>
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <QR value={branch.qrUrl} size={140} />
        <div className="col small" style={{ gap: 6 }}>
          <span className="chip">
            <Icon name="clock" size={14} /> {branch.avgPrepMinutes} {t('minutesShort')}
          </span>
          {branch.requireClaimCode ? <span className="chip dark">{t('orderCode')} ✓</span> : null}
          <span className="chip">
            <Icon name="phone" size={14} /> ≤ {branch.maxDevicesPerOrder}
          </span>
          {!branch.isActive ? <span className="chip red">{t('disabled')}</span> : null}
        </div>
      </div>
      <code className="tiny muted" style={{ wordBreak: 'break-all' }} dir="ltr">
        {branch.qrUrl}
      </code>
      <div className="row wrap" style={{ gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={download}>
          <Icon name="download" size={16} /> {t('downloadPng')}
        </Button>
        <Button variant="ghost" size="sm" onClick={poster}>
          <Icon name="print" size={16} /> {t('printPoster')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard.writeText(branch.qrUrl).then(() => toast(t('copied')))}>
          <Icon name="copy" size={16} /> {t('copyLink')}
        </Button>
        <a className="btn ghost sm" href={branch.qrUrl} target="_blank" rel="noreferrer">
          <Icon name="external" size={16} /> {t('openPage')}
        </a>
      </div>
    </div>
  );
}

function BranchForm({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  const { t } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [d, setD] = useState<Draft>(
    branch ?? { name: '', avgPrepMinutes: 7, latePickupMinutes: 5, requireClaimCode: false, maxDevicesPerOrder: 2, isActive: true },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD({ ...d, [k]: v });
  const numOrNull = (v: string) => (v === '' ? null : Number(v));

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      name: d.name,
      address: d.address || null,
      phone: d.phone || null,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      mapsUrl: d.mapsUrl || '',
      openingHours: d.openingHours || null,
      avgPrepMinutes: d.avgPrepMinutes,
      latePickupMinutes: d.latePickupMinutes,
      requireClaimCode: d.requireClaimCode,
      maxDevicesPerOrder: d.maxDevicesPerOrder,
      isActive: d.isActive,
    };
    try {
      if (branch) await api(`/brands/${s.brandId}/branches/${branch.id}`, { method: 'PATCH', body });
      else await api(`/brands/${s.brandId}/branches`, { body });
      await s.reloadBrand();
      toast(t('saved'));
      onClose();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={branch ? branch.name : t('addBranch')}
      onClose={onClose}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            {t('cancel')}
          </Button>
          <Button variant="red" loading={busy} type="submit" form="branch-form">
            {t('save')}
          </Button>
        </>
      }
    >
      <form id="branch-form" className="form-grid" onSubmit={save}>
        {error ? <div className="form-error full">{error}</div> : null}
        <Field label={t('branchName')} className="full">
          <input className="input" required minLength={2} value={d.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('address')} className="full">
          <input className="input" value={d.address ?? ''} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label={t('phone')}>
          <input className="input" value={d.phone ?? ''} onChange={(e) => set('phone', e.target.value)} dir="ltr" />
        </Field>
        <Field label={t('openingHours')}>
          <input className="input" value={d.openingHours ?? ''} onChange={(e) => set('openingHours', e.target.value)} placeholder="08:00 – 24:00" />
        </Field>
        <Field label={t('latitude')}>
          <input className="input" type="number" step="any" value={d.lat ?? ''} onChange={(e) => set('lat', numOrNull(e.target.value))} dir="ltr" />
        </Field>
        <Field label={t('longitude')}>
          <input className="input" type="number" step="any" value={d.lng ?? ''} onChange={(e) => set('lng', numOrNull(e.target.value))} dir="ltr" />
        </Field>
        <Field label={t('mapsUrl')} className="full">
          <input className="input" type="url" value={d.mapsUrl ?? ''} onChange={(e) => set('mapsUrl', e.target.value)} placeholder="https://maps.app.goo.gl/…" dir="ltr" />
        </Field>
        <Field label={t('avgPrep')}>
          <input className="input" type="number" min={1} max={180} value={d.avgPrepMinutes ?? 7} onChange={(e) => set('avgPrepMinutes', Number(e.target.value))} />
        </Field>
        <Field label={t('lateAfter')}>
          <input className="input" type="number" min={1} max={180} value={d.latePickupMinutes ?? 5} onChange={(e) => set('latePickupMinutes', Number(e.target.value))} />
        </Field>
        <Field label={t('maxDevices')}>
          <input className="input" type="number" min={1} max={5} value={d.maxDevicesPerOrder ?? 2} onChange={(e) => set('maxDevicesPerOrder', Number(e.target.value))} />
        </Field>
        <div className="full col" style={{ gap: 6 }}>
          <Toggle checked={Boolean(d.requireClaimCode)} onChange={(v) => set('requireClaimCode', v)} label={t('requireCode')} />
          <small className="muted">{t('requireCodeHelp')}</small>
        </div>
        <div className="full">
          <Toggle checked={d.isActive ?? true} onChange={(v) => set('isActive', v)} label={t('active')} />
        </div>
      </form>
    </Modal>
  );
}
