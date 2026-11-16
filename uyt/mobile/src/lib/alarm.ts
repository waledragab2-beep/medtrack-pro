import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';

let player: AudioPlayer | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * In-app alarm while the "ready" screen is visible.
 * playsInSilentMode is false on purpose: the phone's silent switch is respected (vibration still works).
 */
export async function startAlarm(withSound: boolean) {
  stopAlarm();
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  Vibration.vibrate([0, 600, 250, 600, 250, 900, 1200], true);
  if (withSound) {
    await setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});
    player = createAudioPlayer(require('../../assets/sounds/ready.wav'));
    player.loop = true;
    player.play();
  }
  stopTimer = setTimeout(stopAlarm, 60_000);
}

export function stopAlarm() {
  Vibration.cancel();
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
  if (player) {
    player.pause();
    player.remove();
    player = null;
  }
}
