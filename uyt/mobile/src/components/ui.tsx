import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Palette } from '../lib/theme';

export function Card({ p, children, style }: { p: Palette; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, { backgroundColor: p.surface, borderColor: p.line }, style]}>{children}</View>;
}

export function Btn({
  p,
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  icon,
}: {
  p: Palette;
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'white';
  icon?: ReactNode;
}) {
  const bg = variant === 'primary' ? p.primary : variant === 'white' ? '#fff' : 'transparent';
  const fg = variant === 'primary' ? '#fff' : variant === 'white' ? p.primary : p.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, borderColor: variant === 'outline' ? p.line : bg, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text style={[s.btnText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.pill} accessibilityRole="button">
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 12 },
  btn: { minHeight: 56, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  btnText: { fontSize: 17, fontWeight: '700' },
  pill: { height: 34, paddingHorizontal: 14, borderRadius: 99, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center' },
});
