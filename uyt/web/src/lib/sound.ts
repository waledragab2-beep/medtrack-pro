/**
 * Alert tone generated with Web Audio (no asset download, works offline).
 * Browsers only allow audio after a user gesture, so `unlockAudio()` is called from the
 * "Open my order" / "Enable alerts" taps; later `startAlarm()` can ring without a new gesture.
 */
let ctx: AudioContext | null = null;
let timer: number | null = null;
let vibrateTimer: number | null = null;

function context(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctx;
  } catch {
    return null;
  }
}

export function unlockAudio(): void {
  const c = context();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const o = c.createOscillator();
  const g = c.createGain();
  g.gain.value = 0.0001;
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.02);
}

function chime() {
  const c = context();
  if (!c) return;
  const now = c.currentTime;
  [880, 1175, 1568].forEach((freq, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    const t = now + i * 0.16;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.55);
  });
}

export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

/** Ring + vibrate repeatedly until stopAlarm() or `maxMs`. */
export function startAlarm({ sound = true, maxMs = 60_000 } = {}): void {
  stopAlarm();
  const c = context();
  if (c?.state === 'suspended') void c.resume();
  const ring = () => {
    if (sound) chime();
  };
  ring();
  timer = window.setInterval(ring, 1800);
  if (canVibrate()) {
    navigator.vibrate([600, 250, 600, 250, 900]);
    vibrateTimer = window.setInterval(() => navigator.vibrate([600, 250, 600, 250, 900]), 3600);
  }
  window.setTimeout(stopAlarm, maxMs);
}

export function stopAlarm(): void {
  if (timer) window.clearInterval(timer);
  if (vibrateTimer) window.clearInterval(vibrateTimer);
  timer = vibrateTimer = null;
  if (canVibrate()) navigator.vibrate(0);
}

export const playChimeOnce = () => chime();
