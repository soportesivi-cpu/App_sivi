import { WORKSPACES, PROD_API_DOMAIN, PROD_MEDIA_DOMAIN } from '../constants/config';
import { useAppStore } from './store';

export function parseUTCDate(dateStr: string | Date | null | undefined): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;

  let cleanStr = String(dateStr).trim();

  // Si no tiene indicador de zona horaria (ni 'Z' ni offset +/-XX:XX)
  if (!cleanStr.includes('Z') && !/\+\d{2}:?\d{2}/.test(cleanStr) && !/-\d{2}:?\d{2}/.test(cleanStr)) {
    cleanStr = cleanStr.replace(' ', 'T');
    return new Date(cleanStr.endsWith('Z') ? cleanStr : cleanStr + 'Z');
  }

  // Si tiene un indicador de zona horaria, es seguro parsearlo directamente
  return new Date(cleanStr);
}

export function getMediaUrl(path: string | null | undefined, domain: string | null | undefined): string | null {
  if (!path || !domain) {
    console.log(`[MEDIA] ⚠️ getMediaUrl recibió path=${path}, domain=${domain} → null`);
    return null;
  }

  // ── Reescritura de URLs absolutas con IP local/loopback ──────────────────────
  // El backend guarda rutas como http://127.0.0.1:19090/alice-media/...
  // En producción esa IP es inalcanzable desde el APK. La reemplazamos con
  // el dominio público del workspace activo según la lista WORKSPACES.
  if (path.startsWith('http') && (
    path.includes('127.0.0.1') ||
    path.includes('localhost') ||
    path.includes('local.imperium.pe')
  )) {
    const localOriginMatch = path.match(/https?:\/\/(127\.0\.0\.1|localhost|local\.imperium\.pe)(:\d+)?(.+)/);
    if (localOriginMatch) {
      const relativePath = localOriginMatch[3]; // ej: /alice-media/05_31_2026/...

      // Buscar el dominio público del workspace activo en WORKSPACES
      const { impersonatedWorkspace, activeWorkspace } = useAppStore.getState();
      const currentWsId = (impersonatedWorkspace || activeWorkspace)?.id || '';
      const wsConfig = WORKSPACES.find(
        (w) => w.id.toLowerCase() === currentWsId.toLowerCase()
      );

      if (wsConfig && wsConfig.domain) {
        const proto = 'https';
        const finalUrl = `${proto}://${wsConfig.domain}${relativePath}`;
        console.log(`[MEDIA] 🔄 Local→Public: ${path} → ${finalUrl}`);
        return finalUrl;
      }

      console.warn(`[MEDIA] ⚠️ Workspace "${currentWsId}" sin dominio público en WORKSPACES. URL sin reescritura.`);
    }
  }

  // ── URL absoluta que NO es local → devolverla tal cual ──────────────────────
  if (path.startsWith('http')) {
    return path;
  }

  // ── Path relativo: construir URL ────────────────────────────────────────────
  // Normalizar el path (colapsar barras dobles como //05_31_2026 → /05_31_2026)
  let cleanPath = path.replace(/^\/+/, '/');
  if (!cleanPath.startsWith('/alice-media')) {
    cleanPath = '/alice-media' + cleanPath;
  }

  // Si el dominio es local (127.0.0.1, localhost, local.imperium.pe),
  // usar el dominio público del workspace activo desde WORKSPACES.
  // Esto es lo que permite que las imágenes carguen en el APK fuera de la LAN.
  const isLocalDom =
    domain.includes('127.0.0.1') ||
    domain.includes('localhost') ||
    domain.includes('local.imperium.pe');

  if (isLocalDom) {
    const { impersonatedWorkspace, activeWorkspace } = useAppStore.getState();
    const currentWsId = (impersonatedWorkspace || activeWorkspace)?.id || '';
    const wsConfig = WORKSPACES.find((w) => w.id.toLowerCase() === currentWsId.toLowerCase());

    if (wsConfig && wsConfig.domain) {
      const proto = 'https';
      const finalUrl = `${proto}://${wsConfig.domain}${cleanPath}`;
      console.log(`[MEDIA] Local->Public: ${path} -> ${finalUrl}`);
      return finalUrl;
    }
    console.warn(`[MEDIA] Workspace "${currentWsId}" sin dominio publico en WORKSPACES.`);
  }

  // Dominio cloud: construir URL directamente con https
  let finalUrl = `https://${domain}${cleanPath}`;

  // Limpiar barras dobles en el path sin afectar el ://
  const protoSplit = finalUrl.split('://');
  if (protoSplit.length === 2) {
    const cleanedPathPart = protoSplit[1].replace(/\/+/g, '/');
    finalUrl = `${protoSplit[0]}://${cleanedPathPart}`;
  }

  console.log(`[MEDIA] ${path} -> ${finalUrl}`);
  return finalUrl;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} s`;
  }
  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${minutes.toFixed(1)} m`;
  }
  const hours = seconds / 3600;
  return `${hours.toFixed(1)} h`;
}

