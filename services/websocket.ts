/**
 * websocket.ts
 * Servicio de conectividad en tiempo real para AliceGuardian.
 * Usa socket.io-client@2.3.0 para compatibilidad con el servidor
 * SIVI Imperium que corre Engine.IO v3 (EIO=3).
 *
 * Protocolo de handshake del servidor SIVI:
 * 1. Conectar al namespace (ej: /workspace-data)
 * 2. Autenticarse con el token JWT
 * 3. Emitir "start_streaming" con el nombre del stream → SIN ESTO, EL SERVIDOR NO ENVÍA NADA
 *
 * Namespaces confirmados del HAR de producción:
 * - /workspace-data   → start_streaming("data")   → alarm_stats, alarm_throughput, face, alert
 * - /workspace-lpr    → start_streaming("lpr")    → lpr, alert
 * - /workspace-GUNS   → start_streaming("GUNS")   → detection, alert
 */

// @ts-ignore — tipos de v2 no están 100% alineados con v4, ignorar advertencias
import io from 'socket.io-client';
import { useAppStore } from './store';
import { PROD_API_DOMAIN } from '../constants/config';
import { playNotificationSound } from './sound';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type AlertChannel = 'face' | 'lpr' | 'alert' | 'statistics'
  | 'alarm_stats' | 'alarm_throughput' | 'data' | 'detection'
  | 'new_event' | 'GUNS' | 'new_alert';

export type AlertPayload = {
  channel: AlertChannel;
  data: any;
};

export type AlertCallback = (payload: AlertPayload) => void;

// ─── Configuración de namespaces según HAR de producción ────────────────────

type NamespaceConfig = {
  path: string;
  streamName: string;
  channels: string[];
};

const SIVI_NAMESPACES: NamespaceConfig[] = [
  {
    path: '/workspace-data',
    streamName: 'data',
    channels: ['face', 'alert', 'statistics', 'alarm_stats', 'alarm_throughput', 'new_alert', 'detection', 'new_event', 'data']
  },
  {
    path: '/workspace-lpr',
    streamName: 'lpr',
    channels: ['lpr', 'alert', 'new_alert', 'detection', 'new_event']
  },
  {
    path: '/workspace-GUNS',
    streamName: 'GUNS',
    channels: ['alert', 'detection', 'new_alert', 'new_event', 'GUNS']
  }
];

// Canales que activan sonido de notificación
const SOUND_CHANNELS = new Set(['alert', 'face', 'lpr', 'new_alert', 'detection', 'GUNS']);

// Canales de telemetría/métricas continuas de alta frecuencia que silenciaremos en consola
const SILENT_CHANNELS = new Set(['alarm_stats', 'alarm_throughput', 'statistics', 'data', 'states_workspace', 'states_camera', 'heartbeat', 'ping', 'pong', 'status']);

// ─── Clase principal ─────────────────────────────────────────────────────────

export class AlertSocketService {
  private sockets: any[] = [];
  private listeners: AlertCallback[] = [];

  // ── Registro de listeners ────────────────────────────────────────────────

  subscribe(cb: AlertCallback): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private emitToListeners(payload: AlertPayload) {
    this.listeners.forEach(cb => {
      try { cb(payload); } catch (e) {}
    });
  }

  private triggerSound(channel: string) {
    if (SOUND_CHANNELS.has(channel)) {
      const { soundEnabled } = useAppStore.getState();
      if (soundEnabled) {
        playNotificationSound().catch(() => {});
      }
    }
  }

  // ── Conexión ─────────────────────────────────────────────────────────────

