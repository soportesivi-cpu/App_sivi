import { Audio } from 'expo-av';

let soundInstance: Audio.Sound | null = null;

/**
 * Reproduce un sonido de alerta tecnológico premium y nítido.
 * Utiliza expo-av para cargar y reproducir audio desde un CDN optimizado.
 */
export async function playNotificationSound() {
  try {
    // Si ya existe una instancia reproduciéndose, la detenemos y descargamos
    if (soundInstance) {
      await soundInstance.unloadAsync().catch(() => {});
      soundInstance = null;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav' },
      { shouldPlay: true, volume: 1.0 }
    );
    soundInstance = sound;
  } catch (e) {
    console.warn('[Sound] Error al reproducir el sonido de notificación:', e);
  }
}
