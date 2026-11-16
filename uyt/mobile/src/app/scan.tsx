import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, Pill } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { routeFromUrl } from '../lib/links';
import { BRAND, palette } from '../lib/theme';

const p = palette(BRAND);

export default function Scan() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [permission, request] = useCameraPermissions();
  const [error, setError] = useState('');
  const handled = useRef(false);

  if (!permission) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  if (!permission.granted) {
    return (
      <View style={[s.wrap, { padding: 24, gap: 16 }]}>
        <Text style={s.hint}>{t('cameraPermission')}</Text>
        <Btn p={p} title={t('allowCamera')} onPress={() => void request()} />
        <Btn p={p} variant="outline" title={t('back')} onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          const route = routeFromUrl(data);
          if (!route) {
            setError(t('notUyt'));
            return;
          }
          handled.current = true;
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace(route as never);
        }}
      />
      <View style={[s.overlay, { paddingTop: insets.top + 12 }]}>
        <Pill label={t('back')} onPress={() => router.back()} />
      </View>
      <View style={s.frame} />
      <View style={[s.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={s.hint}>{error || t('scanHint')}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, start: 16 },
  frame: { alignSelf: 'center', width: 260, height: 260, borderRadius: 28, borderWidth: 4, borderColor: '#E10600' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 24 },
  hint: { color: '#fff', fontSize: 16, textAlign: 'center', fontWeight: '600' },
});
