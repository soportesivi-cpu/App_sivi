import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ImageBackground,
  Platform,
  StatusBar,
  TextInput
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../services/store';
import { getDevices, getWorkspacesDevices, getMediaUrl, getWorkspacesEvents, getCameraStreams } from '../../services/api';
import { PROD_MEDIA_DOMAIN, WORKSPACES } from '../../constants/config';
import Loading from '../../components/Loading';
import { router } from 'expo-router';
import { Colors, Layout } from '../../constants/theme';

import React, { useEffect, useState, useMemo } from 'react';

type Camera = {
  id: number;
  name: string;
  deviceId: string;
  type?: string;
  stream_name?: string;
  rtsp: string;
  container: any[];
  hasMotion?: boolean; // Añadido para alertas tácticas
  rtspStatus?: {
    primary: 'online' | 'offline' | 'unknown';
    secondary: 'online' | 'offline' | 'unknown';
    checkedAt?: string;
    source?: string;
  };
};

type StreamState = 'checking' | 'connected' | 'disconnected';
type CameraStreamStatus = {
  hls: StreamState;
  webrtc: StreamState;
};

export default function CamerasScreen() {
  const { activeDomain: domain, jwtToken: token, isDarkMode, activeWorkspace, impersonatedWorkspace, workspaceSessions } = useAppStore();
  const currentWs = impersonatedWorkspace || activeWorkspace;
  const isLocal = currentWs?.type === 'local';

  const getWebViewBaseUrl = () => {
    if (isFrpConnection()) {
      return `https://local.imperium.pe`;
    }
    let effectiveDomain = domain;
    const isIpOrLocal = /^\d+\.\d+\.\d+\.\d+/.test(effectiveDomain || '') || effectiveDomain?.includes('localhost') || effectiveDomain?.includes('local.imperium.pe');
    if (isIpOrLocal && effectiveDomain) {
      const parts = effectiveDomain.split(':');
      const host = parts[0];
      return `https://${host}`;
    }
    return `https://${PROD_MEDIA_DOMAIN}`;
  };

  const [selected, setSelected] = useState<Camera | null>(null);
  const [streamMode, setStreamMode] = useState<'hls' | 'webrtc'>('webrtc'); // Favorecemos webrtc como default
  const [searchQuery, setSearchQuery] = useState('');
  const [manualRefresh, setManualRefresh] = useState(false);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [streamStatus, setStreamStatus] = useState<Record<number, CameraStreamStatus>>({});


  // Al abrir el modal de una cámara, seleccionamos por defecto WebRTC (WHEP)
  useEffect(() => {
    if (selected) {
      setStreamMode('webrtc');
    }
  }, [selected]);

  const activeSession = useMemo(() => {
    if (isLocal) {
      return [{ workspace: 'local', token: token || '' }];
    }
    const wsId = currentWs?.id || currentWs?.workspace || '';
    const match = workspaceSessions?.find((s: any) => s.workspace?.toLowerCase() === wsId.toLowerCase());
    return match ? [match] : [];
  }, [workspaceSessions, currentWs, isLocal, token]);

  const workspaceTokenForStream = useMemo(() => {
    if (isLocal) return token || '';
    return activeSession[0]?.token || token || '';
  }, [activeSession, isLocal, token]);

  const isRealclub = (currentWs?.id || '').toLowerCase() === 'realclub';

  const { data: qData, isLoading: loading, refetch, isRefetching } = useQuery({
    queryKey: ['cameras', domain, activeSession, isRealclub],
    queryFn: async () => {
      if (isLocal || isRealclub) {
        return getDevices();
      }
      if (activeSession.length === 0) {
        return { workspaces: [], failures: [] };
      }
      return getWorkspacesDevices(activeSession);
    },
    refetchInterval: 15000,
  });

  const handleManualRefresh = async () => {
    setManualRefresh(true);
    await refetch();
    setManualRefresh(false);
  };

  const rawCameras = useMemo((): Camera[] => {
    if (isLocal || isRealclub) {
      return qData?.rows || [];
    }
    const wsData = qData?.workspaces?.[0];
    return wsData?.devices || [];
  }, [qData, isLocal, isRealclub]);

  const ipCameras = useMemo((): Camera[] => {
    return rawCameras.filter(cam => cam.type?.toUpperCase() === 'IP_CAM');
  }, [rawCameras]);

  const filteredCameras = useMemo(() => {
    return ipCameras.filter(cam =>
      cam.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [ipCameras, searchQuery]);



  useEffect(() => {
    if (!ipCameras.length) return;

    let isMounted = true;

    // Ejecuta chequeos escalonados de streams
    const runStaggeredChecks = async () => {
      const isCloud = !isLocal && !isRealclub && !isFrpConnection();
      
      // En la nube, solo verificamos las cámaras que la API reporta en duda o offline
      // En local/FRP, seguimos verificando todas
      const camerasToCheck = isCloud 
        ? ipCameras.filter(cam => cam.rtspStatus?.primary !== 'online')
        : ipCameras;

      if (camerasToCheck.length === 0) return;

      const batchSize = 2;
      for (let i = 0; i < camerasToCheck.length; i += batchSize) {
        if (!isMounted) break;

        const batch = camerasToCheck.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (camera) => {
            let status: CameraStreamStatus;

            if (isCloud) {
              // En la nube, solo validamos la disponibilidad de WebRTC (WHEP)
              const webrtcStatus = await validateWebRtcEndpoint(camera);
              status = { hls: 'checking', webrtc: webrtcStatus };
            } else {
              // En local, validamos HLS y WebRTC normalmente
              status = await validateCameraStreams(camera);
            }

            if (!isMounted) return;

            setStreamStatus(prev => {
              if (prev[camera.id]?.hls === status.hls && prev[camera.id]?.webrtc === status.webrtc) {
                return prev;
              }
              return {
                ...prev,
                [camera.id]: status,
              };
            });
          })
        );

        if (i + batchSize < camerasToCheck.length) {
          await new Promise(resolve => setTimeout(resolve, 300)); // Delay de 300ms
        }
      }
    };

    // Primera validación al cargar la pantalla
    runStaggeredChecks();

    // Ciclo de validación periódico (ping) cada 30 segundos
    const intervalId = setInterval(() => {
      if (isMounted) {
        runStaggeredChecks();
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [ipCameras, token, isLocal, isRealclub]);


  // Obtenemos los eventos históricos, idealmente con polling si la modal está abierta

  const { data: objectsData } = useQuery({
    queryKey: ['camera_objects_live', selected?.id],
    queryFn: async () => {
      if (!selected) return { rows: [] };
      const toDate = new Date();
      const fromDate = new Date(toDate.getTime() - 24 * 60 * 60 * 1000);
      const formatLimaISO = (d: Date) => {
        const options = {
          timeZone: 'America/Lima',
          year: 'numeric' as const, month: '2-digit' as const, day: '2-digit' as const,
          hour: '2-digit' as const, minute: '2-digit' as const, second: '2-digit' as const,
          hour12: false
        };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(d);
        const getVal = (type: string) => parts.find(p => p.type === type)?.value || '';
        return `${getVal('year')}-${getVal('month')}-${getVal('day')}T${getVal('hour')}:${getVal('minute')}:${getVal('second')}-05:00`;
      };
      return getWorkspacesEvents({
        sessions: activeSession,
        eventType: 'smart_event',
        from: formatLimaISO(fromDate),
        to: formatLimaISO(toDate),
        timezone: 'America/Lima',
        page: 1,
        limit: 5,
        filters: { deviceId: selected.deviceId || selected.id }
      });
    },
    enabled: !!selected,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const { data: actionsData } = useQuery({
    queryKey: ['camera_actions_live', selected?.id],
    queryFn: async () => {
      if (!selected) return { rows: [] };
      const toDate = new Date();
      const fromDate = new Date(toDate.getTime() - 24 * 60 * 60 * 1000);
      const formatLimaISO = (d: Date) => {
        const options = {
          timeZone: 'America/Lima',
          year: 'numeric' as const, month: '2-digit' as const, day: '2-digit' as const,
          hour: '2-digit' as const, minute: '2-digit' as const, second: '2-digit' as const,
          hour12: false
        };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(d);
        const getVal = (type: string) => parts.find(p => p.type === type)?.value || '';
        return `${getVal('year')}-${getVal('month')}-${getVal('day')}T${getVal('hour')}:${getVal('minute')}:${getVal('second')}-05:00`;
      };
      return getWorkspacesEvents({
        sessions: activeSession,
        eventType: 'alert',
        from: formatLimaISO(fromDate),
        to: formatLimaISO(toDate),
        timezone: 'America/Lima',
        page: 1,
        limit: 5,
        filters: { deviceId: selected.deviceId || selected.id }
      });
    },
    enabled: !!selected,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const filteredEvents = useMemo(() => {
    const objs = objectsData?.rows || [];
    const acts = actionsData?.rows || [];
    return [...objs, ...acts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [objectsData, actionsData]);


  function getHlsUrl(camera: Camera, cacheBust?: number): string {
    const suffix = cacheBust ? `?_cb=${cacheBust}` : '';
    const streams = getCameraStreams(camera, isFrpConnection());
    return streams.hls ? `${streams.hls}${suffix}` : '';
  }

  function getWebRtcUrl(camera: Camera): string {
    const streams = getCameraStreams(camera, isFrpConnection());
    return streams.webrtc;
  }

  function getCameraThumbnail(_camera: Camera) {
    return 'https://plus.unsplash.com/premium_photo-1675016457613-2291390d1bf6?w=300&q=80';
  }


  function updateStreamStatus(cameraId: number, protocol: keyof CameraStreamStatus, state: StreamState) {
    setStreamStatus(prev => ({
      ...prev,
      [cameraId]: {
        hls: prev[cameraId]?.hls || 'checking',
        webrtc: prev[cameraId]?.webrtc || 'checking',
        [protocol]: state,
      },
    }));
  }



  async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function validateHlsStream(camera: Camera): Promise<StreamState> {
    try {
      const baseUrl = getHlsUrl(camera);
      if (!baseUrl) return 'disconnected';
      const token = workspaceTokenForStream;
      const playlistUrl = token ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?' }token=${token}` : baseUrl;

      // Petición GET rápida de texto con timeout de 1500ms
      const res = await fetchWithTimeout(playlistUrl, { cache: 'no-store' as any }, 1500);
      if (!res.ok) return 'disconnected';

      const text = await res.text();
      // Si contiene la cabecera estándar de HLS, el stream está activo
      return text.includes('#EXTM3U') ? 'connected' : 'disconnected';
    } catch {
      // Si ocurre un error de red/SSL en el celular, retornamos disconnected
      return 'disconnected';
    }
  }

  async function validateWebRtcEndpoint(camera: Camera): Promise<StreamState> {
    try {
      const streamToken = workspaceTokenForStream;
      const baseUrl = getWebRtcUrl(camera);
      if (!baseUrl) return 'disconnected';

      // En conexiones FRP locales, el puerto 18890 sirve una página HTML en la raíz del stream
      // que siempre da 200 OK. Para validar el video real, consultamos con OPTIONS al endpoint /whep real.
      if (isFrpConnection()) {
        const whepUrl = `${baseUrl}whep`;
        const urlWithToken = streamToken ? `${whepUrl}${whepUrl.includes('?') ? '&' : '?' }token=${streamToken}` : whepUrl;
        const res = await fetchWithTimeout(urlWithToken, {
          method: 'OPTIONS',
        }, 1500);
        return res.status >= 200 && res.status < 400 ? 'connected' : 'disconnected';
      }

      // En conexiones Cloud, WHEP soporta consulta de capacidades via OPTIONS.
      const headers = streamToken ? { Authorization: `Bearer ${streamToken}` } : undefined;
      const res = await fetchWithTimeout(baseUrl, {
        method: 'OPTIONS',
        headers,
      }, 1500);
      return res.status >= 200 && res.status < 500 && res.status !== 404 ? 'connected' : 'disconnected';
    } catch {
      // Si ocurre un error de red/SSL en el celular, retornamos disconnected
      return 'disconnected';
    }
  }

  async function validateCameraStreams(camera: Camera): Promise<CameraStreamStatus> {
    if (isFrpConnection()) {
      const webrtc = await validateWebRtcEndpoint(camera);
      return { hls: 'disconnected', webrtc };
    }

    const [hls, webrtc] = await Promise.all([
      validateHlsStream(camera),
      validateWebRtcEndpoint(camera),
    ]);

    return { hls, webrtc };
  }

  function getCameraStatus(camera: Camera) {
    return streamStatus[camera.id] || { hls: 'checking', webrtc: 'checking' };
  }

  function isOnline(camera: Camera) {
    const isCloud = !isLocal && !isRealclub && !isFrpConnection();

    if (isCloud) {
      // 1. Regla de confianza: si el backend dice online, está online
      if (camera.rtspStatus?.primary === 'online') {
        return true;
      }

      // 2. Regla de rescate por WebRTC en caliente (OPTIONS en segundo plano)
      const status = getCameraStatus(camera);
      if (status.webrtc === 'connected') {
        return true; // Rescatada: el Media Server sí tiene stream
      }
      if (status.webrtc === 'disconnected') {
        return false; // Confirmado Offline
      }

      // 3. Fallback mientras se está evaluando ('checking')
      return camera.rtspStatus?.primary !== 'offline';
    }

    const status = getCameraStatus(camera);

    // Caso FRP: Validación mediante WebRTC WHEP
    if (isFrpConnection()) {
      if (status.webrtc === 'connected') return true;
      if (status.webrtc === 'disconnected') return false;
      return camera.rtspStatus?.primary !== 'offline';
    }

    // Caso LOCAL: Para local convencional, la única validación 100% real de que hay video es HLS (que la playlist index.m3u8 exista).
    // Evitamos WebRTC WHEP para la decisión Online/Offline porque el servidor de MediaMTX responde
    // OPTIONS 200/204 por configuración estática del path incluso si la cámara no tiene transmisión activa.
    if (status.hls === 'connected') return true;
    if (status.hls === 'disconnected') {
      return false;
    }
    // Si aún está verificando ('checking'), asumimos online si el backend dice 'online' o 'unknown' (no 'offline' explícito)
    return camera.rtspStatus?.primary !== 'offline';
  }

  const { activeCount, inactiveCount } = useMemo(() => {
    let active = 0;
    let inactive = 0;
    ipCameras.forEach(cam => {
      if (isOnline(cam)) {
        active++;
      } else {
        inactive++;
      }
    });
    return { activeCount: active, inactiveCount: inactive };
  }, [ipCameras, streamStatus]);

  function getHlsHtml(camera: Camera) {
    const videoUrl = getHlsUrl(camera);
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <script src="https://cdn.jsdelivr.net/npm/hls.js@1.4.12"></script>
        <style>
          body { margin: 0; padding: 0; background-color: #0d0d0d; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; position: relative; }
          video { width: 100vw; height: 100vh; object-fit: contain; position: absolute; top: 0; left: 0; z-index: 1; transition: opacity 0.3s; }
          .error { color: red; font-family: sans-serif; text-align: center; display: none; padding: 20px; z-index: 10; position: absolute; }
        </style>
      </head>
      <body>
        <div id="err" class="error">Error loading Stream.</div>
        <video id="video" autoplay muted playsinline controls></video>
        <script>
          var video = document.getElementById('video');
          var err = document.getElementById('err');
          var url = '${videoUrl}';
          
          if (Hls.isSupported()) {
            var hls = new Hls({ debug: false, enableWorker: true });
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
              video.play().catch(function(e) { console.log(e); });
            });
            video.addEventListener('canplay', function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stream_status', protocol: 'hls', state: 'connected' }));
              }
            });
            hls.on(Hls.Events.ERROR, function(e, data) {
              if(data.fatal) {
                err.style.display = 'block';
                err.innerText = 'HLS Error: ' + data.details;
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stream_status', protocol: 'hls', state: 'disconnected' }));
                }
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            var retryCount = 0;
            function loadNative() {
              var bust = retryCount > 0 ? (url.includes('?') ? '&retry=' : '?retry=') + retryCount : '';
              video.src = url + bust;
              video.load();
            }

            video.addEventListener('loadedmetadata', function() {
              video.play().catch(function(e) { console.log(e); });
              err.style.display = 'none';
            });

            video.addEventListener('canplay', function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stream_status', protocol: 'hls', state: 'connected' }));
              }
            });

            video.addEventListener('error', function() {
              if (retryCount < 3) {
                retryCount++;
                console.log('Retry Native HLS: ' + retryCount);
                setTimeout(loadNative, 2000);
              } else {
                err.style.display = 'block';
                err.innerText = 'Native HLS Error';
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stream_status', protocol: 'hls', state: 'disconnected' }));
                }
              }
            });

            loadNative();
          } else {
            err.style.display = 'block';
            err.innerText = 'HLS is not supported on this browser/device.';
          }
        </script>
      </body>
      </html>
    `;
  }

  function getWebRtcHtml(camera: Camera): string {
    const whepUrl = getWebRtcUrl(camera);
    const token = workspaceTokenForStream;
    const authHeader = token ? `headers['Authorization'] = 'Bearer ${token}';` : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
      <style>
        html, body { margin: 0; padding: 0; background: #000; width: 100vw; height: 100vh; overflow: hidden; }
        video { width: 100vw; height: 100vh; object-fit: contain; }
        #err { color: #ff4444; font-family: sans-serif; text-align: center; padding: 20px; display: none; position: absolute; top: 50%; left: 0; right: 0; transform: translateY(-50%); }
      </style>
    </head>
    <body>
      <video id="video" autoplay muted playsinline controls></video>
      <div id="err"></div>
      <script>
        var video = document.getElementById('video');
        var err = document.getElementById('err');

        function post(payload) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        }

        async function startWhep() {
          try {
            var pc = new RTCPeerConnection({
              iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            pc.addTransceiver('video', { direction: 'recvonly' });
            pc.addTransceiver('audio', { direction: 'recvonly' });

            pc.ontrack = function(event) {
              if (event.streams && event.streams[0]) {
                video.srcObject = event.streams[0];
                video.play().catch(function(){});
                post({ type: 'stream_status', protocol: 'webrtc', state: 'connected' });
              }
            };

            var offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            var headers = { 'Content-Type': 'application/sdp' };
            ${authHeader}

            var res = await fetch('${whepUrl}', {
              method: 'POST',
              headers: headers,
              body: offer.sdp
            });

            if (!res.ok) {
              throw new Error('WHEP error: ' + res.status);
            }

            var answerSdp = await res.text();
            await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

          } catch(e) {
            err.style.display = 'block';
            err.innerText = 'WebRTC Error: ' + e.message;
            post({ type: 'stream_status', protocol: 'webrtc', state: 'disconnected' });
          }
        }

        startWhep();
      </script>
    </body>
    </html>
  `;
  }

  function isFrpConnection(): boolean {
    let effectiveDomain = domain;
    if ((currentWs?.id || '').toLowerCase() === 'realclub') {
      const localFrpWs = WORKSPACES.find(w => w.id === 'local-frp');
      effectiveDomain = localFrpWs?.domain || 'local.imperium.pe:19090';
    }
    const isIpOrLocal = /^\d+\.\d+\.\d+\.\d+/.test(effectiveDomain || '') || effectiveDomain?.includes('localhost') || effectiveDomain?.includes('local.imperium.pe');
    if (!isIpOrLocal || !effectiveDomain) return false;
    const parts = effectiveDomain.split(':');
    const host = parts[0];
    const apiPort = parts[1];
    const apiPortNum = apiPort ? parseInt(apiPort, 10) : 0;
    const isFrpPort = apiPortNum >= 19090 && apiPortNum <= 58090 && (apiPortNum - 19090) % 1000 === 0;
    return host === 'local.imperium.pe' || isFrpPort;
  }

  if (loading) {
    return <Loading />;
  }

  const styles = getStyles(isDarkMode);

  return (
    <View style={styles.container}>
      {/* HEADER TOP BAR SIVI */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.brand.celeste + '20', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.brand.celeste} />
          </View>
          <Text style={{ color: Colors.brand.celeste, fontSize: 20, fontWeight: '900', letterSpacing: -1, marginLeft: 10 }}>SIVI</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            <Ionicons name={viewMode === 'grid' ? "list" : "grid"} size={16} color={isDarkMode ? '#ffffff' : '#111827'} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: 4, marginBottom: 15 }}>
        <Text style={{ color: isDarkMode ? '#ffffff' : '#111827', fontSize: 26, fontWeight: '800' }}>Red de Cámaras</Text>
      </View>

      {/* Cajas de Estadísticas de Cámaras */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 15 }}>
        <View style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isDarkMode ? '#334155' : '#e2e8f0',
          gap: 10
        }}>
          <View style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: '#22c55e15',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Ionicons name="videocam" size={20} color="#22c55e" />
          </View>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: isDarkMode ? '#fff' : '#1e293b' }}>{activeCount}</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: isDarkMode ? '#94a3b8' : '#64748b' }}>Activas</Text>
          </View>
        </View>

        <View style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isDarkMode ? '#334155' : '#e2e8f0',
          gap: 10
        }}>
          <View style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            backgroundColor: '#ef444415',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Ionicons name="videocam-off" size={20} color="#ef4444" />
          </View>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: isDarkMode ? '#fff' : '#1e293b' }}>{inactiveCount}</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: isDarkMode ? '#94a3b8' : '#64748b' }}>Desactivadas</Text>
          </View>
        </View>
      </View>


      <View style={{ paddingHorizontal: 16, marginBottom: 15 }}>
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color={isDarkMode ? '#ffffff60' : '#4B5563'} />
          <TextInput
            placeholder="Buscar cámara por nombre..."
            placeholderTextColor={isDarkMode ? Colors.dark.inputPlaceholder : Colors.light.inputPlaceholder}
            style={{ flex: 1, color: isDarkMode ? '#fff' : '#111827', fontSize: 14, marginLeft: 10, fontWeight: '500' }}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={isDarkMode ? '#ffffff60' : '#4B5563'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* LISTA */}
      <FlatList
        key={viewMode}
        numColumns={viewMode === 'grid' ? 2 : 1}
        data={filteredCameras}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.lista}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        onRefresh={handleManualRefresh}
        refreshing={manualRefresh}
        renderItem={({ item }) => {
          const online = isOnline(item);

          if (viewMode === 'grid') {
            return (
              <TouchableOpacity
                style={styles.cardGrid}
                onPress={() => setSelected(item)}
              >
                <ImageBackground
                  source={{ uri: getCameraThumbnail(item) }}
                  style={styles.cardGridTop}
                  imageStyle={!online ? { opacity: 0.4 } : {}}
                >
                  {online && item.hasMotion ? (
                    <View style={styles.badgeWarning}>
                      <Ionicons name="warning" size={10} color="#000" />
                      <Text style={styles.badgeWarningText}>MVT</Text>
                    </View>
                  ) : null}

                  {!online && (
                    <View style={{ position: 'absolute', top: 0, bottom: '55%', left: 0, right: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255, 255, 255, 0.15)' }}>
                      <View style={{ backgroundColor: isDarkMode ? '#161622' : '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: isDarkMode ? '#ffffff10' : '#E5E7EB' }}>
                        <Ionicons name="videocam-off" size={14} color={isDarkMode ? '#ffffff' : '#4B5563'} />
                        <Text style={{ color: isDarkMode ? '#ffffff' : '#4B5563', fontSize: 10, marginLeft: 4 }}>Offline</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.cardInfoOverlay}>
                    <Text style={styles.cardGridName} numberOfLines={1}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
                      <Ionicons
                        name={item.hasMotion ? "flash" : "ellipse"}
                        size={item.hasMotion ? 10 : 8}
                        color={item.hasMotion ? (isDarkMode ? "#FEAA00" : "#B45309") : online ? (isDarkMode ? "#4caf50" : "#15803D") : (isDarkMode ? "#ff4444" : "#DC2626")}
                      />
                      <Text style={[
                        styles.cardGridStatus,
                        item.hasMotion && { color: isDarkMode ? '#FEAA00' : '#B45309' },
                        online && !item.hasMotion && { color: isDarkMode ? '#4caf50' : '#15803D' },
                        !online && { color: isDarkMode ? '#ff4444' : '#DC2626' }
                      ]}>
                        {item.hasMotion ? 'Movimiento' : online ? 'Activa' : 'Sin Conexión'}
                      </Text>
                    </View>
                  </View>
                </ImageBackground>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelected(item)}
            >
              <View style={styles.cardLeft}>
                <View style={[
                  styles.iconContainer,
                  item.hasMotion && { backgroundColor: isDarkMode ? '#FEAA0020' : '#FFF7ED', borderColor: isDarkMode ? '#FEAA0040' : '#FED7AA' }
                ]}>
                  <Ionicons
                    name={item.hasMotion ? "warning" : "videocam"}
                    size={20}
                    color={item.hasMotion ? (isDarkMode ? '#FEAA00' : '#B45309') : online ? Colors.brand.primary : (isDarkMode ? 'rgba(255,255,255,0.4)' : '#4B5563')}
                  />
                </View>
                <View style={styles.cardInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.cardNombre}>{item.name}</Text>
                  </View>
                  {item.hasMotion && (
                    <Text style={{ color: isDarkMode ? '#FEAA00' : '#B45309', fontSize: 10, fontWeight: '700' }}>• MOVIMIENTO</Text>
                  )}
                </View>
              </View>
              <View style={styles.cardRight}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: online ? (isDarkMode ? '#4caf5018' : '#F0FDF4') : (isDarkMode ? 'rgba(255,255,255,0.05)' : '#F3F4F6') }
                ]}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: online ? (isDarkMode ? '#4caf50' : '#16A34A') : (isDarkMode ? 'rgba(255,255,255,0.3)' : '#9CA3AF') }
                  ]} />
                  <Text style={[
                    styles.statusText,
                    { color: online ? (isDarkMode ? '#4caf50' : '#15803D') : (isDarkMode ? 'rgba(255,255,255,0.5)' : '#4B5563') }
                  ]}>
                    {online ? 'CONECTADO' : 'DESCONECTADO'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.brand.primary} />
              </View>
            </TouchableOpacity>
          );
        }}

        ListEmptyComponent={
          <View style={styles.centrado}>
            <Ionicons name="videocam-off-outline" size={48} color={isDarkMode ? '#ffffff30' : '#9CA3AF'} />
            <Text style={styles.vacio}>Sin cámaras registradas</Text>
          </View>
        }
      />


      {/* MODAL DE VIDEO */}
      <Modal
        visible={!!selected}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modal}>

          {/* HEADER MODAL */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitulo}>{selected?.name}</Text>
              <Text style={styles.modalSub}>Stream en vivo</Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelected(null)}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={isDarkMode ? "#fff" : "#111827"} />
            </TouchableOpacity>
          </View>

          {/* STREAM MODO TOGGLE */}
          <View style={styles.modeToggleContainer}>
            <TouchableOpacity
              style={[styles.modeToggle, streamMode === 'webrtc' && styles.modeToggleActive]}
              onPress={() => setStreamMode('webrtc')}
            >
              <Text style={[styles.modeToggleText, streamMode === 'webrtc' && styles.modeToggleTextActive]}>WebRTC</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeToggle, streamMode === 'hls' && styles.modeToggleActive]}
              onPress={() => setStreamMode('hls')}
            >
              <Text style={[styles.modeToggleText, streamMode === 'hls' && styles.modeToggleTextActive]}>HLS JS</Text>
            </TouchableOpacity>
          </View>

          {/* URL DE DEBUG PARA EL USUARIO */}
          {selected && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
              <Text style={{ color: isDarkMode ? '#ffeb3b' : '#2563EB', fontSize: 10, textAlign: 'center' }}>
                DEBUG URL: {streamMode === 'hls' ? getHlsUrl(selected).split('?')[0] : getWebRtcUrl(selected)}
              </Text>
            </View>
          )}

          {/* VIDEO CONTENEDOR - usamos key para que solo se recargue al cambiar cámara/modo */}
          {selected && (
            <View style={styles.videoContainer}>
              <WebView
                key={`stream-${selected.id}-${streamMode}`}
                source={
                  streamMode === 'webrtc'
                    ? (isFrpConnection()
                        ? { uri: `${getWebRtcUrl(selected)}?token=${workspaceTokenForStream}` }
                        : { html: getWebRtcHtml(selected), baseUrl: getWebViewBaseUrl() }
                      )
                    : { html: getHlsHtml(selected), baseUrl: getWebViewBaseUrl() }
                }
                style={styles.webview}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                allowsFullscreenVideo={true}
                originWhitelist={['*']}
                domStorageEnabled={true}
                javaScriptEnabled={true}
                mixedContentMode="always"
                // @ts-ignore
                onPermissionRequest={(event: any) => event.grant(event.resources)}
                onMessage={(event) => {
                  try {
                    const evt = JSON.parse(event.nativeEvent.data);
                    if (evt.type === 'stream_status' && selected) {
                      updateStreamStatus(selected.id, evt.protocol, evt.state);
                    }
                    if (evt.type === 'draw_streaming') {
                      console.log('📌 OJO AQUÍ, JSON CHIVATO:', JSON.stringify(evt.payload, null, 2));
                    }
                  } catch (e) { }
                }}
              />
            </View>
          )}

          {/* LA TABLA / LISTADO DE EVENTOS */}
          <FlatList
            data={filteredEvents}
            keyExtractor={(item) => item.id.toString()}
            style={{ flex: 1, backgroundColor: isDarkMode ? '#0d0d0d' : '#f9fafb' }}
            contentContainerStyle={{ padding: 20, paddingTop: 5 }}
            ListHeaderComponent={
              <View style={{ marginBottom: 15 }}>
                <Text style={styles.eventsTitle}>REGISTROS DE ACTIVIDAD</Text>
              </View>
            }
            renderItem={({ item }) => {
              const urlImage = getMediaUrl(item.url_evidence || item.face_detected_url, domain);

              let displayTime = '--:--:--';
              if (item.createdAt) {
                try {
                  const date = new Date(item.createdAt);
                  displayTime = date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                } catch (e) { }
              }

              let vinfoObj: any = {};
              if (item.vinfo) {
                try {
                  vinfoObj = typeof item.vinfo === 'string' ? JSON.parse(item.vinfo) : item.vinfo;
                } catch (e) { }
              }

              const alertName = (
                vinfoObj?.name ||
                vinfoObj?.alarm_name ||
                vinfoObj?.alarmName ||
                (item.device?.name && item.device.name !== 'Cámara' && item.device.name !== 'Cámara Principal' ? item.device.name : '') ||
                item.motive_categorie ||
                'Alerta'
              ).trim();

              const title = item.tag && item.tag !== 'alert' ? item.tag : 'Alerta';

              const getAnalyticTheme = (tag: string) => {
                const motive = (tag || '').toLowerCase();
                if (motive.includes('face') || motive.includes('rostro') || motive.includes('aforo')) {
                  return { icon: 'person-outline', color: isDarkMode ? '#5AC8FA' : '#0891B2' };
                } else if (motive.includes('intrusion') || motive.includes('critical') || motive.includes('error') || motive.includes('motion')) {
                  return { icon: 'walk-outline', color: isDarkMode ? '#F44336' : '#DC2626' };
                } else if (motive.includes('lpr') || motive.includes('placa') || motive.includes('car')) {
                  return { icon: 'car-outline', color: isDarkMode ? Colors.brand.primary : '#1D4ED8' };
                } else if (motive.includes('objeto') || motive.includes('cube') || motive.includes('arma')) {
                  return { icon: 'cube-outline', color: isDarkMode ? '#FF9800' : '#B45309' };
                }
                return { icon: 'shield-checkmark-outline', color: isDarkMode ? Colors.brand.primary : '#1D4ED8' };
              };

              const themeStyle = getAnalyticTheme(item.tag || item.motive_categorie || '');

              return (
                <TouchableOpacity
                  style={styles.eventRow}
                  onPress={() => {
                    setSelected(null);
                    router.push(`/(tabs)/alerts?alertId=${item.id}&createdAt=${item.createdAt}`);
                  }}
                  activeOpacity={0.7}
                >
                  <ImageBackground
                    source={{ uri: urlImage || 'https://images.unsplash.com/photo-1557597774-9d273605dfa9' }}
                    style={styles.eventThumb}
                    imageStyle={{ borderRadius: 6 }}
                  />
                  <View style={styles.eventDetails}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons
                        name={themeStyle.icon as any}
                        size={13}
                        color={themeStyle.color}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={{ color: isDarkMode ? '#ffffff' : '#111827', fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
                        {title}
                      </Text>
                    </View>
                    <Text style={{ color: isDarkMode ? '#ffffff60' : '#6b7280', fontSize: 11, marginTop: 4 }}>
                      {displayTime} • {alertName}
                    </Text>
                  </View>
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderWidth: 1,
                    borderRadius: 4,
                    marginLeft: 8,
                    backgroundColor: themeStyle.color + '15',
                    borderColor: themeStyle.color + '40',
                  }}>
                    <Text style={{
                      color: themeStyle.color,
                      fontSize: 11,
                      fontFamily: 'monospace',
                      fontWeight: '600',
                    }}>
                      {Math.round(item.probability > 1 ? item.probability : item.probability * 100)}%
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyEvents}>
                <Ionicons name="folder-open-outline" size={32} color={isDarkMode ? "#ffffff20" : "#9CA3AF"} />
                <Text style={styles.emptyEventsText}>Sin alertas en las últimas 24h</Text>
              </View>
            }
          />

        </View>
      </Modal>


    </View>
  );
}