async function fetchGateway(path: string, body: any = {}) {
  const { workspaceSessions, activeWorkspace, impersonatedWorkspace } = useAppStore.getState();

  const currentWs = impersonatedWorkspace || activeWorkspace;
  const wsId = currentWs?.id || currentWs?.workspace || '';

  // Resolve which session(s) to send
  let sessionsToSend: any[] = [];
  if (body.globalSessions === true) {
    // For global SuperAdmin dashboards
    sessionsToSend = workspaceSessions || [];
    delete body.globalSessions;
  } else {
    // For individual views, we send only the active workspace session to isolate data
    const activeSession = workspaceSessions?.find(s => s.workspace?.toLowerCase() === wsId.toLowerCase());
    if (activeSession) {
      sessionsToSend = [activeSession];
    } else if (wsId) {
      // If we have a specific workspace ID requested but no matching session,
      // do NOT fall back to another workspace's session to prevent cross-workspace data bleed!
      console.warn(`[fetchGateway] ⚠️ No session found for requested workspace "${wsId}". Data isolation enforced.`);
      sessionsToSend = [];
    } else if (workspaceSessions && workspaceSessions.length > 0) {
      sessionsToSend = [workspaceSessions[0]];
    }
  }

  if (sessionsToSend.length === 0) {
    throw new Error('No hay sesiones de workspace autorizadas activas');
  }

  const payload = {
    sessions: sessionsToSend.map(s => ({
      workspace: s.workspace,
      token: s.token || s.jwt
    })),
    ...body
  };

  const url = `https://${PROD_API_DOMAIN}${path}`;
  console.log(`[API GATEWAY DEBUG] POST ${url}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`Gateway Error (HTTP ${res.status}): ${errorBody}`);
  }

  const text = await res.text();
  if (!text || text.trim() === '') {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn('[API GATEWAY] Error al parsear JSON:', e);
    return null;
  }
}

export async function autoLogin(email: string, password: string) {
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    const loginUrl = `https://${PROD_API_DOMAIN}/mobile/auth/login`;

    console.log(`[API GATEWAY] Intentando login consolidado en: ${loginUrl}`);

    const controller = new AbortController();
     timeoutId = setTimeout(() => {
       controller.abort();
     }, 15000); // Ampliado a 15s para dar tiempo a la consulta federada de todos los workspaces

    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!res.ok) {
      console.log(`[API GATEWAY] Falla HTTP ${res.status} en la autenticación`);
      if (res.status === 400) {
        throw new Error('El correo y la contraseña son obligatorios.');
      }
      if (res.status === 401) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Credenciales incorrectas en los workspaces.');
      }
      throw new Error(`Error en el servidor de autenticación (HTTP ${res.status})`);
    }

    const body = await res.json();
    console.log(`[API GATEWAY] Login OK. Resultados de workspaces:`, body?.results?.length ?? 0);

    const results = body?.results || [];
    if (results.length === 0) {
      console.warn('[API GATEWAY] Autenticado con éxito pero no se recibieron workspaces asociados.');
      return null;
    }

    const firstResult = results[0];

    const match = WORKSPACES.find(
      w => w.id === firstResult.workspace || w.name.toLowerCase() === firstResult.workspace.toLowerCase()
    );

    const workspace = match || {
      id: firstResult.workspace,
      name: firstResult.workspace.toUpperCase(),
      domain: PROD_API_DOMAIN,
      https: true,
      type: 'cloud' as const,
      cameras: 12,
      users: 3,
      status: 'Active',
      workId: '23'
    };

    return {
      workspace,
      data: {
        token: firstResult.token,
        jwt: firstResult.jwt,
        user: firstResult.user,
        sessions: results
      }
    };
  } catch (e: any) {
    if (timeoutId) clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      console.error(`[API GATEWAY] Timeout alcanzado en la pasarela de login`);
      throw new Error('Tiempo de espera agotado al conectar con el servidor.');
    } else {
      console.error(`[API GATEWAY] Error en pasarela de login:`, e);
      throw e;
    }
  }
}

export function getTrueAlertName(tag: string): string {
  const t = (tag || '').toLowerCase();
  if (t.includes('fire') || t.includes('fuego') || t.includes('weapon') || t.includes('arma')) return 'Alerta Crítica';
  if (t.includes('lpr') || t.includes('plate') || t.includes('placa') || t.includes('car')) return 'Vehículo Detectado';
  if (t.includes('face') || t.includes('rostro')) return 'Rostro Detectado';
  if (t.includes('count') || t.includes('aforo') || t.includes('people')) return 'Métrica de Aforo';
  if (t.includes('zone') || t.includes('zona') || t.includes('intrus') || t.includes('motion') || t.includes('movimiento')) return 'Intrusión / Movimiento';
  return 'Alerta de Seguridad';
}

function normalizeAlertsData(data: any): any {
  if (!data || !Array.isArray(data.rows)) return data;

  const IGNORED_TAGS = [
    'heartbeat', 'keepalive', 'status', 'statistics', 'ping', 'pong',
    'alarm_stats', 'alarm_throughput', 'data', 'states_workspace', 'states_camera'
  ];

  data.rows = data.rows
    .filter((item: any) => {
      const tag = (item.tag || '').toLowerCase();
      const motive = (item.motive_categorie || item.title || '').toLowerCase();

      const isIgnored = IGNORED_TAGS.some(ignored =>
        tag.includes(ignored) || motive.includes(ignored)
      );
      if (isIgnored) return false;

      const hasImage = !!(
        item.url_evidence ||
        item.image_url ||
        item.face_detected_url ||
        item.url_photo ||
        item.url_photo_event ||
        item.thumbnail_url ||
        (Array.isArray(item.facecropping) && item.facecropping.length > 0) ||
        (typeof item.facecropping === 'string' && item.facecropping.trim() !== '')
      );

      return hasImage;
    })
    .map((item: any) => {
      let bestImg = item.url_evidence || item.image_url || item.face_detected_url || item.url_photo || item.url_photo_event || item.thumbnail_url;
      if (Array.isArray(item.facecropping) && item.facecropping.length > 0 && item.facecropping[0].url) {
        bestImg = item.facecropping[0].url;
      }

      const rawDev = item.device || item.Device || item.camera || item.Camera;
      let possibleName = 'Cámara';
      let resolvedMotive = item.motive_categorie ?? item.tag ?? item.title ?? 'Alerta';

      if (item.device_name) possibleName = item.device_name;
      else if (item.deviceName) possibleName = item.deviceName;
      else if (item.camera_name) possibleName = item.camera_name;
      else if (item.cameraName) possibleName = item.cameraName;
      else if (item.camera) possibleName = item.camera;
      else if (rawDev && typeof rawDev === 'object' && rawDev.name && rawDev.name !== 'Cámara' && rawDev.name !== 'Cámara Principal') {
        possibleName = rawDev.name;
      } else if (rawDev && typeof rawDev === 'string' && rawDev !== 'Cámara' && rawDev !== 'Cámara Principal') {
        possibleName = rawDev;
      } else if (item.motive_categorie && item.motive_categorie !== 'Alert' && item.motive_categorie.includes('_')) {
        possibleName = item.motive_categorie;
        resolvedMotive = getTrueAlertName(item.tag || item.type || 'alert');
      } else if (item.title && item.title !== 'Alert' && item.title.includes('_')) {
        possibleName = item.title;
        resolvedMotive = getTrueAlertName(item.tag || item.type || 'alert');
      }

      const resolvedDevice = rawDev && typeof rawDev === 'object'
        ? { ...rawDev, name: possibleName }
        : { name: possibleName };

      return {
        ...item,
        url_evidence: bestImg,
        probability: item.probability ?? 0.95,
        motive_categorie: resolvedMotive,
        tag: item.tag ?? 'alert',
        device: resolvedDevice
      };
    });

  return data;
}

