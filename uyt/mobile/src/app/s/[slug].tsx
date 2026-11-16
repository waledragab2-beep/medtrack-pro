import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BrandHeader } from '../../components/BrandHeader';
import { Extras } from '../../components/Extras';
import { Btn, Card } from '../../components/ui';
import { api, ApiError, type Content, type PublicBranch, type PublicBrand } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { registerPush } from '../../lib/push';
import { storage } from '../../lib/storage';
import { palette } from '../../lib/theme';

type Data = { brand: PublicBrand; branch: PublicBranch } & Content;
const latin = (v: string) => v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

/** Store page (static QR): enter the order number → this phone is linked to the order. */
export default function StorePage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, lang } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Data>(`/public/branches/${encodeURIComponent(slug)}`).then(setData).catch((e: ApiError) => setError(e.code === 'network' ? t('networkError') : e.message));
  }, [slug, t]);

  if (!data) {
    return (
      <View style={[s.center, { backgroundColor: '#0A0A0A' }]}>
        {error ? <Text style={{ color: '#fff' }}>{error}</Text> : <ActivityIndicator color="#E10600" />}
      </View>
    );
  }
  const p = palette(data.brand.theme);

  async function open() {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ orderId: string; deviceToken: string }>(`/public/branches/${encodeURIComponent(slug)}/claim`, {
        body: { orderNumber: latin(number.trim()), claimCode: code ? latin(code) : undefined, platform: Platform.OS === 'ios' ? 'ios' : 'android', locale: lang },
      });
      await storage.save(r.deviceToken, { orderId: r.orderId, orderNumber: latin(number.trim()), brandName: data!.brand.name, branchSlug: slug, linkedAt: new Date().toISOString() });
      void registerPush(r.deviceToken);
      router.replace(`/o/${r.orderId}`);
    } catch (e) {
      const err = e as ApiError;
      setError(
        { order_not_found: t('orderNotFound'), invalid_claim_code: t('invalidCode'), order_already_linked: t('alreadyLinked'), network: t('networkError') }[err.code] ?? err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <BrandHeader brand={data.brand} p={p} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ padding: 16, gap: 16 }}>
          <Card p={p}>
            <Text style={[s.h2, { color: p.text }]}>🔔 {t('trackYourOrder')}</Text>
            <Text style={{ color: p.muted }}>{t('enterOrderNumber')}</Text>
            <TextInput
              value={number}
              onChangeText={setNumber}
              placeholder="#"
              placeholderTextColor={p.muted}
              keyboardType="number-pad"
              maxLength={12}
              style={[s.input, { color: p.text, borderColor: p.line, backgroundColor: p.background }]}
              accessibilityLabel={t('trackYourOrder')}
            />
            {data.branch.requireClaimCode ? (
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/[^\d٠-٩]/g, '').slice(0, 4))}
                placeholder={t('orderCode')}
                placeholderTextColor={p.muted}
                keyboardType="number-pad"
                style={[s.input, { color: p.text, borderColor: p.line, backgroundColor: p.background, fontSize: 22, letterSpacing: 8 }]}
              />
            ) : null}
            {error ? <Text style={[s.error, { borderColor: p.primary, color: p.text }]}>{error}</Text> : null}
            <Btn p={p} title={t('openOrder')} onPress={open} loading={busy} disabled={!number.trim()} />
          </Card>
          <Extras brand={data.brand} branch={data.branch} content={data} p={p} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h2: { fontSize: 18, fontWeight: '700' },
  input: { minHeight: 64, borderRadius: 16, borderWidth: 2, textAlign: 'center', fontSize: 30, fontWeight: '700' },
  error: { borderWidth: 1, borderRadius: 14, padding: 12 },
});
