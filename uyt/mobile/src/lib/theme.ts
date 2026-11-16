import { StyleSheet } from 'react-native';
import type { Theme } from './api';

export const BRAND: Theme = { primary: '#E10600', background: '#0A0A0A', surface: '#161616', text: '#FFFFFF' };

/** Mix a hex colour with another (0..1) – used for muted text and borders derived from the brand theme. */
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, '0')).join('');
}

export function palette(t: Theme) {
  return {
    ...t,
    muted: mix(t.text, t.background, 0.42),
    line: mix(t.text, t.background, 0.86),
    soft: mix(t.text, t.surface, 0.94),
  };
}
export type Palette = ReturnType<typeof palette>;

export const base = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  num: { fontVariant: ['tabular-nums'], fontWeight: '800', letterSpacing: -1 },
});
