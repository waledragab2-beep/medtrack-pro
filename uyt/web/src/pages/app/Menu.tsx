import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../../components/Icon';
import { ImageInput } from '../../components/ImageInput';
import { Button, Field, Modal, PageLoading, Toggle, useToast } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { money } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../state/session';
import type { MenuCategory, MenuItem } from '../../state/types';

export default function MenuPage() {
  const { t, pick, lang } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [cats, setCats] = useState<MenuCategory[] | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [editItem, setEditItem] = useState<Partial<MenuItem> | null>(null);
  const [newCat, setNewCat] = useState('');
  const base = `/brands/${s.brandId}/menu`;

  const load = useCallback(async () => {
    const [c, i] = await Promise.all([api<{ items: MenuCategory[] }>(`${base}/categories`), api<{ items: MenuItem[] }>(`${base}/items`)]);
    setCats(c.items);
    setItems(i.items);
  }, [base]);
  useEffect(() => void load(), [load]);

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    if (!newCat.trim()) return;
    await api(`${base}/categories`, { body: { name: newCat.trim(), sort: cats?.length ?? 0 } });
    setNewCat('');
    void load();
  }

  async function removeCategory(c: MenuCategory) {
    if (!window.confirm(`${t('delete')} «${c.name}»?`)) return;
    await api(`${base}/categories/${c.id}`, { method: 'DELETE' });
    void load();
  }

  async function toggleAvailable(i: MenuItem) {
    await api(`${base}/items/${i.id}`, { method: 'PATCH', body: { isAvailable: !i.isAvailable } }).catch((e: ApiError) => toast(e.message, 'error'));
    void load();
  }

  if (!cats) return <PageLoading />;
  const groups = [...cats.map((c) => ({ cat: c as MenuCategory | null, items: items.filter((i) => i.categoryId === c.id) })), { cat: null, items: items.filter((i) => !i.categoryId) }];

  return (
    <>
      <div className="row wrap between">
        <form className="row" onSubmit={addCategory}>
          <input className="input" placeholder={t('addCategory')} value={newCat} onChange={(e) => setNewCat(e.target.value)} style={{ width: 220 }} />
          <Button variant="ghost" type="submit">
            <Icon name="plus" /> {t('addCategory')}
          </Button>
        </form>
        <Button variant="red" onClick={() => setEditItem({ isAvailable: true, categoryId: cats[0]?.id ?? null })}>
          <Icon name="plus" /> {t('addItem')}
        </Button>
      </div>
      {groups
        .filter((g) => g.cat || g.items.length)
        .map((g) => (
          <section key={g.cat?.id ?? 'none'} className="card col">
            <div className="row between">
              <h3>{g.cat ? pick(g.cat.name, g.cat.nameEn) : t('uncategorized')}</h3>
              {g.cat ? (
                <button className="btn link sm" onClick={() => removeCategory(g.cat!)}>
                  {t('delete')}
                </button>
              ) : null}
            </div>
            {g.items.length ? (
              g.items.map((i) => (
                <div key={i.id} className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 12, opacity: i.isAvailable ? 1 : 0.5 }}>
                  <div className="image-slot">
                    <div className="thumb" style={i.imageUrl ? { backgroundImage: `url("${i.imageUrl}")`, width: 52, height: 52 } : { width: 52, height: 52 }} />
                  </div>
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{pick(i.name, i.nameEn)}</div>
                    <div className="small muted">{pick(i.description, i.descriptionEn)}</div>
                  </div>
                  <span className="num" style={{ fontWeight: 700 }}>
                    {money(i.price, s.brand!.currency, lang)}
                  </span>
                  <Toggle checked={i.isAvailable} onChange={() => toggleAvailable(i)} label={<span className="small hide-sm">{t('available')}</span>} />
                  <Button variant="ghost" size="sm" onClick={() => setEditItem(i)}>
                    {t('edit')}
                  </Button>
                </div>
              ))
            ) : (
              <div className="empty">{t('noItems')}</div>
            )}
          </section>
        ))}
      {editItem ? <ItemForm item={editItem} cats={cats} onClose={() => setEditItem(null)} onSaved={load} /> : null}
    </>
  );
}

function ItemForm({ item, cats, onClose, onSaved }: { item: Partial<MenuItem>; cats: MenuCategory[]; onClose: () => void; onSaved: () => void }) {
  const { t, pick } = useI18n();
  const s = useSession();
  const [d, setD] = useState(item);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof MenuItem>(k: K, v: MenuItem[K] | null) => setD({ ...d, [k]: v });
  const base = `/brands/${s.brandId}/menu/items`;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = {
      name: d.name,
      nameEn: d.nameEn || null,
      description: d.description || null,
      descriptionEn: d.descriptionEn || null,
      price: d.price ?? null,
      imageUrl: d.imageUrl ?? '',
      categoryId: d.categoryId || null,
      isAvailable: d.isAvailable ?? true,
    };
    try {
      if (d.id) await api(`${base}/${d.id}`, { method: 'PATCH', body });
      else await api(base, { body });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!d.id || !window.confirm(t('delete') + '?')) return;
    await api(`${base}/${d.id}`, { method: 'DELETE' });
    onSaved();
    onClose();
  }

  return (
    <Modal
      title={d.id ? t('edit') : t('addItem')}
      onClose={onClose}
      footer={
        <>
          {d.id ? (
            <Button variant="ghost" type="button" onClick={remove} style={{ marginInlineEnd: 'auto', color: 'var(--red)' }}>
              {t('delete')}
            </Button>
          ) : null}
          <Button variant="ghost" type="button" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="red" loading={busy} type="submit" form="item-form">
            {t('save')}
          </Button>
        </>
      }
    >
      <form id="item-form" className="form-grid" onSubmit={save}>
        {error ? <div className="form-error full">{error}</div> : null}
        <Field label={t('nameAr')}>
          <input className="input" required value={d.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('nameEn')}>
          <input className="input" value={d.nameEn ?? ''} onChange={(e) => set('nameEn', e.target.value)} dir="ltr" />
        </Field>
        <Field label={t('description')}>
          <input className="input" value={d.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label={t('descriptionEn')}>
          <input className="input" value={d.descriptionEn ?? ''} onChange={(e) => set('descriptionEn', e.target.value)} dir="ltr" />
        </Field>
        <Field label={t('price')}>
          <input className="input num" type="number" min={0} step="0.01" value={d.price ?? ''} onChange={(e) => set('price', e.target.value === '' ? null : Number(e.target.value))} />
        </Field>
        <Field label={t('category')}>
          <select className="select" value={d.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value || null)}>
            <option value="">{t('uncategorized')}</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {pick(c.name, c.nameEn)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('image')} className="full">
          <ImageInput brandId={s.brandId!} value={d.imageUrl} onChange={(v) => set('imageUrl', v)} />
        </Field>
      </form>
    </Modal>
  );
}
