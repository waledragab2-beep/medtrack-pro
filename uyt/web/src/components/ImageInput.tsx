import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { Icon } from './Icon';
import { useToast } from './ui';

export function ImageInput({ brandId, value, onChange, wide }: { brandId: string; value?: string | null; onChange: (url: string | null) => void; wide?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await api<{ url: string }>(`/brands/${brandId}/uploads`, { form });
      onChange(r.url);
    } catch (e: any) {
      toast(e.message || t('error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="image-slot">
      <div className={`thumb ${wide ? 'wide' : ''}`} style={value ? { backgroundImage: `url("${value}")` } : undefined} />
      <div className="row wrap" style={{ gap: 8 }}>
        <button type="button" className="btn ghost sm" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name="camera" size={16} />}
          {busy ? t('uploading') : t('upload')}
        </button>
        {value ? (
          <button type="button" className="btn link sm" onClick={() => onChange(null)}>
            {t('remove')}
          </button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
