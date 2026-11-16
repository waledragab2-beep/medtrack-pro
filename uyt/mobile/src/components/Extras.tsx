import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Content, PublicBranch, PublicBrand } from '../lib/api';
import { useI18n, type Key } from '../lib/i18n';
import type { Palette } from '../lib/theme';
import { Btn, Card } from './ui';

type Tab = 'offers' | 'menu' | 'social' | 'location';
const SOCIAL_LABEL: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', x: 'X', snapchat: 'Snapchat', website: 'Website', whatsapp: 'WhatsApp' };

/** Offers, menu, social links and location under the order status. External links open in the browser / maps app. */
export function Extras({ brand, branch, content, p }: { brand: PublicBrand; branch: PublicBranch; content: Content; p: Palette }) {
  const { t, pick, lang } = useI18n();
  const socials = Object.entries(brand.social).filter(([k, v]) => v && SOCIAL_LABEL[k]);
  const hasLoc = branch.lat != null || !!branch.mapsUrl || !!branch.address;
  const tabs = ([
    content.offers.length ? ['offers', 'offers'] : null,
    content.menu.items.length ? ['menu', 'menu'] : null,
    socials.length ? ['social', 'followUs'] : null,
    hasLoc ? ['location', 'location'] : null,
  ].filter(Boolean) as [Tab, Key][]);
  const [tab, setTab] = useState<Tab | null>(null);
  const active = tab ?? tabs[0]?.[0];
  if (!tabs.length) return null;
  const price = (n: number | null) => (n == null ? '' : new Intl.NumberFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { style: 'currency', currency: brand.currency }).format(n));
  const q = branch.lat != null && branch.lng != null ? `${branch.lat},${branch.lng}` : branch.address ?? '';
  const maps = branch.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {tabs.map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[s.tab, { borderColor: p.line, backgroundColor: active === id ? p.text : p.surface }]}>
            <Text style={{ color: active === id ? p.background : p.text, fontWeight: '600' }}>{t(label)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {active === 'offers' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {content.offers.map((o) => (
            <View key={o.id} style={[s.offer, { backgroundColor: p.primary }]}>
              {o.imageUrl ? <Image source={{ uri: o.imageUrl }} style={StyleSheet.absoluteFill} /> : null}
              {o.badge ? <Text style={[s.badge, { color: p.primary }]}>{o.badge}</Text> : null}
              <Text style={s.offerTitle}>{pick(o.title, o.titleEn)}</Text>
              {pick(o.description, o.descriptionEn) ? <Text style={{ color: '#fff', opacity: 0.9 }}>{pick(o.description, o.descriptionEn)}</Text> : null}
            </View>
          ))}
        </ScrollView>
      ) : null}

      {active === 'menu' ? (
        <Card p={p}>
          {[...content.menu.categories.map((c) => ({ id: c.id, name: pick(c.name, c.nameEn) })), { id: null, name: '' }].map((c) => {
            const items = content.menu.items.filter((i) => (c.id ? i.categoryId === c.id : !i.categoryId));
            if (!items.length) return null;
            return (
              <View key={c.id ?? 'none'} style={{ gap: 4 }}>
                {c.name ? <Text style={{ color: p.muted, fontWeight: '700', marginTop: 6 }}>{c.name}</Text> : null}
                {items.map((i) => (
                  <View key={i.id} style={[s.item, { borderColor: p.line }]}>
                    {i.imageUrl ? <Image source={{ uri: i.imageUrl }} style={s.itemImg} /> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.text, fontWeight: '600' }}>{pick(i.name, i.nameEn)}</Text>
                      {pick(i.description, i.descriptionEn) ? <Text style={{ color: p.muted, fontSize: 13 }}>{pick(i.description, i.descriptionEn)}</Text> : null}
                    </View>
                    <Text style={{ color: p.text, fontWeight: '700' }}>{price(i.price)}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </Card>
      ) : null}

      {active === 'social' ? (
        <View style={{ gap: 8 }}>
          {socials.map(([k, v]) => (
            <Pressable key={k} onPress={() => Linking.openURL(k === 'whatsapp' ? `https://wa.me/${String(v).replace(/\D/g, '')}` : String(v))} style={[s.social, { backgroundColor: p.soft, borderColor: p.line }]}>
              <Text style={{ color: p.text, fontWeight: '600' }}>{SOCIAL_LABEL[k]}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {active === 'location' ? (
        <Card p={p}>
          <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>{branch.name}</Text>
          {branch.address ? <Text style={{ color: p.muted }}>{branch.address}</Text> : null}
          {branch.openingHours ? <Text style={{ color: p.muted }}>🕒 {branch.openingHours}</Text> : null}
          <Btn p={p} title={t('openInMaps')} onPress={() => Linking.openURL(maps)} />
          {branch.phone ? <Btn p={p} variant="outline" title={t('call')} onPress={() => Linking.openURL(`tel:${branch.phone}`)} /> : null}
        </Card>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  tab: { height: 40, paddingHorizontal: 16, borderRadius: 99, borderWidth: 1, justifyContent: 'center' },
  offer: { width: 280, minHeight: 150, borderRadius: 20, padding: 18, justifyContent: 'flex-end', overflow: 'hidden', gap: 4 },
  badge: { position: 'absolute', top: 14, start: 14, backgroundColor: '#fff', fontWeight: '800', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, overflow: 'hidden' },
  offerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  itemImg: { width: 56, height: 56, borderRadius: 12 },
  social: { padding: 14, borderRadius: 14, borderWidth: 1 },
});
