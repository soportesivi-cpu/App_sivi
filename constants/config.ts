// ─── Workspaces / Entornos ───────────────────────────────────────────────────

export type WorkspaceType = 'cloud' | 'local';

export type WorkspaceEntry = {
  id: string;
  name: string;
  domain: string;
  https: boolean;
  type: WorkspaceType;
  cameras?: number;
  users?: number;
  status?: string;
  workId?: string; // <-- NUEVO: ID de base de datos para la cabecera Referer
};

export const WORKSPACES: WorkspaceEntry[] = [
  { id: 'control', name: 'Imperium Control', domain: 'control.guardian.imperium.pe', https: true, type: 'cloud', cameras: 18, users: 4, status: 'Active', workId: '23' },
  { id: 'cmarket', name: 'Imperium Cmarket', domain: 'cmarket.guardian.imperium.pe', https: true, type: 'cloud', cameras: 22, users: 5, status: 'Active', workId: '24' },
  { id: 'alarms', name: 'Imperium Alarms', domain: 'alarms.guardian.imperium.pe', https: true, type: 'cloud', cameras: 15, users: 3, status: 'Active', workId: '25' },
  { id: 'local-frp', name: 'Imperium Local FRP', domain: '63.141.255.156:19090', https: false, type: 'local', cameras: 8, users: 2, status: 'Active', workId: '23' },
];

// ─── Servidores de producción (siempre fijos) ────────────────────────────────

/** Dominio principal de la API + Socket.IO de Imperium */
export const PROD_API_DOMAIN   = '63.141.255.156:9169';

/** Dominio de MediaMTX: HLS (:8888) y WebRTC WHEP (:8889) */
export const PROD_MEDIA_DOMAIN = 'control.sivi.imperium.pe';

// ─── Builder de URLs por entorno ─────────────────────────────────────────────

export function buildUrls(domain: string) {
  return {
    API_URL:  `http://${domain}/api/v1`,
    HLS_URL:  `http://${domain}/hls`,
    WS_URL:   `ws://${domain}`,
    BASE_URL: `http://${domain}`,
  };
}

export const ADMIN_EMAIL = 'info@ebenezertechs.com';