const getStyles = (isDark: boolean) => {
  const themeColors = isDark ? Colors.dark : Colors.light;
  const bgMain = themeColors.background;
  const bgCard = themeColors.surface;
  const textPrimary = themeColors.text;
  const textSecondary = themeColors.textSecondary;
  const textMuted = themeColors.textMuted;
  const borderCol = themeColors.border;
  const modalBg = isDark ? '#000000' : '#f9fafb';
  const toggleBg = isDark ? '#111112' : '#e5e7eb';
  const toggleText = isDark ? '#ffffff' : '#6b7280';
  const bgCardSecondary = themeColors.surfaceSecondary;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: bgMain,
    },
    centrado: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 80,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 4,
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 50,
      borderBottomWidth: 0,
      backgroundColor: bgMain,
    },

    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: themeColors.inputBg,
      borderWidth: 1,
      borderColor: themeColors.inputBorder,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Layout.borderRadius.input,
    },

    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.inputBg,
      height: Layout.height.input,
      borderRadius: Layout.borderRadius.input,
      paddingHorizontal: 15,
      borderWidth: 1,
      borderColor: themeColors.inputBorder,
    },
    modeToggleContainer: {
      flexDirection: 'row',
      marginHorizontal: 20,
      marginTop: 10,
      backgroundColor: toggleBg,
      borderRadius: 8,
      padding: 4,
    },
    modeToggle: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 6,
    },
    modeToggleActive: {
      backgroundColor: Colors.brand.primary,
    },
    modeToggleText: {
      color: toggleText,
      fontSize: 13,
      fontWeight: '600',
    },
    modeToggleTextActive: {
      color: '#ffffff',
    },
    lista: {
      paddingHorizontal: 16,
      gap: 15,
      paddingBottom: 20,
    },
    gridRow: {
      justifyContent: 'space-between',
    },
    cardGrid: {
      width: '48.5%',
      backgroundColor: bgCard,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: borderCol,
      aspectRatio: 4 / 3,
      marginBottom: 12,
      shadowColor: isDark ? 'transparent' : '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.04,
      shadowRadius: 8,
      elevation: isDark ? 0 : 2,
    },

    cardGridTop: {
      width: '100%',
      height: '100%',
      backgroundColor: isDark ? '#000000' : '#F1F5F9',
      position: 'relative',
    },

    cardInfoOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '55%',
      justifyContent: 'flex-end',
      padding: 10,
      backgroundColor: isDark ? 'rgba(26, 28, 44, 0.85)' : '#FFFFFF',
    },
    badgeWarning: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: 'rgba(254, 170, 0, 0.9)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    badgeWarningText: {
      color: '#000',
      fontSize: 9,
      fontWeight: 'bold',
      letterSpacing: 1,
    },
    cardGridName: {
      color: textPrimary,
      fontSize: 11,
      fontWeight: '600',
    },
    cardGridStatus: {
      color: textSecondary,
      fontSize: 9,
      marginLeft: 4,
      fontWeight: '500',
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    card: {
      backgroundColor: bgCard,
      borderRadius: 12,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: borderCol,
      shadowColor: isDark ? 'transparent' : '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.03,
      shadowRadius: 6,
      elevation: isDark ? 0 : 1,
    },
    cardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: isDark ? Colors.brand.primary + '18' : '#e0f2fe',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? Colors.brand.primary + '30' : '#bae6fd',
    },
    cardInfo: {
      flex: 1,
    },
    cardNombre: {
      color: textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },

    cardRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },

    statusText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
    },
    vacio: {
      color: textMuted,
      fontSize: 14,
      marginTop: 16,
    },
    modal: {
      flex: 1,
      backgroundColor: modalBg,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: borderCol,
    },
    modalTitulo: {
      color: textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    modalSub: {
      color: Colors.brand.primary,
      fontSize: 11,
      marginTop: 3,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? '#ffffff10' : '#e5e7eb',
      justifyContent: 'center',
      alignItems: 'center',
    },
    videoContainer: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: '#000000',
      marginTop: 20,
      marginBottom: 20,
    },
    webview: {
      flex: 1,
      backgroundColor: 'transparent',
    },

    eventsTitle: {
      color: textPrimary,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 15,
      marginBottom: 5,
      textTransform: 'uppercase',
    },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: bgCard,
      padding: 10,
      borderRadius: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: borderCol,
    },
    eventThumb: {
      width: 46,
      height: 46,
      borderRadius: 6,
      marginRight: 12,
      backgroundColor: '#000',
    },
    eventDetails: {
      flex: 1,
    },

    emptyEvents: {
      paddingVertical: 30,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    emptyEventsText: {
      color: textMuted,
      fontSize: 12,
      textAlign: 'center',
    },

  });
};
