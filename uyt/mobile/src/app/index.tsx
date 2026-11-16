import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, Card, Pill } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { storage, type LinkedOrder } from '../lib/storage';
import { BRAND, palette } from '../lib/theme';

const p = palette(BRAND);

export default function Home() {
  const { t, toggle } = useI18n();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<LinkedOrder[]>([]);
  useFocusEffect(
    useCallback(() => {
      void storage.list().then(setOrders);
    }, []),
  );

  return (
    <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, gap: 20 }}>
      <View style={s.top}>
        <View style={s.logoRow}>
          <View style={s.mark}>
            <View style={s.dot} />
          </View>
          <Text style={s.logo}>UYT</Text>
        </View>
        <Pill label={t('language')} onPress={toggle} />
      </View>

      <View style={{ gap: 10, marginTop: 24 }}>
        <Text style={s.h1}>{t('appTagline')}</Text>
        <Text style={{ color: p.muted, fontSize: 16 }}>{t('scanHint')}</Text>
      </View>

      <Pressable onPress={() => router.push('/scan')} style={({ pressed }) => [s.scan, { transform: [{ scale: pressed ? 0.98 : 1 }] }]} accessibilityRole="button">
        <View style={s.scanFrame}>
          <Text style={{ fontSize: 54 }}>⌗</Text>
        </View>
        <Text style={s.scanText}>{t('scanQr')}</Text>
      </Pressable>

      <Card p={p}>
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>{t('yourOrders')}</Text>
        {orders.length ? (
          orders.map((o) => (
            <Pressable key={o.orderId} onPress={() => router.push(`/o/${o.orderId}`)} style={[s.row, { borderColor: p.line }]}>
              <Text style={{ color: p.text, fontWeight: '600' }}>{o.brandName ?? t('order')}</Text>
              <Text style={{ color: p.text, fontWeight: '800', fontSize: 18 }}>#{o.orderNumber ?? '—'}</Text>
            </Pressable>
          ))
        ) : (
          <Text style={{ color: p.muted }}>{t('noOrders')}</Text>
        )}
      </Card>
      {__DEV__ ? <Btn p={p} variant="outline" title="Demo store" onPress={() => router.push('/s/demo')} /> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 34, height: 34, borderRadius: 17, borderWidth: 4, borderColor: '#E10600', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E10600' },
  logo: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -1 },
  h1: { color: '#fff', fontSize: 34, fontWeight: '800', lineHeight: 42 },
  scan: { backgroundColor: '#E10600', borderRadius: 28, padding: 28, alignItems: 'center', gap: 14 },
  scanFrame: { width: 110, height: 110, borderRadius: 24, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  scanText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
