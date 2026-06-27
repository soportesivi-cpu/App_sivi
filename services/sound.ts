import { createAudioPlayer } from 'expo-audio';

let soundPlayer: any = null;

/**
 * Reproduce un sonido de alerta tecnológico premium y nítido.
 * Utiliza expo-audio para cargar y reproducir audio desde un CDN optimizado.
 */
export async function playNotificationSound() {
  try {
    // Si ya existe una instancia reproduciéndose, la liberamos
    if (soundPlayer) {
      try {
        soundPlayer.release();
      } catch (err) {}
      soundPlayer = null;
    }

    soundPlayer = createAudioPlayer('https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav');
    soundPlayer.play();
  } catch (e) {
    console.warn('[Sound] Error al reproducir el sonido de notificación:', e);
  }
}
