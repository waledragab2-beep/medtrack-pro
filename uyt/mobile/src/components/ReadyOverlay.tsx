import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { startAlarm, stopAlarm } from '../lib/alarm';
import { useI18n } from '../lib/i18n';
import type { Palette } from '../lib/theme';
import { Btn } from './ui';

/** Full-screen "your order is ready" moment: pulsing bell, sound (respecting silent mode) and vibration. */
export function ReadyOverlay({ visible, orderNumber, p, sound, onDismiss }: { visible: boolean; orderNumber: string; p: Palette; sound: boolean; onDismiss: () => void }) {
  const { t } = useI18n();
  const pulse = useRef(new Animated.Value(0)).current;
  const swing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    void startAlarm(sound);
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(swing, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(swing, { toValue: -1, duration: 240, useNativeDriver: true }),
          Animated.timing(swing, { toValue: 0, duration: 120, useNativeDriver: true }),
          Animated.delay(1100),
        ]),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
      stopAlarm();
    };
  }, [visible, sound, pulse, swing]);

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={[s.wrap, { backgroundColor: p.primary }]} accessibilityLiveRegion="assertive">
        <Animated.View
          style={[s.ripple, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.4] }) }] }]}
        />
        <Animated.View style={[s.bell, { transform: [{ rotate: swing.interpolate({ inputRange: [-1, 1], outputRange: ['-16deg', '16deg'] }) }] }]}>
          <Text style={{ fontSize: 56 }}>🔔</Text>
        </Animated.View>
        <Text style={s.ord}>#{orderNumber}</Text>
        <Text style={s.title}>{t('readyBig')}</Text>
        <Text style={s.sub}>{t('readyBigSub')}</Text>
        <View style={{ width: '100%', maxWidth: 340, marginTop: 12 }}>
          <Btn p={p} variant="white" title={t('gotIt')} onPress={onDismiss} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  ripple: { position: 'absolute', width: 320, height: 320, borderRadius: 160, borderWidth: 3, borderColor: '#fff' },
  bell: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  ord: { color: '#fff', fontSize: 84, fontWeight: '800', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  title: { color: '#fff', fontSize: 44, fontWeight: '800', textAlign: 'center' },
  sub: { color: '#fff', fontSize: 20, opacity: 0.95, textAlign: 'center' },
});
