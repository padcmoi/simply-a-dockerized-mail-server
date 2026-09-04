export const NOTIFICATION_SOUND_STORAGE_KEY = "notification_sound";

const TONE_HZ = 880;
const TONE_SECONDS = 0.18;

let context: AudioContext | null = null;

export function useNotificationSound() {
  const enabled = useLocalStorage<boolean>(NOTIFICATION_SOUND_STORAGE_KEY, true);
  const seenId = useState<number | null>("notifications-sound-seen-id", () => null);

  function play() {
    if (!import.meta.client || typeof AudioContext === "undefined") return;
    try {
      context ??= new AudioContext();
      if (context.state === "suspended") void context.resume();
      const at = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(TONE_HZ, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.2, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + TONE_SECONDS);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + TONE_SECONDS);
    } catch {
      return;
    }
  }

  function notice(items: NotificationRow[]) {
    if (!items.length) return;
    const top = Math.max(...items.map((row) => row.id));
    if (seenId.value === null) {
      seenId.value = top;
      return;
    }
    if (top <= seenId.value) return;
    seenId.value = top;
    if (enabled.value) play();
  }

  return { enabled, play, notice };
}