function normalizeSearchRows(rows: any[], customDomain?: string): any[] {
  const { activeDomain: storeDomain } = useAppStore.getState();
  let domain = customDomain || storeDomain;

  if (domain && (domain.startsWith('http://') || domain.startsWith('https://'))) {
    domain = domain.replace(/^https?:\/\//, '');
  }

  if (domain && domain.includes(':')) {
    const colonIdx = domain.lastIndexOf(':');
    const host = domain.substring(0, colonIdx);
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      console.log(`[MEDIA] 🔧 Strip backend port: "${domain}" → "${host}"`);
      domain = host;
    }
  }

  return rows.map((item: any) => {
    let icon = 'scan';
    let color = '#2E9BFF';
    const tag = (item.tag || item.type || '').toLowerCase();
    const motive = (item.motive_categorie || '').toLowerCase();

    if (
      tag === 'face' ||
      tag === 'person' ||
      tag.includes('rostro') ||
      motive.includes('face') ||
      motive.includes('rostro') ||
      motive.includes('asociados') ||
      motive.includes('aforo')
    ) {
      icon = 'person';
      color = '#4caf50';
    } else if (
      tag === 'lpr' ||
      tag === 'car' ||
      tag.includes('placa') ||
      motive.includes('lpr') ||
      motive.includes('placa') ||
      motive.includes('car') ||
      motive.includes('vehiculo')
    ) {
      icon = 'car';
      color = '#ffcf8f';
    } else if (
      tag === 'object' ||
      tag === 'fp' ||
      tag === 'cube-outline' ||
      motive.includes('objeto') ||
      motive.includes('arma') ||
      motive.includes('weapon') ||
      motive.includes('mochila')
    ) {
      icon = 'cube-outline';
      color = '#feaa00';
    } else if (
      tag === 'intrusion' ||
      tag === 'action' ||
      tag === 'critical' ||
      tag === 'motion' ||
      motive.includes('intrusion') ||
      motive.includes('critical') ||
      motive.includes('error') ||
      motive.includes('zona') ||
      motive.includes('motion') ||
      motive.includes('pasillo')
    ) {
      icon = 'warning';
      color = '#F44336';
    } else {
      if (item.facecropping || item.face_detected_url) {
        icon = 'person';
        color = '#4caf50';
      }
    }

    let name = item.title || item.label || item.plate || item.name || 'Detección';
    if (name === 'Detección') {
      if (tag === 'face') {
        name = item.user_trained?.userName || 'Rostro Detectado';
      } else if (tag === 'fp') {
        name = 'Objeto Detectado';
      } else if (item.motive_categorie) {
        name = item.motive_categorie;
      } else if (item.tag && item.tag !== 'face' && item.tag !== 'fp') {
        name = item.tag;
      }
    }

    let time = item.createdAt || '';
    if (time) {
      try {
        time = new Date(time).toLocaleString('es-PE', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      } catch (e) { }
    }

    let img = item.image_url || item.url_evidence || item.url_photo_event || '';
    if (item.facecropping && item.facecropping.length > 0 && item.facecropping[0].url) {
      img = item.facecropping[0].url;
    } else if (item.face_detected_url) {
      img = item.face_detected_url;
    }

    img = getMediaUrl(img, domain) || 'https://images.unsplash.com/photo-1557597774-9d273605dfa9';

    const rawDev = item.device || item.Device || item.camera || item.Camera;
    let possibleCam = 'Cámara Principal';
    if (item.device_name) possibleCam = item.device_name;
    else if (item.deviceName) possibleCam = item.deviceName;
    else if (item.camera_name) possibleCam = item.camera_name;
    else if (item.cameraName) possibleCam = item.cameraName;
    else if (item.camera) possibleCam = item.camera;
    else if (rawDev && typeof rawDev === 'object' && rawDev.name && rawDev.name !== 'Cámara' && rawDev.name !== 'Cámara Principal') {
      possibleCam = rawDev.name;
    } else if (rawDev && typeof rawDev === 'string' && rawDev !== 'Cámara' && rawDev !== 'Cámara Principal') {
      possibleCam = rawDev;
    } else if (item.motive_categorie && item.motive_categorie !== 'Alert' && item.motive_categorie.includes('_')) {
      possibleCam = item.motive_categorie;
    } else if (item.title && item.title !== 'Alert' && item.title.includes('_')) {
      possibleCam = item.title;
    }

    return {
      id: item.id || Math.random().toString(),
      type: tag.toUpperCase(),
      name: name,
      cam: possibleCam,
      deviceId: item.device_id || item.deviceId || rawDev?.id || rawDev?.deviceId || null,
      time: time,
      confidence: Math.round((Number(item.prob || item.probability || 0.95)) * 100),
      icon: icon,
      color: color,
      img: img,
      rawItem: item
    };
  });
}

export async function getDashboard(workId?: string | null, interval: string = 'hoy') {
  try {
    const now = new Date();
    let dateFrom: Date;
    let dateTo: Date = new Date(now);

    if (interval === 'ayer') {
      dateFrom = new Date(now);
      dateFrom.setDate(dateFrom.getDate() - 1);
      dateFrom.setHours(0, 0, 0, 0);
      dateTo = new Date(dateFrom);
      dateTo.setHours(23, 59, 59, 999);
    } else if (interval === 'semana') {
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (interval === '15dias') {
      dateFrom = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    } else if (interval === '30dias') {
      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      dateFrom = new Date(now);
      dateFrom.setHours(0, 0, 0, 0);
    }

    const formatLocalISO = (d: Date) => {
      const tzo = -d.getTimezoneOffset();
      const dif = tzo >= 0 ? '+' : '-';
      const pad = (n: number, z = 2) => ('00' + n).slice(-z);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
        '.' + pad(d.getMilliseconds(), 3) + dif + pad(Math.floor(Math.abs(tzo) / 60)) + ':' + pad(Math.abs(tzo) % 60);
    };

    const dateFromISO = formatLocalISO(dateFrom);
    const dateToISO = formatLocalISO(dateTo);

    const { impersonatedWorkspace, activeWorkspace, workspaceSessions } = useAppStore.getState();
    const currentWs = impersonatedWorkspace || activeWorkspace;
    const wsId = currentWs?.id || currentWs?.workspace || '';

    let stateRes = null;
    let alertsPage1Res = null;
    let resTotal = null;
    let resAttended = null;
    let resPending = null;
    let resEffective = null;
    let resClassified = null;
    let resOperatorTime = null;

    // Rango independiente para las últimas alertas (momento exacto actual - 24 horas)
    const toRecent = new Date();
    const fromRecent = new Date(toRecent.getTime() - 24 * 60 * 60 * 1000);
    const fromRecentISO = formatLocalISO(fromRecent);
    const toRecentISO = formatLocalISO(toRecent);

    const activeSession = workspaceSessions?.find(s => s.workspace?.toLowerCase() === wsId.toLowerCase());

    const [camsRes, alertsRes, consolidado, devicesRes] = await Promise.all([
      getWorkspaceState().catch(() => null),
      activeSession ? getWorkspacesEvents({
        sessions: [activeSession],
        eventType: 'alert',
        from: fromRecentISO,
        to: toRecentISO,
        timezone: 'America/Lima',
        page: 1,
        limit: 5
      }).catch(() => null) : Promise.resolve(null),
      getWorkspacesAlertsDashboard({
        timePreset: 'custom',
        timezone: 'America/Lima',
        from: dateFromISO,
        to: dateToISO
      }).catch(() => null),
      getDevices().catch(() => null)
    ]);

    stateRes = camsRes;
    alertsPage1Res = alertsRes;


    let chartsSuccess = false;

    if (consolidado) {
      const workspaceData = consolidado.workspaces?.find((w: any) => w.workspace?.toLowerCase() === wsId.toLowerCase());
      if (workspaceData && workspaceData.charts) {
        const c = workspaceData.charts;
        resTotal = c.totalAlerts;
        resAttended = c.attendedAlerts;
        resPending = c.unresolvedAlerts;
        resEffective = c.effectiveOperationPercentage;
        resClassified = c.classifiedAlerts;
        resOperatorTime = c.operatorActionTime;
        chartsSuccess = true;
      }
    }

    let onCameras = 0;
    let offCameras = 0;
    let storagePercent = 38;

    // 1. PRIORIDAD: Conteo dinámico de la lista de dispositivos (Caso Local / Real Club)
    if (devicesRes && Array.isArray(devicesRes.rows) && devicesRes.rows.length > 0) {
      devicesRes.rows.forEach((camera: any) => {
        const primaryStatus = camera.rtspStatus?.primary;
        // Consideramos activa la cámara si el ping está 'online' o si es 'unknown' (aún no verificado pero no caído)
        if (primaryStatus === 'online' || primaryStatus === 'unknown') {
          onCameras++;
        } else {
          offCameras++;
        }
      });
    }
    // 2. PRIORIDAD NUBE: Si no hay dispositivos, verificar 'states.devices' (Caso Nube)
    else if (stateRes && stateRes.states && stateRes.states.devices) {
      const devices = stateRes.states.devices || {};
      const devKeys = Object.keys(devices);
      if (devKeys.length > 0) {
        devKeys.forEach(k => {
          if (devices[k].error === true) {
            offCameras++;
          } else {
            onCameras++;
          }
        });
      } else {
        onCameras = 0;
        offCameras = 0;
      }
    }
    // 3. FALLBACK FINAL: En caso de caída del servidor o sin datos reales, mostrar 0
    else {
      onCameras = 0;
      offCameras = 0;
    }

    // Normalización de disco (Soporte para estructura estándar y legacy)
    if (stateRes) {
      if (stateRes.metrics?.health?.disk0?.percent !== undefined) {
        storagePercent = stateRes.metrics.health.disk0.percent;
      } else if (stateRes.states?.disk0 && typeof stateRes.states.disk0.percent === 'number') {
        storagePercent = stateRes.states.disk0.percent || 38;
      }
    }

    const allRows = (alertsPage1Res && Array.isArray(alertsPage1Res.rows)) ? alertsPage1Res.rows : [];

    const recentAlerts = allRows.slice(0, 5).map((alert: any) => {
      let type = 'primary';
      let icon = 'shield-checkmark-outline';
      const motive = (alert.motive_categorie || '').toLowerCase();

      if (
        motive.includes('face') ||
        motive.includes('rostro') ||
        motive.includes('asociados') ||
        motive.includes('aforo') ||
        (alert.tag && alert.tag.toLowerCase().includes('face'))
      ) {
        type = 'secondary';
        icon = 'person-outline';
      } else if (
        motive.includes('intrusion') ||
        motive.includes('critical') ||
        motive.includes('error') ||
        motive.includes('zona') ||
        motive.includes('motion') ||
        motive.includes('pasillo')
      ) {
        type = 'error';
        icon = 'walk-outline';
      } else if (
        motive.includes('lpr') ||
        motive.includes('placa') ||
        motive.includes('car') ||
        motive.includes('vehiculo')
      ) {
        type = 'primary';
        icon = 'car-outline';
      } else if (
        motive.includes('objeto') ||
        motive.includes('cube') ||
        motive.includes('arma')
      ) {
        type = 'warning';
        icon = 'cube-outline';
      }

      const imgUrl = getMediaUrl(alert.face_detected_url || alert.url_evidence, currentWs?.domain || PROD_API_DOMAIN);

      let displayTime = '--:--:--';
      if (alert.createdAt) {
        try {
          const date = parseUTCDate(alert.createdAt);
          displayTime = date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        } catch (e) { }
      }

      return {
        id: alert.id ? alert.id.toString() : Math.random().toString(),
        title: alert.tag && alert.tag !== 'alert' ? alert.tag : (alert.motive_categorie || 'Detección IA'),
        time: displayTime,
        camera: alert.device?.name || 'Cámara',
        percent: alert.probability ? `${Math.round(parseFloat(alert.probability) * 100)}%` : '92%',
        type: type,
        icon: icon,
        img: imgUrl,
      };
    });

    if (chartsSuccess && resTotal) {
      let faceCount = 0;
      let lprCount = 0;
      let objectCount = 0;
      let intrusionCount = 0;

      if (resTotal?.slices && Array.isArray(resTotal.slices)) {
        resTotal.slices.forEach((slice: any) => {
          const key = (slice.key || '').toLowerCase();
          if (
            key.includes('face') ||
            key.includes('rostro') ||
            key.includes('asociados') ||
            key.includes('aforo')
          ) {
            faceCount += slice.value || 0;
          } else if (
            key.includes('lpr') ||
            key.includes('placa') ||
            key.includes('car') ||
            key.includes('vehiculo')
          ) {
            lprCount += slice.value || 0;
          } else if (
            key.includes('objeto') ||
            key.includes('arma') ||
            key.includes('weapon') ||
            key.includes('mochila')
          ) {
            objectCount += slice.value || 0;
          } else {
            intrusionCount += slice.value || 0;
          }
        });
      }

      const totalVal = resTotal?.total || 0;
      let resolvedCount = resAttended?.total ?? 0;
      let unresolvedCount = resPending?.total ?? 0;

      if (!resAttended || !resPending) {
        let sampleResolved = 0;
        const allAlerts = alertsPage1Res?.rows || [];
        allAlerts.forEach((item: any) => {
          const stateStr = (item.state || '').toLowerCase();
          if (
            item.is_confirmed === true ||
            stateStr === 'resolved' ||
            stateStr === 'confirmed' ||
            item.is_confirmed === false ||
            stateStr === 'false_positive'
          ) {
            sampleResolved++;
          }
        });
        const sampleTotal = allAlerts.length;
        if (sampleTotal > 0) {
          const ratio = sampleResolved / sampleTotal;
          resolvedCount = Math.round(totalVal * ratio);
          unresolvedCount = totalVal - resolvedCount;
        } else {
          resolvedCount = Math.round(totalVal * 0.75);
          unresolvedCount = totalVal - resolvedCount;
        }
      }

      let falsePositiveCount = 0;
      let truePositiveCount = 0;
      let pendingCount = 0;

      if (resClassified?.slices && Array.isArray(resClassified.slices)) {
        resClassified.slices.forEach((slice: any) => {
          if (slice.key === 'false_positive') {
            falsePositiveCount = slice.value || 0;
          } else if (slice.key === 'positive') {
            truePositiveCount = slice.value || 0;
          } else if (slice.key === 'unclassified' || slice.key === 'pending') {
            pendingCount = slice.value || 0;
          }
        });
      } else {
        let sampleFP = 0;
        const allAlerts = alertsPage1Res?.rows || [];
        allAlerts.forEach((item: any) => {
          const stateStr = (item.state || '').toLowerCase();
          if (item.is_confirmed === false || stateStr === 'false_positive') {
            sampleFP++;
          }
        });
        const sampleTotal = allAlerts.length;
        if (sampleTotal > 0) {
          falsePositiveCount = Math.round(resolvedCount * (sampleFP / sampleTotal));
          truePositiveCount = resolvedCount - falsePositiveCount;
          pendingCount = unresolvedCount;
        } else {
          falsePositiveCount = Math.round(resolvedCount * 0.2);
          truePositiveCount = resolvedCount - falsePositiveCount;
          pendingCount = unresolvedCount;
        }
      }

      let effective = "0.00%";
      const totalAlertsForEff = resEffective?.total_alerts || totalVal;
      const attendedForEff = resEffective?.attended_total || resolvedCount;
      if (totalAlertsForEff > 0) {
        effective = `${((attendedForEff / totalAlertsForEff) * 100).toFixed(2)}%`;
      }

      let avgResponse = '-';
      let medianResponse = '-';
      let minResponse = '-';
      let unanswered = '-';

      if (totalVal > 0) {
        unanswered = `${((unresolvedCount / totalVal) * 100).toFixed(1)}%`;
      }

      if (resOperatorTime) {
        const avgSec = resOperatorTime.averageSeconds;
        const bestSec = resOperatorTime.bestSeconds;
        const p95Sec = resOperatorTime.p95Seconds;

        if (typeof avgSec === 'number' && avgSec > 0) {
          avgResponse = formatDuration(avgSec);
        }
        if (typeof p95Sec === 'number' && p95Sec > 0) {
          medianResponse = formatDuration(p95Sec);
        }
        if (typeof bestSec === 'number' && bestSec > 0) {
          minResponse = formatDuration(bestSec);
        }
      }

      return {
        summary: {
          cameras: { on: onCameras, off: offCameras },
          storage: { percent: storagePercent, days: 45 }
        },
        alerts24h: { face: faceCount, lpr: lprCount, object: objectCount, intrusion: intrusionCount },
        metrics: { total: totalVal, resolved: resolvedCount, unresolved: unresolvedCount, effective },
        recentAlerts,
        classification: { falsePositive: falsePositiveCount, positive: truePositiveCount, pending: pendingCount },
        responseTime: {
          avg: avgResponse,
          median: medianResponse,
          min: minResponse,
          unanswered: unanswered
        },
        isConsolidated: chartsSuccess
      };
    }

    return {
      summary: {
        cameras: { on: onCameras, off: offCameras },
        storage: { percent: storagePercent, days: 45 }
      },
      alerts24h: { face: 0, lpr: 0, object: 0, intrusion: 0 },
      metrics: { total: recentAlerts.length, resolved: 0, unresolved: recentAlerts.length, effective: "0%" },
      recentAlerts,
      classification: { falsePositive: 0, positive: 0, pending: recentAlerts.length },
      responseTime: { avg: '-', median: '-', min: '-', unanswered: '-' },
      isConsolidated: false
    };
  } catch (error) {
    console.error("Error al sintetizar el dashboard:", error);
    return {
      summary: {
        cameras: { on: 0, off: 0 },
        storage: { percent: 0, days: 0 }
      },
      alerts24h: { face: 0, lpr: 0, object: 0, intrusion: 0 },
      metrics: { total: 0, resolved: 0, unresolved: 0, effective: "0%" },
      recentAlerts: [],
      classification: { falsePositive: 0, positive: 0, pending: 0 },
      responseTime: { avg: '-', median: '-', min: '-', unanswered: '-' }
    };
  }
}

export async function getWorkspaceState() {
  const { impersonatedWorkspace, activeWorkspace } = useAppStore.getState();
  const wsId = (impersonatedWorkspace || activeWorkspace)?.id || '';
  const res = await fetchGateway('/mobile/workspaces/summary');
  const wsData = res.workspaces?.find((w: any) => w.workspace?.toLowerCase() === wsId.toLowerCase());
  return wsData || { states: { devices: {}, disk0: { percent: 42 } } };
}

export async function getAlarms(page = 1) {
  const { impersonatedWorkspace, activeWorkspace } = useAppStore.getState();
  const wsId = (impersonatedWorkspace || activeWorkspace)?.id || '';

  console.log(`[getAlarms] 🔍 Buscando alarmas para wsId="${wsId}"`);

  // ─── Paginación exhaustiva ──────────────────────────────────────────────────
  // El Gateway devuelve las configuraciones paginadas (limit=30 por defecto).
  // Iteramos todas las páginas hasta agotar los registros.
  let allConfigurations: any[] = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const res = await fetchGateway('/mobile/workspaces/alarms/configurations', {
      page: currentPage,
      limit: 100   // máximo razonable por request
    });

    if (!res?.workspaces) {
      console.warn(`[getAlarms] ⚠️ Página ${currentPage}: sin workspaces en respuesta`);
      break;
    }

    const wsData = res.workspaces.find((w: any) => w.workspace?.toLowerCase() === wsId.toLowerCase());

    if (!wsData) {
      console.warn(`[getAlarms] ⚠️ Workspace "${wsId}" no encontrado en página ${currentPage}`);
      break;
    }

    const cfgObj = wsData.configurations;

    // Detectar si es un objeto paginado { count, rows } o array directo
    const rows: any[] = Array.isArray(cfgObj)
      ? cfgObj                      // ya es un array
      : (cfgObj?.rows ?? []);       // es un objeto paginado → extraer .rows

    totalPages = cfgObj?.pages ?? 1;
    allConfigurations = [...allConfigurations, ...rows];

    console.log(`[getAlarms] 📄 Página ${currentPage}/${totalPages}: +${rows.length} filas (total acumulado: ${allConfigurations.length})`);

    currentPage++;
  } while (currentPage <= totalPages);

  // Deduplicar configuraciones por ID único
  const uniqueRows: any[] = [];
  const seenIds = new Set<any>();
  allConfigurations.forEach((row: any) => {
    if (row && row.id !== undefined && row.id !== null) {
      if (seenIds.has(row.id)) return;
      seenIds.add(row.id);
    }
    uniqueRows.push(row);
  });

  console.log(`[getAlarms] ✅ ${uniqueRows.length} configuraciones únicas para wsId="${wsId}"`);
  return { rows: uniqueRows };
}


export async function getDevices(page = 1) {
  const { impersonatedWorkspace, activeWorkspace } = useAppStore.getState();
  const wsId = (impersonatedWorkspace || activeWorkspace)?.id || '';
  const res = await fetchGateway('/mobile/workspaces/devices');
  const wsData = res.workspaces?.find((w: any) => w.workspace?.toLowerCase() === wsId.toLowerCase());
  return { rows: wsData?.devices || [] };
}


export async function getWorkspaces(): Promise<any[]> {
  const { workspaceSessions } = useAppStore.getState();
  return (workspaceSessions || []).map(s => ({
    id: s.workspace,
    work_id: s.workspace,
    name: s.workspace.toUpperCase(),
    workspace: s.workspace,
    type: 'cloud'
  }));
}


export async function getWorkspacesDevices(sessions: any[]) {
  return fetchGateway('/mobile/workspaces/devices');
}

const RESERVED_TAGS = [
  'person', 'persona', 'personas',
  'weapon', 'gun', 'arma', 'armas',
  'face', 'rostro', 'rostros',
  'vehiculo', 'vehículos', 'moto', 'auto',
  'zona', 'alerta', 'alerts',
  'aforo', 'manos arriba', 'zona segura'
];

export async function searchForense(params: {
  type?: string;
  date_from?: string;
  date_to?: string;
  hourFrom?: string;
  hourTo?: string;
  device_id?: string;
  page?: number;
  query?: string;
  globalSearch?: boolean;
  selectedWorkspaces?: string[];
  faceName?: string;
  plate?: string;
  listName?: string;
  smartEventName?: string;
}) {
  try {
    const q = (params.query || '').trim();
    const queryPayload: any = {};
    if (q) {
      const qLower = q.toLowerCase();
      const isReserved = RESERVED_TAGS.includes(qLower);

      if (isReserved) {
        // Excluimos las palabras clave reservadas para que el servidor devuelva eventos generales
        // en el rango de fechas, permitiendo al cliente realizar el filtrado robusto en memoria.
      } else if (/^[A-Za-z0-9-]{3,8}$/.test(q) && /\d.*\d/.test(q)) {
        queryPayload.plate = q.toUpperCase();
      } else if (qLower.includes('intrusion') || qLower.includes('motion')) {
        queryPayload.smartEventName = qLower;
      } else {
        queryPayload.faceName = q.toUpperCase();
      }
    }

    if (params.faceName) queryPayload.faceName = params.faceName;
    if (params.plate) queryPayload.plate = params.plate;
    if (params.listName) queryPayload.listName = params.listName;
    if (params.smartEventName) queryPayload.smartEventName = params.smartEventName;

    const t = (params.type || '').toLowerCase();
    let analyticType = 'all';
    if (t.includes('face') || t.includes('rostro')) analyticType = 'face';
    else if (t.includes('lpr') || t.includes('placa') || t.includes('vehiculo')) analyticType = 'lpr';
    else if (t.includes('object') || t.includes('objeto')) analyticType = 'object';
    else if (t.includes('action') || t.includes('motion')) analyticType = 'motion';
    else if (t.includes('smart') || t.includes('intrusión') || t.includes('evento')) analyticType = 'smart_event';

    const gatewayParams = {
      query: queryPayload,
      filters: {
        analyticType,
        deviceId: params.device_id || 'all',
        from: params.date_from ? new Date(params.date_from).toISOString() : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        to: params.date_to ? new Date(params.date_to).toISOString() : new Date().toISOString(),
        timezone: 'America/Lima',
        ...(params.hourFrom ? { hourFrom: params.hourFrom } : {}),
        ...(params.hourTo ? { hourTo: params.hourTo } : {})
      },
      eventTypes: ['alert', 'smart_event'],
      page: params.page || 1,
      limit: 30
    };

    const bodyRes = await fetchGateway('/mobile/workspaces/search', gatewayParams);
    const wsResults = bodyRes.workspaces || [];
    let rows: any[] = [];
    let totalCount = 0;
    let hasMore = false;
    wsResults.forEach((wsRes: any) => {
      if (wsRes.rows && Array.isArray(wsRes.rows)) {
        const normalizedRows = normalizeSearchRows(wsRes.rows, wsRes.backendUrl).map(row => ({
          ...row,
          workspace: wsRes.workspace
        }));
        rows = [...rows, ...normalizedRows];
        totalCount += wsRes.count || wsRes.rows.length;

        const wsPages = wsRes.pages || Math.ceil((wsRes.count || wsRes.rows.length) / 30) || 1;
        if (wsRes.rows.length >= 30 || (wsRes.page || 1) < wsPages) {
          hasMore = true;
        }
      }
    });

    return {
      rows,
      count: totalCount,
      page: params.page || 1,
      pages: Math.ceil(totalCount / 30) || 1,
      hasMore
    };
  } catch (e) {
    console.error('[API GATEWAY] Búsqueda forense falló:', e);
    return { rows: [], count: 0, page: params.page || 1, pages: 1, hasMore: false };
  }
}

export async function classifyWorkspacesEvent(params: {
  eventType: string;
  eventId: number;
  classification: 'confirm' | 'ignore' | 'false_positive';
}) {
  const { userData } = useAppStore.getState();
  try {
    return await fetchGateway('/mobile/workspaces/events/classification', {
      eventType: params.eventType,
      eventId: params.eventId,
      classification: params.classification,
      user: {
        id: userData?.id || 0,
        first_name: userData?.first_name || userData?.firstName || 'Operator',
        last_name: userData?.last_name || userData?.lastName || 'Guardian',
        Username: userData?.Username || userData?.username || 'operator'
      }
    });
  } catch (e) {
    console.error('[API GATEWAY] Error al clasificar evento:', e);
    throw e;
  }
}

export async function confirmAlert(eventId: number | string) {
  return classifyWorkspacesEvent({
    eventType: 'alert',
    eventId: Number(eventId),
    classification: 'confirm'
  });
}

export async function falsePositiveAlert(eventId: number | string) {
  return classifyWorkspacesEvent({
    eventType: 'alert',
    eventId: Number(eventId),
    classification: 'false_positive'
  });
}

export async function addIncidentDescription(params: {
  eventId: number | string;
  incidentId: number | string;
  name: string;
  description: string;
}) {
  try {
    return await fetchGateway('/mobile/workspaces/events/description', params).catch(() => ({
      id: Math.floor(Math.random() * 1000000),
      name: params.name
    }));
  } catch (e) {
    return {
      id: Math.floor(Math.random() * 1000000),
      name: params.name
    };
  }
}

export async function getWorkspacesSummary(sessions?: any[]) {
  return fetchGateway('/mobile/workspaces/summary', { globalSessions: true });
}

export async function getWorkspacesAlertsDashboard(params: {
  timePreset: 'last_1h' | 'last_24h' | 'last_7d' | 'custom';
  from?: string;
  to?: string;
  timezone?: string;
  deviceIds?: string[];
  limit?: number;
}) {
  return fetchGateway('/mobile/workspaces/alerts/dashboard', params);
}

export async function getWorkspacesEvents(params: {
  sessions?: any[];
  eventType: string;
  from: string;
  to: string;
  timezone: string;
  page?: number;
  limit?: number;
  filters?: any;
}) {
  try {
    const wsData = await fetchGateway('/mobile/workspaces/events', params);
    const wsDataFirst = wsData?.workspaces?.[0];
    if (wsDataFirst) {
      const normalized = normalizeAlertsData({ rows: wsDataFirst.rows || [] });
      return {
        ...wsDataFirst,
        rows: normalized.rows
      };
    }
    return { rows: [], count: 0, pages: 0 };
  } catch (e) {
    console.error('[API GATEWAY] Error al obtener eventos agregados:', e);
    throw e;
  }
}

export async function updateWorkspaceAlarmConfiguration(params: {
  alarmId: number;
  alarm?: {
    state?: boolean;
    sound?: number;
    frequency?: number | string;
    is_active_rules?: boolean;
  };
  action?: {
    id: number;
    issound?: boolean;
    isalert?: boolean;
    manual_confirmation?: boolean;
    ismodal?: boolean;
    timeout?: number | string;
  };
}) {
  return fetchGateway('/mobile/workspaces/alarms/configurations/update', params);
}

export async function updateWorkspaceAlarmPolygons(polygons: Array<{
  roiId: number | string;
  state?: boolean;
  points?: string | any[];
}>) {
  return fetchGateway('/mobile/workspaces/alarms/configurations/polygons/update', { polygons });
}

export async function getWorkspaceAlarmConfigurationDetail(alarmId: number | string) {
  const { impersonatedWorkspace, activeWorkspace } = useAppStore.getState();
  const wsId = (impersonatedWorkspace || activeWorkspace)?.id || '';

  console.log(`[getWorkspaceAlarmConfigurationDetail] 🔍 Buscando detalle de alarma ${alarmId} para wsId="${wsId}"`);

  const res = await fetchGateway('/mobile/workspaces/alarms/configurations/detail', {
    alarmId: Number(alarmId)
  });

  if (!res?.workspaces) {
    throw new Error('No se pudo obtener la respuesta de la pasarela.');
  }

  const wsData = res.workspaces.find((w: any) => w.workspace?.toLowerCase() === wsId.toLowerCase());

  if (!wsData) {
    throw new Error(`Workspace "${wsId}" no encontrado en el detalle.`);
  }

  return wsData.alarm;
}

export interface StreamUrls {
  webrtc: string;
  hls: string;
}

export function getCameraStreams(camera: { id: number; deviceId: string; rtsp?: string }, isLocal: boolean): StreamUrls {
  if (!isLocal) {
    // Caso Cloud: Mantiene la extracción actual desde el RTSP
    const rtspUrl = camera.rtsp || '';
    const match = rtspUrl.match(/^rtsp:\/\/([^:/]+)(?::(\d+))?\/(.+)$/);
    if (match) {
      const host = match[1];
      const path = match[3];
      return {
        webrtc: `https://${host}/webrtc/${path}/whep`,
        hls: `https://${host}:8888/${path}/index.m3u8`
      };
    }
    // Fallback Cloud
    const fallbackPath = `${camera.id}-${camera.deviceId}`;
    return {
      webrtc: `https://${PROD_MEDIA_DOMAIN}/webrtc/${fallbackPath}/whep`,
      hls: `https://${PROD_MEDIA_DOMAIN}:8888/${fallbackPath}/index.m3u8`
    };
  }

  // Caso Local / FRP: Resolución dinámica por la fórmula SIVI
  const { activeDomain, activeWorkspace } = useAppStore.getState();
  const domain = activeDomain || 'local.imperium.pe:19090';
  
  const parts = domain.split(':');
  // Siempre se fuerza a local.imperium.pe para garantizar SSL handshake exitoso
  const host = 'local.imperium.pe';
    
  const apiPort = parts[1] ? parseInt(parts[1], 10) : 19090;

  let webrtcPort = 18890;
  let hlsPort = 18891;

  // Aplicar la fórmula dinámica FRP si el puerto API está en el rango estándar (19090 - 58090)
  if (apiPort >= 19090 && apiPort <= 58090 && (apiPort - 19090) % 1000 === 0) {
    const id = 1 + (apiPort - 19090) / 1000;
    webrtcPort = 18890 + (id - 1) * 1000;
    hlsPort = 18891 + (id - 1) * 1000;
  } else {
    // Fallback para sedes con puertos sueltos/heredados fuera de la fórmula estándar
    const currentWsId = activeWorkspace?.id;
    const wsConfig = WORKSPACES.find(w => w.id.toLowerCase() === currentWsId?.toLowerCase());
    if (wsConfig?.webrtcPort) webrtcPort = wsConfig.webrtcPort;
    if (wsConfig?.hlsPort) hlsPort = wsConfig.hlsPort;
  }

  // Path de stream con nomenclatura fija /1/ requerida para local
  const streamPath = `${camera.id}-${camera.deviceId}/1/`;

  return {
    webrtc: `https://${host}:${webrtcPort}/${streamPath}`,
    hls: `https://${host}:${hlsPort}/${streamPath}index.m3u8`
  };
}

