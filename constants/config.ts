export const WORKSPACES = [
  { id: 'control', name: 'Imperium', domain: 'control.guardian.imperium.pe' },
];

export function buildUrls(domain: string) {
  return {
    API_URL:  `https://${domain}/api/v1`,
    HLS_URL:  `https://${domain}/hls`,
    WS_URL:   `wss://${domain}`,
    BASE_URL: `https://${domain}`,
  };
}

export const ADMIN_EMAIL = 'info@ebenezertechs.com';