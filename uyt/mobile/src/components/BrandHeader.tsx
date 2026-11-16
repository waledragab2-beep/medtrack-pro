import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PublicBrand } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { mix, type Palette } from '../lib/theme';
import { Pill } from './ui';

export function BrandHeader({ brand, p, onBack }: { brand: PublicBrand; p: Palette; onBack?: () => void }) {
  const { t, pick, toggle } = useI18n();
  const insets = useSafeAreaInsets();
  const name = pick(brand.name, brand.nameEn);
  const tagline = pick(brand.tagline, brand.taglineEn);
  return (
    <View>
      {brand.isDemo ? <Text style={s.demo}>{t('demo')}</Text> : null}
      <View style={[s.hero, { backgroundColor: mix(p.primary, p.background, 0.55) }]}>
        {brand.coverUrl ? <Image source={{ uri: brand.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: p.background, opacity: 0.35 }]} />
        <View style={[s.top, { paddingTop: insets.top + 8 }]}>
          {onBack ? <Pill label={t('back')} onPress={onBack} /> : <View />}
          <Pill label={t('language')} onPress={toggle} />
        </View>
      </View>
      <View style={s.id}>
        <View style={[s.logo, { backgroundColor: p.surface, borderColor: p.background }]}>
          {brand.logoUrl ? <Image source={{ uri: brand.logoUrl }} style={s.logoImg} /> : <Text style={[s.initial, { color: p.primary }]}>{name.slice(0, 1)}</Text>}
        </View>
        <Text style={[s.name, { color: p.text }]}>{name}</Text>
        {tagline ? <Text style={{ color: p.muted, textAlign: 'center' }}>{tagline}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  demo: { backgroundColor: '#fff3cd', color: '#6b4e00', textAlign: 'center', fontWeight: '700', fontSize: 12, paddingVertical: 4 },
  hero: { height: 190, overflow: 'hidden' },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  id: { alignItems: 'center', marginTop: -56, gap: 6, paddingHorizontal: 20 },
  logo: { width: 92, height: 92, borderRadius: 26, borderWidth: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: '100%', height: '100%' },
  initial: { fontSize: 36, fontWeight: '800' },
  name: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
});
