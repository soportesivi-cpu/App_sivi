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
import { getDevices, getWorkspacesDevices, getAlerts, getObjects, getMediaUrl } from '../../services/api';
import { PROD_MEDIA_DOMAIN } from '../../constants/config';
import Loading from '../../components/Loading';

import React, { useEffect, useState, useRef, useMemo } from 'react';

type Camera = {
  id: number;
  name: string;
  deviceId: string;
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
  recording?: {
    configured: boolean;
    active: boolean;
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
    const isIpOrLocal = /^\d+\.\d+\.\d+\.\d+/.test(domain || '') || domain?.includes('localhost') || domain?.includes('local.imperium.pe');
    if (isIpOrLocal && domain) {
      const parts = domain.split(':');
      const host = parts[0];
      const apiPort = parts[1];
      if (host === '63.141.255.156' || host === 'local.imperium.pe' || apiPort === '19090' || apiPort === '29090' || apiPort === '39090') {
        return `https://local.imperium.pe`;
      }
      return `http://${host}`;
    }
    return `https://${PROD_MEDIA_DOMAIN}`;
  };

  const [selected, setSelected] = useState<Camera | null>(null);
  const [streamMode, setStreamMode] = useState<'hls' | 'webrtc'>('webrtc'); // Favorecemos webrtc como default
  const [searchQuery, setSearchQuery] = useState('');

  const [viewMode, setViewMode] = useState<'list' | 'grid'>(isLocal ? 'list' : 'grid');
  const [streamStatus, setStreamStatus] = useState<Record<number, CameraStreamStatus>>({});
  const [cameraThumbnails, setCameraThumbnails] = useState<Record<number, string>>({});
  const [_thumbnailFailures, setThumbnailFailures] = useState<Record<number, boolean>>({});
  const [thumbnailCameraId, setThumbnailCameraId] = useState<number | null>(null);
  const webViewRef = useRef<WebView>(null);

  // Forzar modo lista en local
  useEffect(() => {
    if (isLocal) {
      setViewMode('list');
    }
  }, [isLocal]);

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

  const { data: qData, isLoading: loading } = useQuery({
    queryKey: ['cameras', domain, activeSession],
    queryFn: async () => {
      if (isLocal) {
        return getDevices();
      }
      if (activeSession.length === 0) {
        return { workspaces: [], failures: [] };
      }
      return getWorkspacesDevices(activeSession);
    },
  });

  const rawCameras = useMemo((): Camera[] => {
    if (isLocal) {
      return qData?.rows || [];
    }
    const wsData = qData?.workspaces?.[0];
    return wsData?.devices || [];
  }, [qData, isLocal]);

  const filteredCameras = useMemo(() => {
    return rawCameras.filter(cam => {
      return cam.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [rawCameras, searchQuery]);

  const cameras = filteredCameras;
  const thumbnailCamera = thumbnailCameraId
    ? cameras.find(camera => camera.id === thumbnailCameraId) || null
    : null;

  useEffect(() => {
    if (!rawCameras.length) return;

    let isMounted = true;

    rawCameras.forEach((camera) => {
      // 1. Si la API consolidada ya nos provee el estado RTSP oficial desde el backend,
      // confiamos en él inmediatamente y evitamos pings locales fallidos por SSL/CORS.
      if (camera.rtspStatus && camera.rtspStatus.primary) {
        if (!isMounted) return;
        const statusState = camera.rtspStatus.primary === 'online' ? 'connected' : 'disconnected';
        setStreamStatus(prev => {
          // Solo actualizamos si el estado actual es diferente o no existe para evitar re-renders infinitos
          if (prev[camera.id]?.hls === statusState && prev[camera.id]?.webrtc === statusState) {
            return prev;
          }
          return {
            ...prev,
            [camera.id]: {
              hls: statusState,
              webrtc: statusState,
            }
          };
        });
        return;
      }

      // 2. Si no hay estado oficial de la API, procedemos con la validación de red local
      if (streamStatus[camera.id]?.hls === 'connected' || streamStatus[camera.id]?.webrtc === 'connected') return;

      validateCameraStreams(camera).then((status) => {
        if (!isMounted) return;
        setStreamStatus(prev => ({
          ...prev,
          [camera.id]: status,
        }));
      });
    });

    return () => {
      isMounted = false;
    };
  }, [rawCameras, token]);

  // Desactivamos temporalmente la generación automática para estabilizar la app
  /*
  useEffect(() => {
    if (viewMode !== 'grid' || thumbnailCameraId !== null) return;
    // ... logic ...
  }, [viewMode, cameras, streamStatus, cameraThumbnails, thumbnailFailures, thumbnailCameraId]);
  */

  // Obtenemos los eventos históricos, idealmente con polling si la modal está abierta

  const { data: objectsData } = useQuery({
    queryKey: ['camera_objects_live', selected?.id],
    queryFn: () => getObjects(1),
    enabled: !!selected,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const { data: actionsData } = useQuery({
    queryKey: ['camera_actions_live', selected?.id],
    queryFn: () => getAlerts(1),
    enabled: !!selected,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const filteredEvents = useMemo(() => {
    const objs = (objectsData?.rows || []).filter((a: any) => {
      return a.deviceId === selected?.deviceId || a?.device?.deviceId === selected?.deviceId || a?.device?.name === selected?.name || a?.Device?.name === selected?.name;
    });
    const acts = (actionsData?.rows || []).filter((a: any) => {
      return a.deviceId === selected?.deviceId || a?.device?.deviceId === selected?.deviceId || a?.device?.name === selected?.name || a?.Device?.name === selected?.name;
    });
    return [...objs, ...acts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [objectsData, actionsData, selected]);

  function formatShortDate(d: string) {
    if (!d) return '--';
    return new Date(d).toLocaleString('es-PE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getStreamName(camera: Camera): string {
    // Forzar el formato oficial del servidor ({id}-{deviceId}/1) para TODAS las cámaras
    // Ignoramos campos antiguos de BD (stream_name, rtsp, rtsp2) que traen nombres desactualizados.
    if (camera.id && camera.deviceId) {
      const result = `${camera.id}-${camera.deviceId}/1`;
      console.log(`[STREAM] getStreamName(${camera.name}): FORZADO = "${result}"`);
      return result;
    }

    const fallback = camera.deviceId || `camara${camera.id}`;
    return fallback;
  }

  /**
   * URL HLS — Apunta al servidor real en producción o al túnel FRP en entornos locales.
   */
  function getHlsUrl(camera: Camera, cacheBust?: number): string {
    const suffix = cacheBust ? `?_cb=${cacheBust}` : '';
    const streamName = getStreamName(camera);

    const isIpOrLocal = /^\d+\.\d+\.\d+\.\d+/.test(domain || '') || domain?.includes('localhost') || domain?.includes('local.imperium.pe');
    if (isIpOrLocal && domain) {
      const parts = domain.split(':');
      const host = parts[0];
      const apiPort = parts[1];

      // Si es a través del túnel FRP (IP, subdominio local o puertos del túnel 19090/29090/39090)
      if (host === '63.141.255.156' || host === 'local.imperium.pe' || apiPort === '19090' || apiPort === '29090' || apiPort === '39090') {
        let hlsHttpsPort = '18891'; // default para túnel 1 (19090)
        if (apiPort === '29090') hlsHttpsPort = '28891';
        else if (apiPort === '39090') hlsHttpsPort = '38891';

        return `https://local.imperium.pe:${hlsHttpsPort}/${streamName}/index.m3u8${suffix}`;
      }

      // Si es conexión local o VPN directa
      let hlsPort = '8888';
      return `http://${host}:${hlsPort}/${streamName}/index.m3u8${suffix}`;
    }

    return `https://${PROD_MEDIA_DOMAIN}:8888/${streamName}/index.m3u8${suffix}`;
  }

  /**
   * URL WHEP (WebRTC) — Apunta al servidor real en producción o al túnel FRP en entornos locales.
   */
  function getWebRtcUrl(camera: Camera): string {
    const streamName = getStreamName(camera);

    const isIpOrLocal = /^\d+\.\d+\.\d+\.\d+/.test(domain || '') || domain?.includes('localhost') || domain?.includes('local.imperium.pe');
    if (isIpOrLocal && domain) {
      const parts = domain.split(':');
      const host = parts[0];
      const apiPort = parts[1];

      // Si es a través del túnel FRP (IP, subdominio local o puertos del túnel 19090/29090/39090)
      if (host === '63.141.255.156' || host === 'local.imperium.pe' || apiPort === '19090' || apiPort === '29090' || apiPort === '39090') {
        let whepHtpsPort = '18890'; // default para túnel 1 (19090)
        if (apiPort === '29090') whepHtpsPort = '28890';
        else if (apiPort === '39090') whepHtpsPort = '38890';

        return `https://local.imperium.pe:${whepHtpsPort}/${streamName}/`;
      }

      // Si es conexión local o VPN directa
      let whepPort = '8889';
      return `http://${host}:${whepPort}/${streamName}/`;
    }

    return `https://${PROD_MEDIA_DOMAIN}:8889/${streamName}/`;
  }

  function getCameraThumbnail(_camera: Camera) {
    return 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=300&q=80';
  }

  function getThumbnailCaptureHtml(camera: Camera) {
    const videoUrl = getHlsUrl(camera);
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <script src="https://cdn.jsdelivr.net/npm/hls.js@1.4.12"></script>
        <style>
          html, body { margin: 0; padding: 0; width: 160px; height: 90px; background: #050505; overflow: hidden; }
          video { width: 160px; height: 90px; object-fit: cover; background: #050505; }
          canvas { display: none; }
        </style>
      </head>
      <body>
        <video id="video" autoplay muted playsinline></video>
        <canvas id="canvas" width="320" height="180"></canvas>
        <script>
          var video = document.getElementById('video');
          var canvas = document.getElementById('canvas');
          var url = '${videoUrl}';
          var attempts = 0;
          var done = false;

          video.crossOrigin = 'anonymous';

          function post(payload) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify(payload));
            }
          }

          function fail() {
            if (done) return;
            done = true;
            post({ type: 'camera_thumbnail_failed', cameraId: ${camera.id} });
          }

          function capture() {
            if (done) return;
            attempts += 1;

            if (!video.videoWidth || !video.videoHeight) {
              if (attempts > 10) fail();
              else setTimeout(capture, 500);
              return;
            }

            try {
              var ctx = canvas.getContext('2d');
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              var uri = canvas.toDataURL('image/jpeg', 0.72);
              done = true;
              post({ type: 'camera_thumbnail', cameraId: ${camera.id}, uri: uri });
            } catch (e) {
              if (attempts > 10) fail();
              else setTimeout(capture, 500);
            }
          }

          video.addEventListener('loadeddata', function() { setTimeout(capture, 400); });
          video.addEventListener('canplay', function() { setTimeout(capture, 400); });
          video.addEventListener('error', fail);
          setTimeout(fail, 9000);

          if (window.Hls && Hls.isSupported()) {
            var hls = new Hls({ debug: false, enableWorker: true, lowLatencyMode: true });
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
              video.play().catch(function() {});
            });
            hls.on(Hls.Events.ERROR, function(e, data) {
              if (data && data.fatal) fail();
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.addEventListener('loadedmetadata', function() {
              video.play().catch(function() {});
            });
          } else {
            fail();
          }
        </script>
      </body>
      </html>
    `;
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
      const playlistUrl = getHlsUrl(camera);
      // Petición GET rápida de texto con timeout de 1500ms
      const res = await fetchWithTimeout(playlistUrl, { cache: 'no-store' as any }, 1500);
      if (!res.ok) return 'disconnected';

      const text = await res.text();
      // Si contiene la cabecera estándar de HLS, el stream está activo
      return text.includes('#EXTM3U') ? 'connected' : 'disconnected';
    } catch {
      // Si ocurre un error de red/SSL en el celular, asumimos defensivamente que está CONNECTED
      return 'connected';
    }
  }

  async function validateWebRtcEndpoint(camera: Camera): Promise<StreamState> {
    try {
      const streamToken = workspaceTokenForStream;
      const headers = streamToken ? { Authorization: `Bearer ${streamToken}` } : undefined;
      const res = await fetchWithTimeout(getWebRtcUrl(camera), {
        method: 'OPTIONS',
        headers,
      });
      return res.status >= 200 && res.status < 500 && res.status !== 404 ? 'connected' : 'disconnected';
    } catch {
      // Si ocurre un error de red/SSL en el celular, asumimos defensivamente que está CONNECTED
      return 'connected';
    }
  }

  async function validateCameraStreams(camera: Camera): Promise<CameraStreamStatus> {
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
    const status = getCameraStatus(camera);
    if (status.hls === 'connected' || status.webrtc === 'connected') return true;
    if (camera.rtspStatus?.primary === 'online') return true;
    return false;
  }





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

  if (loading) {
    return <Loading />;
  }

  const styles = getStyles(isDarkMode);

  return (
    <View style={styles.container}>
      {/* HEADER TOP BAR SIVI */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#2E9BFF20', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="shield-checkmark" size={18} color="#2E9BFF" />
          </View>
          <Text style={{ color: '#2E9BFF', fontSize: 20, fontWeight: '900', letterSpacing: -1, marginLeft: 10 }}>SIVI</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {!isLocal && (
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            >
              <Ionicons name={viewMode === 'grid' ? "list" : "grid"} size={16} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 4, marginBottom: 15 }}>
        <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '800' }}>Red de Cámaras</Text>
      </View>


      {/* SEARCH BAR (Automatizado Local) */}
      <View style={{ paddingHorizontal: 20, marginBottom: 15 }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#1A1C2C',
          height: 48,
          borderRadius: 12,
          paddingHorizontal: 15,
          borderWidth: 1,
          borderColor: '#ffffff15'
        }}>
          <Ionicons name="search" size={18} color="#ffffff60" />
          <TextInput
            placeholder="Buscar cámara por nombre..."
            placeholderTextColor="#ffffff30"
            style={{ flex: 1, color: '#fff', fontSize: 14, marginLeft: 10, fontWeight: '500' }}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#ffffff60" />
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
        renderItem={({ item }) => {
          const online = isOnline(item);

          if (viewMode === 'grid') {
            return (
              <TouchableOpacity
                style={[styles.cardGrid, !online && styles.cardGridOffline]}
                onPress={() => setSelected(item)}
              >
                <ImageBackground
                  source={{ uri: cameraThumbnails[item.id] || getCameraThumbnail(item) }}
                  style={styles.cardGridTop}
                  imageStyle={!online ? { opacity: 0.5 } : {}}
                >
                  {online && item.hasMotion ? (
                    <View style={styles.badgeWarning}>
                      <Ionicons name="warning" size={10} color="#000" />
                      <Text style={styles.badgeWarningText}>MVT</Text>
                    </View>
                  ) : online && (isLocal || item.recording?.active) ? (
                    <View style={styles.badgeRec}>
                      <View style={[styles.statusDot, { backgroundColor: '#fff' }]} />
                      <Text style={styles.badgeRecText}>REC</Text>
                    </View>
                  ) : null}

                  {!online && (
                    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                      <View style={{ backgroundColor: '#161622', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ffffff10' }}>
                        <Ionicons name="videocam-off" size={14} color="#ffffff" />
                        <Text style={{ color: '#ffffff', fontSize: 10, marginLeft: 4 }}>Offline</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.cardInfoOverlay}>
                    <Text style={styles.cardGridName} numberOfLines={1}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
                      <Ionicons
                        name={item.hasMotion ? "flash" : "ellipse"}
                        size={item.hasMotion ? 10 : 8}
                        color={item.hasMotion ? "#FEAA00" : online ? "#4caf50" : "#ff4444"}
                      />
                      <Text style={[
                        styles.cardGridStatus,
                        item.hasMotion && { color: '#FEAA00' },
                        online && !item.hasMotion && { color: '#4caf50' },
                        !online && { color: '#ff4444' }
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
                <View style={[styles.iconContainer, item.hasMotion && { backgroundColor: '#FEAA0020' }]}>
                  <Ionicons
                    name={item.hasMotion ? "warning" : "videocam"}
                    size={20}
                    color={item.hasMotion ? '#FEAA00' : online ? '#2E9BFF' : '#ffffff60'}
                  />
                </View>
                <View style={styles.cardInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.cardNombre}>{item.name}</Text>
                    {online && (isLocal || item.recording?.active) && (
                      <View style={{ backgroundColor: '#ff444420', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#ff444440' }}>
                        <Text style={{ color: '#ff4444', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }}>REC</Text>
                      </View>
                    )}
                  </View>
                  {item.hasMotion && (
                    <Text style={{ color: '#FEAA00', fontSize: 10, fontWeight: '700' }}>• MOVIMIENTO</Text>
                  )}
                </View>
              </View>
              <View style={styles.cardRight}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: online ? '#4caf5018' : '#ffffff08' }
                ]}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: online ? '#4caf50' : '#ffffff40' }
                  ]} />
                  <Text style={[
                    styles.statusText,
                    { color: online ? '#4caf50' : '#ffffff80' }
                  ]}>
                    {online ? 'CONECTADO' : 'DESCONECTADO'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#2E9BFF" />
              </View>
            </TouchableOpacity>
          );
        }}

        ListEmptyComponent={
          <View style={styles.centrado}>
            <Ionicons name="videocam-off-outline" size={48} color="#333" />
            <Text style={styles.vacio}>Sin cámaras registradas</Text>
          </View>
        }
      />

      {thumbnailCamera && (
        <View style={styles.thumbnailWorker}>
          <WebView
            key={thumbnailCamera.id}
            source={{ html: getThumbnailCaptureHtml(thumbnailCamera), baseUrl: getWebViewBaseUrl() }}
            style={styles.thumbnailWorkerWebview}
            scrollEnabled={false}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onMessage={(event) => {
              try {
                const evt = JSON.parse(event.nativeEvent.data);

                if (evt.type === 'camera_thumbnail' && evt.uri) {
                  setCameraThumbnails(prev => ({
                    ...prev,
                    [evt.cameraId]: evt.uri,
                  }));
                  setThumbnailCameraId(null);
                }

                if (evt.type === 'camera_thumbnail_failed') {
                  setThumbnailFailures(prev => ({
                    ...prev,
                    [evt.cameraId]: true,
                  }));
                  setThumbnailCameraId(null);
                }
              } catch (e) {
                setThumbnailFailures(prev => ({
                  ...prev,
                  [thumbnailCamera.id]: true,
                }));
                setThumbnailCameraId(null);
              }
            }}
          />
        </View>
      )}

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
               <Text style={{ color: '#ffeb3b', fontSize: 10, textAlign: 'center' }}>
                  DEBUG URL: {streamMode === 'hls' ? getHlsUrl(selected).split('?')[0] : getWebRtcUrl(selected)}
               </Text>
            </View>
          )}

          {/* VIDEO CONTENEDOR - usamos key para que solo se recargue al cambiar cámara/modo */}
          {selected && (
            <View style={styles.videoContainer}>
              <WebView
                key={`stream-${selected.id}-${streamMode}`}
                ref={webViewRef}
                source={
                  streamMode === 'webrtc'
                    ? { uri: `${getWebRtcUrl(selected)}?token=${workspaceTokenForStream}` }
                    : { html: getHlsHtml(selected), baseUrl: getWebViewBaseUrl() }
                }
                style={styles.webview}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ color: '#ffffff60', fontSize: 12, fontWeight: '700' }}>UBICACIÓN:</Text>
                  <Text style={{ color: '#ffffff', fontSize: 13 }}>Sector Principal - {selected?.name?.replace(/_/g, ' ')}</Text>
                </View>
                <Text style={styles.eventsTitle}>REGISTROS DE ACTIVIDAD</Text>
              </View>
            }
            renderItem={({ item }) => {
              const urlImage = getMediaUrl(item.url_evidence || item.face_detected_url, domain);
              return (
                <View style={styles.eventRow}>
                  <ImageBackground
                    source={{ uri: urlImage || 'https://images.unsplash.com/photo-1557597774-9d273605dfa9' }}
                    style={styles.eventThumb}
                    imageStyle={{ borderRadius: 6 }}
                  />
                  <View style={styles.eventDetails}>
                    <Text style={styles.eventTag}>{item.tag?.toUpperCase() || item.motive_categorie?.toUpperCase() || 'ALERTA'}</Text>
                    <Text style={styles.eventDate}>{formatShortDate(item.createdAt)}</Text>
                  </View>
                  <View style={styles.eventProbBox}>
                    <Text style={styles.eventProb}>{Math.round(item.probability > 1 ? item.probability : item.probability * 100)}%</Text>
                    <Text style={styles.eventProbLabel}>PROB.</Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyEvents}>
                <Ionicons name="folder-open-outline" size={32} color="#ffffff20" />
                <Text style={styles.emptyEventsText}>No hay eventos registrados para esta cámara.</Text>
              </View>
            }
          />

        </View>
      </Modal>


    </View>
  );
}

const getStyles = (isDark: boolean) => {
  const bgMain = isDark ? '#000000' : '#f3f4f6';
  const bgCard = isDark ? '#1A1C2C' : '#ffffff';
  const textPrimary = '#ffffff';
  const textSecondary = isDark ? '#ffffff90' : '#6b7280';
  const textMuted = isDark ? '#ffffff60' : '#9ca3af';
  const borderCol = isDark ? '#ffffff10' : '#e5e7eb';
  const modalBg = isDark ? '#000000' : '#f9fafb';
  const toggleBg = isDark ? '#111112' : '#e5e7eb';
  const toggleText = isDark ? '#ffffff' : '#6b7280';

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
    headerTitleWrap: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    titulo: {
      color: textPrimary,
      fontSize: 24,
      fontWeight: '700',
    },
    toggleGroup: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#161622' : '#e5e7eb',
      borderRadius: 4,
      borderWidth: 1,
      borderColor: borderCol,
      overflow: 'hidden',
    },
    toggleBtn: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
    toggleBtnActive: {
      backgroundColor: '#2E9BFF20',
    },
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? '#161622' : '#ffffff',
      borderWidth: 1,
      borderColor: borderCol,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 4,
    },
    filterBtnText: {
      color: textPrimary,
      fontSize: 12,
      fontWeight: '500',
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
      backgroundColor: '#2E9BFF',
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
      paddingHorizontal: 20,
      gap: 15,
      paddingBottom: 20,
    },
    gridRow: {
      justifyContent: 'space-between',
    },
    cardGrid: {
      width: '48%',
      backgroundColor: bgCard,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: borderCol,
      aspectRatio: 16 / 9,
      marginBottom: 12,
    },
    cardGridOffline: {
      opacity: 0.6,
    },
    cardGridTop: {
      width: '100%',
      height: '100%',
      backgroundColor: '#000000',
      position: 'relative',
    },
    thumbnailWorker: {
      position: 'absolute',
      left: -500,
      top: -500,
      width: 160,
      height: 90,
      opacity: 0.01,
    },
    thumbnailWorkerWebview: {
      width: 160,
      height: 90,
      backgroundColor: '#050505',
    },
    badgeRec: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: 'rgba(244, 67, 54, 0.9)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    badgeRecText: {
      color: '#fff',
      fontSize: 9,
      fontWeight: 'bold',
      letterSpacing: 1,
    },
    cardInfoOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '55%',
      justifyContent: 'flex-end',
      padding: 10,
      backgroundColor: 'rgba(26, 28, 44, 0.85)', // surfaceLow semi-transparente
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
      backgroundColor: isDark ? '#2196f318' : '#e0f2fe',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? '#2196f330' : '#bae6fd',
    },
    cardInfo: {
      flex: 1,
    },
    cardNombre: {
      color: textPrimary,
      fontSize: 13,
      fontWeight: '600',
    },
    cardId: {
      color: textMuted,
      fontSize: 10,
      marginTop: 3,
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
    filterModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterMenu: {
      width: '80%',
      backgroundColor: '#121214',
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: '#007AFF30',
    },
    filterMenuTitle: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 15,
      opacity: 0.6,
    },
    filterMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#ffffff08',
    },
    filterMenuItemActive: {
      backgroundColor: '#2E9BFF10',
      borderRadius: 8,
      paddingHorizontal: 10,
      marginLeft: -10,
      marginRight: -10,
    },
    filterMenuItemText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '500',
    },
    filterMenuItemTextActive: {
      color: '#2E9BFF',
      fontWeight: '700',
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
      color: '#2196f3',
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
    modalInfo: {
      padding: 20,
      gap: 12,
    },
    infoRow: {
      backgroundColor: bgCard,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: borderCol,
    },
    infoLabel: {
      color: textMuted,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    infoVal: {
      color: textSecondary,
      fontSize: 12,
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
    eventTag: {
      color: '#2196f3',
      fontSize: 11,
      fontWeight: '800',
    },
    eventDate: {
      color: textMuted,
      fontSize: 11,
      marginTop: 3,
    },
    eventProbBox: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    eventProb: {
      color: textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    eventProbLabel: {
      color: textMuted,
      fontSize: 9,
      fontWeight: '600',
      marginTop: 2,
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
    lastEventCard: {
      width: '100%',
      height: 160,
      borderRadius: 8,
      overflow: 'hidden',
    },
    lastEventImg: {
      width: '100%',
      height: '100%',
    },
    alertBadgeSmall: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: '#F44336A0',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      zIndex: 5,
    },
    alertBadgeText: {
      color: '#fff',
      fontSize: 9,
      fontWeight: 'bold',
      letterSpacing: 0.5,
    },
    lastEventOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 12,
      backgroundColor: 'rgba(0,0,0,0.7)',
    },
    lastEventTitle: {
      color: '#2E9BFF',
      fontSize: 13,
      fontWeight: '900',
      marginBottom: 2,
    },
    lastEventTime: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '500',
      opacity: 0.8,
    },
    emptyLastEvent: {
      backgroundColor: '#ffffff05',
      padding: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#ffffff10',
      alignItems: 'center',
    },
  });
};