  connect() {
    if (this.sockets.length > 0) return;

    const { jwtToken: globalToken, activeDomain, workspaceSessions, activeWorkspace, impersonatedWorkspace } = useAppStore.getState();

    // Resolver el token del workspace activo o impersonado actual
    const currentWs = impersonatedWorkspace || activeWorkspace;
    const activeWsId = currentWs?.id || currentWs?.workspace || '';

    let token = globalToken;
    if (activeWsId && workspaceSessions) {
      const activeSession = workspaceSessions.find(
        (s: any) => s.workspace?.toLowerCase() === activeWsId.toLowerCase()
      );
      if (activeSession) {
        token = activeSession.token || activeSession.jwt || token;
      }
    }

    if (!token) {
      console.warn('[WS] Sin token — abortando conexión');
      return;
    }

    if (!activeDomain) {
      console.warn('[WS] Sin dominio activo configurado');
      return;
    }

    // ── Resolución de URL del servidor de Socket.IO ──
    let serverUrl = '';
    const host = (activeDomain || PROD_API_DOMAIN).split(':')[0];
    
    // Entorno de desarrollo local estricto (localhost o IPs crudas privadas)
    const isPlainLocal = host.includes('localhost') || /^\d+\.\d+\.\d+\.\d+/.test(host);

    if (isPlainLocal) {
      // Para debug local, mantenemos HTTP y el puerto especificado
      const port = (activeDomain || '').split(':')[1] || '4550';
      serverUrl = `http://${host}:${port}`;
    } else {
      // Para cualquier subdominio de workspace (nube, local, FRP), conectamos directo por HTTPS/WSS (puerto 443)
      // para cumplir con las políticas de seguridad de iOS (IPA/ATS)
      serverUrl = `https://${host}`;
    }

    console.log(`[WS] 🔄 Iniciando conexiones multiplexadas a ${serverUrl} (${SIVI_NAMESPACES.length} namespaces)...`);

    const socketOptions = {
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      query: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      forceNew: true,
    };

    // Capturamos referencia a 'this' para usar dentro de callbacks function()
    const self = this;

    SIVI_NAMESPACES.forEach(({ path, streamName, channels }) => {
      const nsUrl = `${serverUrl}${path}`;
      console.log(`[WS] 📡 Conectando a namespace: ${nsUrl}`);
      const socket = io(nsUrl, socketOptions);
      this.sockets.push(socket);

      // ── Eventos de ciclo de vida ──

      socket.on('connect', () => {
        console.log(`[WS] ✅ Conectado a ${path}. SID: ${socket.id}`);

        // Paso 1: Autenticación con JWT
        socket.emit('authenticate', { token });

        // ╔══════════════════════════════════════════════════════════════════╗
        // ║  PASO CRÍTICO: start_streaming handshake                       ║
        // ║  Sin este emit, el servidor SIVI NO envía NINGÚN evento.       ║
        // ║  Confirmado por HAR de producción:                             ║
        // ║  42/workspace-data,["start_streaming","data"]                  ║
        // ╚══════════════════════════════════════════════════════════════════╝
        socket.emit('start_streaming', streamName);
        console.log(`[WS] 🚀 Emitido start_streaming("${streamName}") en ${path}`);
      });

      socket.on('reconnect', () => {
        console.log(`[WS] 🔁 Reconectado a ${path}. Re-emitiendo start_streaming...`);
        socket.emit('authenticate', { token });
        socket.emit('start_streaming', streamName);
      });

      socket.on('disconnect', (reason: string) => {
        console.warn(`[WS] ❌ Desconectado de ${path}: ${reason}`);
      });

      socket.on('connect_error', (err: Error) => {
        console.error(`[WS] ⚠️ Error de conexión en ${path}: ${err.message}`);
      });

      // ── Escuchar canales explícitos definidos por el namespace ──
      channels.forEach(channel => {
        socket.on(channel, (data: any) => {
          if (!SILENT_CHANNELS.has(channel)) {
            console.log(`[WS] 📨 Evento "${channel}" en ${path}:`,
              typeof data === 'object' ? JSON.stringify(data).substring(0, 200) : data
            );
          }
          self.emitToListeners({ channel: channel as AlertChannel, data });
          self.triggerSound(channel);
        });
      });

      // ── Interceptor catch-all: captura CUALQUIER evento del servidor ──
      // Socket.IO v2 no tiene onAny(), pero podemos interceptar el dispatcher interno
      const originalOnevent = socket.onevent;
      socket.onevent = function(packet: any) {
        const args = packet.data || [];
        const eventName = args[0];
        const eventData = args.length > 1 ? args[1] : undefined;

        // Log ALL raw events for debugging (suppressing high-frequency telemetry)
        if (eventName && !SILENT_CHANNELS.has(eventName)) {
          console.log(`[WS] 🔍 RAW en ${path}: "${eventName}"`,
            typeof eventData === 'object' ? JSON.stringify(eventData).substring(0, 150) : (eventData ?? '')
          );
        }

        // Si el evento no está registrado explícitamente, lo reenviamos de todas formas
        if (eventName && !channels.includes(eventName) && eventName !== 'message') {
          self.emitToListeners({ channel: eventName as AlertChannel, data: eventData });
          self.triggerSound(eventName);
        }

        // Llamar al handler original para que los listeners .on() funcionen
        if (originalOnevent) {
          originalOnevent.call(this, packet);
        }
      };

      // ── Escuchar canal genérico 'message' ──
      socket.on('message', (data: any) => {
        console.log(`[WS] 📩 message en ${path}:`,
          typeof data === 'object' ? JSON.stringify(data).substring(0, 200) : data
        );
        const channel = (data?.type || data?.channel || 'alert') as AlertChannel;
        self.emitToListeners({ channel, data });
        self.triggerSound(channel);
      });
    });
  }

  // ── Desconexión ──────────────────────────────────────────────────────────

  disconnect() {
    this.sockets.forEach(socket => {
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch (e) {}
    });
    this.sockets = [];
    console.log('[WS] ⛔ Todos los sockets desconectados intencionalmente');
  }

}

// Instancia singleton para toda la app
export const wsService = new AlertSocketService();

// Suscripción reactiva para re-conexión automática de sockets en caliente ante cambios de sesión o workspaces
let lastSessions = useAppStore.getState().workspaceSessions;
let lastActive = useAppStore.getState().activeWorkspace;
let lastImpersonated = useAppStore.getState().impersonatedWorkspace;

useAppStore.subscribe((state) => {
  const currentSessions = state.workspaceSessions;
  const currentActive = state.activeWorkspace;
  const currentImpersonated = state.impersonatedWorkspace;

  if (
    currentSessions !== lastSessions ||
    currentActive !== lastActive ||
    currentImpersonated !== lastImpersonated
  ) {
    console.log('[WS-TRIGGER] Sincronización detectada en el Store de Zustand. Re-conectando sockets...');
    lastSessions = currentSessions;
    lastActive = currentActive;
    lastImpersonated = currentImpersonated;

    wsService.disconnect();
    wsService.connect();
  }
});
