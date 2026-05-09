import { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
  ImageBackground
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../services/store';
import { getDevices, getAlerts, getFaces, getMotion, getObjects } from '../../services/api';
import { buildUrls } from '../../constants/config';
import Loading from '../../components/Loading';

const { width, height } = Dimensions.get('window');

type Camera = {
  id: number;
  name: string;
  deviceId: string;
  stream_name?: string;
  rtsp: string;
  container: any[];
};

type StreamState = 'checking' | 'connected' | 'disconnected';
type CameraStreamStatus = {
  hls: StreamState;
  webrtc: StreamState;
};

export default function CamerasScreen() {
  const { activeDomain: domain, jwtToken: token, isDarkMode } = useAppStore();
  const [selected, setSelected] = useState<Camera | null>(null);
  const [streamMode, setStreamMode] = useState<'hls' | 'webrtc'>('webrtc'); // Favorecemos webrtc como default
  const [activeLayer, setActiveLayer] = useState<'none' | 'motion' | 'face' | 'lpr'>('none');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid'); // Estado de vista
  const [streamStatus, setStreamStatus] = useState<Record<number, CameraStreamStatus>>({});
  const [cameraThumbnails, setCameraThumbnails] = useState<Record<number, string>>({});
  const [thumbnailFailures, setThumbnailFailures] = useState<Record<number, boolean>>({});
  const [thumbnailCameraId, setThumbnailCameraId] = useState<number | null>(null);
  const webViewRef = useRef<WebView>(null);

  // --- Memoización del HTML del stream para evitar bucles de recarga ---
  // Solo se regenera cuando cambia la cámara seleccionada o el modo de stream
  const memoizedStreamHtml = useRef<{ html: string; key: string } | null>(null);
  const streamUpdateRef = useRef(updateStreamStatus);

  // Hook genérico para disparar la orden al WebView cuando cambie la capa
  useEffect(() => {
    if (selected && webViewRef.current) {
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(`
            if(window.setAnalyticLayer) {
               window.setAnalyticLayer('${activeLayer}', '${getStreamName(selected)}', '${domain}');
            }
            true; // retornar true es necesario para inyecciones de script
          `);
      }, 500); // 500ms asegura que el WebView cargó las funciones
    }
  }, [activeLayer, selected]);

  const { data: qData, isLoading: loading } = useQuery({
    queryKey: ['cameras'],
    queryFn: () => getDevices(),
  });
  const cameras: Camera[] = qData?.rows || [];
  const thumbnailCamera = thumbnailCameraId
    ? cameras.find(camera => camera.id === thumbnailCameraId) || null
    : null;

  useEffect(() => {
    if (!cameras.length) return;

    let isMounted = true;

    cameras.forEach((camera) => {
      setStreamStatus(prev => ({
        ...prev,
        [camera.id]: prev[camera.id] || { hls: 'checking', webrtc: 'checking' },
      }));

      validateCameraStreams(camera).then((status) => {
        if (!isMounted) return;
        setStreamStatus(prev => ({
          ...prev,
          [camera.id]: {
            ...prev[camera.id],
            ...status,
          },
        }));
      });
    });

    return () => {
      isMounted = false;
    };
  }, [cameras, token]);

  useEffect(() => {
    if (viewMode !== 'grid' || thumbnailCameraId !== null) return;

    const nextCamera = cameras.find(camera =>
      isOnline(camera) &&
      !cameraThumbnails[camera.id] &&
      !thumbnailFailures[camera.id]
    );

    if (nextCamera) {
      setThumbnailCameraId(nextCamera.id);
    }
  }, [viewMode, cameras, streamStatus, cameraThumbnails, thumbnailFailures, thumbnailCameraId]);

  useEffect(() => {
    if (thumbnailCameraId === null) return;

    const timeout = setTimeout(() => {
      setThumbnailFailures(prev => ({ ...prev, [thumbnailCameraId]: true }));
      setThumbnailCameraId(null);
    }, 10000);

    return () => clearTimeout(timeout);
  }, [thumbnailCameraId]);

  // Obtenemos los eventos históricos, idealmente con polling si la modal está abierta
  const { data: alertsData } = useQuery({
    queryKey: ['camera_alerts_live', activeLayer],
    queryFn: () => {
      if (activeLayer === 'face') return getFaces(1);
      if (activeLayer === 'motion') return getMotion(1);
      if (activeLayer === 'lpr') return getObjects(1); // Mapeo temporal si lpr lo usa
      return getAlerts(1);
    },
    enabled: !!selected,
    refetchInterval: 5000,
  });

  const filteredEvents = (alertsData?.rows || []).filter((a: any) => {
    // Para endpoints puros (motion/face) muchas veces traen deviceId en su propia raiz
    const isDevice = a.deviceId === selected?.deviceId || a?.device?.deviceId === selected?.deviceId || a?.device?.name === selected?.name || a?.Device?.name === selected?.name;
    if (!isDevice) return false;
    // Si viene del endpoint directo, no filtramos por string porque la API ya lo decantó
    if (activeLayer === 'none') return true;
    return true;
  });

  function formatShortDate(d: string) {
    if (!d) return '--';
    return new Date(d).toLocaleString('es-PE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getStreamName(camera: Camera) {
    if (camera.stream_name) return camera.stream_name;
    // Fallback por si la API no devuelve stream_name (aunque la doc dice que sí)
    let cleanName = camera.name;
    if (cleanName.includes('_')) {
      let parts = cleanName.split('_');
      if (['bellavista'].includes(parts[0].toLowerCase())) {
        cleanName = cleanName.substring(cleanName.indexOf('_') + 1);
      }
    }
    return `${cleanName}-${camera.deviceId}`;
  }

  function getHlsUrl(camera: Camera, cacheBust?: number) {
    // MAGIA SSL: Igualmente cruzamos por el proxy certificado para el HLS
    // El cacheBust se genera UNA sola vez al abrir la cámara (evita loops de iOS)
    const suffix = cacheBust ? `?_cb=${cacheBust}` : '';
    return `https://alarms.guardian.imperium.pe/hls/${getStreamName(camera)}/index.m3u8${suffix}`;
  }

  function getWebRtcUrl(camera: Camera) {
    // MAGIA SSL: alarms.guardian.imperium.pe comparte el mismo Nginx que sivi 
    // pero TIENE el certificado SSL válido. React Native lo aceptará!
    return `https://alarms.guardian.imperium.pe/webrtc/${getStreamName(camera)}/whep`;
  }

  function getCameraThumbnail(camera: Camera) {
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

  function resolveUrl(baseUrl: string, path: string) {
    if (path.startsWith('http')) return path;
    const base = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    return base + path;
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
      const manifestRes = await fetchWithTimeout(playlistUrl, { cache: 'no-store' as any });
      if (!manifestRes.ok) return 'disconnected';

      const manifest = await manifestRes.text();
      if (!manifest.includes('#EXTM3U')) return 'disconnected';

      const mediaLine = manifest
        .split('\n')
        .map(line => line.trim())
        .find(line => line && !line.startsWith('#'));

      if (!mediaLine) return 'disconnected';

      const mediaUrl = resolveUrl(playlistUrl, mediaLine);
      if (mediaUrl.endsWith('.m3u8')) {
        const nestedRes = await fetchWithTimeout(mediaUrl, { cache: 'no-store' as any });
        if (!nestedRes.ok) return 'disconnected';

        const nestedManifest = await nestedRes.text();
        const segmentLine = nestedManifest
          .split('\n')
          .map(line => line.trim())
          .find(line => line && !line.startsWith('#'));

        if (!segmentLine) return 'disconnected';

        const segmentRes = await fetchWithTimeout(resolveUrl(mediaUrl, segmentLine), {
          headers: { Range: 'bytes=0-256' },
        });
        return segmentRes.ok || segmentRes.status === 206 ? 'connected' : 'disconnected';
      }

      const segmentRes = await fetchWithTimeout(mediaUrl, {
        headers: { Range: 'bytes=0-256' },
      });
      return segmentRes.ok || segmentRes.status === 206 ? 'connected' : 'disconnected';
    } catch {
      return 'disconnected';
    }
  }

  async function validateWebRtcEndpoint(camera: Camera): Promise<StreamState> {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetchWithTimeout(getWebRtcUrl(camera), {
        method: 'OPTIONS',
        headers,
      });
      return res.status >= 200 && res.status < 500 && res.status !== 404 ? 'connected' : 'disconnected';
    } catch {
      return 'disconnected';
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
    return status.hls === 'connected' || status.webrtc === 'connected';
  }

  function getStatusLabel(camera: Camera) {
    const status = getCameraStatus(camera);
    if (status.hls === 'checking' || status.webrtc === 'checking') return 'verificando';
    if (status.hls === 'connected' && status.webrtc === 'connected') return 'HLS/WebRTC';
    if (status.hls === 'connected') return 'HLS conectado';
    if (status.webrtc === 'connected') return 'WebRTC conectado';
    return 'desconectada';
  }

  function getWebRtcHtml(camera: Camera) {
    const whepUrl = getWebRtcUrl(camera);
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <!-- IMPORTANTE: Cargamos Socket.IO v2 para compatibilidad con EIO=3 del servidor SIVI -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.3.0/socket.io.js"></script>
        <style>
          body { margin: 0; padding: 0; background-color: #0d0d0d; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; position: relative; }
          video { width: 100vw; height: 100vh; object-fit: contain; position: absolute; top: 0; left: 0; z-index: 1; transition: opacity 0.3s; }
          img#mjpeg { width: 100vw; height: 100vh; object-fit: contain; position: absolute; top: 0; left: 0; z-index: 2; pointer-events: none; display: none; }
          canvas#overlay { width: 100vw; height: 100vh; position: absolute; top: 0; left: 0; z-index: 3; pointer-events: none; display: none; }
          .error { color: white; background: rgba(255,0,0,0.8); font-family: sans-serif; text-align: center; position: absolute; top: 10px; z-index: 10; padding: 10px; border-radius: 8px; display: none; }
        </style>
      </head>
      <body>
        <div id="err" class="error"></div>
        <div id="debug" style="position:absolute; top:60px; left:10px; z-index:9999; color:lime; font-size:10px; background:rgba(0,0,0,0.7); padding:5px; max-width:90%; overflow-wrap:break-word; border-radius:5px; display:none;">Esperando datos de la caja...</div>
        <video id="video" autoplay muted playsinline controls></video>
        <img id="mjpeg" />
        <canvas id="overlay"></canvas>

        <script>
          // ----- CORE DEL VIDEO (WebRTC) -----
          const video = document.getElementById('video');
          const err = document.getElementById('err');
          const debugDiv = document.getElementById('debug');
          let videoSocket = null;
          let currentLayer = 'none';
          function showError(msg) { err.style.display = 'block'; err.innerText = msg; }

          async function startWebRTC() {
            try {
              const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
              });

              pc.ontrack = (event) => {
                if (video.srcObject !== event.streams[0]) {
                  video.srcObject = event.streams[0];
                  err.style.display = 'none'; // ocultar error si entra video
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stream_status', protocol: 'webrtc', state: 'connected' }));
                  }
                }
              };

              pc.oniceconnectionstatechange = () => {
                if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                   showError('Desconectado de WebRTC');
                }
              };

              pc.addTransceiver('video', { direction: 'recvonly' });
              pc.addTransceiver('audio', { direction: 'recvonly' });

              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);

              // 1. Enviar el POST Inmediatamente (sin esperar el gathering completo)
              const response = await fetch('${whepUrl}', {
                method: 'POST',
                credentials: 'omit',
                headers: { 
                  'Content-Type': 'application/sdp',
                  'Authorization': 'Bearer ${token}'
                },
                body: pc.localDescription.sdp
              });

              if (!response.ok) throw new Error('WHEP HTTP ' + response.status);
              
              // El header Location tiene la URL para mandar los PATCH
              let resourceUrl = response.headers.get('Location');
              let patchUrl = resourceUrl;
              
              // Manejo seguro por si la URL devuelta es relativa
              if (resourceUrl && resourceUrl.startsWith('/')) {
                 patchUrl = 'https://alarms.guardian.imperium.pe' + resourceUrl;
              } else if (!resourceUrl) {
                 patchUrl = '${whepUrl}';
              }

              const answerSdp = await response.text();
              await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

              // 2. Trickle ICE: Por cada candidato descubierto despues de localDescription,
              // hacemos un PATCH hacia la patchUrl
              pc.onicecandidate = async (event) => {
                 if (event.candidate && event.candidate.candidate) {
                    try {
                       await fetch(patchUrl, {
                           method: 'PATCH',
                           headers: { 
                             'Content-Type': 'application/trickle-ice-sdpfrag',
                             'Authorization': 'Bearer ${token}'
                           },
                           body: "a=" + event.candidate.candidate + "\\r\\n"
                       });
                    } catch (e) {
                       console.warn("Error en ICE patch", e);
                    }
                 }
              };
              
            } catch (e) {
              console.error(e);
              showError('WHEP: ' + e.message + ' (Revisa SSL/CORS)');
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stream_status', protocol: 'webrtc', state: 'disconnected' }));
              }
            }
          }
          startWebRTC();

          // ----- CORE DE LA ANALÍTICA (Activación por Sockets MJPEG) -----
          const mjpegImg = document.getElementById('mjpeg');
          const overlay = document.getElementById('overlay');
          const ctx = overlay.getContext('2d');
          
          function resize() {
             overlay.width = window.innerWidth;
             overlay.height = window.innerHeight;
          }
          window.addEventListener('resize', resize);
          resize();

          window.setAnalyticLayer = function(layerName, deviceId, domain) {
              const streamName = deviceId;
              currentLayer = layerName;
              ctx.clearRect(0, 0, overlay.width, overlay.height);
              
              if (layerName === 'none') {
                  mjpegImg.style.display = 'none';
                  overlay.style.display = 'none';
                  debugDiv.style.display = 'none';
                  video.style.opacity = '1';
                  if (videoSocket) {
                     videoSocket.emit('stop_streaming');
                     videoSocket.disconnect();
                     videoSocket = null;
                  }
                  return;
              }
              
              // Dejamos el video reproduciendose siempre a 100% de opacidad para no mandarlo a negro
              video.style.opacity = '1';
              // Al encender Sockets apagamos el mjpeg hasta recibir el primer frame
              mjpegImg.style.display = 'none';
              overlay.style.display = 'block';
              
              debugDiv.style.display = 'block';
              debugDiv.style.backgroundColor = 'rgba(0,0,0,0.85)';
              debugDiv.style.color = '#00ff00';
              debugDiv.style.top = '50%';
              debugDiv.style.left = '50%';
              debugDiv.style.transform = 'translate(-50%, -50%)';
              debugDiv.style.padding = '15px';
              debugDiv.style.fontSize = '20px';
              debugDiv.style.zIndex = '100';
              debugDiv.innerText = "ENLAZANDO IA...\\nCAPA: " + layerName;
              
              if (videoSocket) {
                  videoSocket.emit('stop_streaming');
                  videoSocket.disconnect();
              }

              // Socket global al servidor
              const socketOpts = {
                  transports: ['polling', 'websocket'],
                  path: '/socket.io',
                  query: { EIO: 3, token: '${token}' }
              };

              videoSocket = io('https://' + domain, socketOpts);
              
              videoSocket.on('connect', () => {
                  debugDiv.innerText = "CONECTADO A SIVI.\\nPIDIENDO: " + streamName;
                  videoSocket.emit('start_streaming', streamName);
                  videoSocket.emit('draw_streaming', layerName);
              });
              
              videoSocket.on('draw_streaming', (payload) => {
                  
                  // Dibujar sobre el canvas
                  ctx.clearRect(0, 0, overlay.width, overlay.height);
                  
                  let items = [];
                  try {
                      // Desanidar formato típico de socket { message: ... }
                      let dataStr = typeof payload === 'object' && payload.message ? payload.message : payload;
                      if (typeof dataStr === 'string') items = JSON.parse(dataStr);
                      else items = dataStr || [];
                      if (!Array.isArray(items)) items = [items];
                  } catch(e) {}
                  
                  debugDiv.innerText = "Boxes detectadas: " + items.length;
                  
                  items.forEach(box => {
                      // El HAR muestra que las coordenadas vienen normalizadas de 0.0 a 1.0 (x, y, w, h)
                      // O a veces en porcentaje 0 a 100 dependiendo de la caja de Mediamtx, pero asumimos 0.0-1.0
                      let nx = parseFloat(box.x || box.xmin || 0);
                      let ny = parseFloat(box.y || box.ymin || 0);
                      let nw = parseFloat(box.w || box.width || 0);
                      let nh = parseFloat(box.h || box.height || 0);
                      
                      // Cálculo de letterbox para 'object-fit: contain'
                      let vw = video.videoWidth || overlay.width;
                      let vh = video.videoHeight || overlay.height;
                      
                      // Si no hay source de video, cae al tamaño de la pantalla
                      let vRatio = vw / vh;
                      let sRatio = overlay.width / overlay.height;
                      let renderW, renderH, offsetX = 0, offsetY = 0;
                      
                      if (sRatio > vRatio) {
                          renderH = overlay.height;
                          renderW = renderH * vRatio;
                          offsetX = (overlay.width - renderW) / 2;
                      } else {
                          renderW = overlay.width;
                          renderH = renderW / vRatio;
                          offsetY = (overlay.height - renderH) / 2;
                      }
                      
                      // Cajas proporcionales al render real
                      let px = offsetX + (nx < 1 ? nx * renderW : nx);
                      let py = offsetY + (ny < 1 ? ny * renderH : ny);
                      let pw = nw < 1 ? nw * renderW : nw;
                      let ph = nh < 1 ? nh * renderH : nh;

                      // Pintar caja
                      ctx.beginPath();
                      ctx.rect(px, py, pw, Math.abs(ph));
                      
                      // Elegir color según el tag o capa activa
                      ctx.lineWidth = 3;
                      if (currentLayer === 'face') ctx.strokeStyle = 'lime';
                      else if (currentLayer === 'lpr') ctx.strokeStyle = '#2196f3';
                      else ctx.strokeStyle = 'red';
                      
                      ctx.stroke();

                      // Pintar etiqueta (opcional)
                      if (box.tag || box.motive_categorie) {
                          ctx.fillStyle = ctx.strokeStyle;
                          ctx.font = '16px sans-serif';
                          ctx.fillText((box.tag || box.motive_categorie) + (box.prob ? ' ' + Math.round(parseFloat(box.prob)*100) + '%' : ''), px, py > 20 ? py - 5 : py + 20);
                      }
                  });

                  if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'draw_streaming', payload: items }));
                  }
              });
              
              let mjpegCount = 0;
              videoSocket.on('stream', (payload) => {
                  mjpegCount++;
                  if (mjpegCount === 1) {
                      mjpegImg.style.display = 'block';
                      video.style.opacity = '0';
                  }

                  if(payload && payload.message) {
                      let base64 = payload.message;
                      if (!base64.startsWith('data:image')) {
                          base64 = "data:image/jpeg;base64," + base64;
                      }
                      mjpegImg.src = base64;
                      
                      if (debugDiv.innerText.includes('conectando') || debugDiv.innerText.includes('MJPEG')) {
                         debugDiv.innerText = "Recibiendo Stream IA (MJPEG) | Frame: " + mjpegCount;
                      }
                  }
              });
          };
        </script>
      </body>
      </html>
    `;
  }

  function getHlsHtml(camera: Camera) {
    const videoUrl = getHlsUrl(camera);
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <script src="https://cdn.jsdelivr.net/npm/hls.js@1.4.12"></script>
        <!-- IMPORTANTE: Cargamos Socket.IO v2 para compatibilidad con EIO=3 del servidor SIVI -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.3.0/socket.io.js"></script>
        <style>
          body { margin: 0; padding: 0; background-color: #0d0d0d; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; position: relative; }
          video { width: 100vw; height: 100vh; object-fit: contain; position: absolute; top: 0; left: 0; z-index: 1; transition: opacity 0.3s; }
          img#mjpeg { width: 100vw; height: 100vh; object-fit: contain; position: absolute; top: 0; left: 0; z-index: 2; pointer-events: none; display: none; }
          canvas#overlay { width: 100vw; height: 100vh; position: absolute; top: 0; left: 0; z-index: 3; pointer-events: none; display: none; }
          .error { color: red; font-family: sans-serif; text-align: center; display: none; padding: 20px; z-index: 10; position: absolute; }
        </style>
      </head>
      <body>
        <div id="err" class="error">Error loading Stream.</div>
        <div id="debug" style="position:absolute; top:60px; left:10px; z-index:9999; color:lime; font-size:10px; background:rgba(0,0,0,0.7); padding:5px; max-width:90%; overflow-wrap:break-word; border-radius:5px; display:none;">Esperando datos de la caja...</div>
        <video id="video" autoplay muted playsinline controls></video>
        <img id="mjpeg" />
        <canvas id="overlay"></canvas>
        <script>
          // ----- CORE DEL VIDEO (HLS) -----
          var video = document.getElementById('video');
          var err = document.getElementById('err');
          var url = '${videoUrl}';
          var debugDiv = document.getElementById('debug');
          var videoSocket = null;
          var currentLayer = 'none';
          
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

          // ----- CORE DE LA ANALÍTICA (Activación por Sockets MJPEG) -----
          const mjpegImg = document.getElementById('mjpeg');
          const overlay = document.getElementById('overlay');
          const ctx = overlay.getContext('2d');
          
          function resize() {
             overlay.width = window.innerWidth;
             overlay.height = window.innerHeight;
          }
          window.addEventListener('resize', resize);
          resize();

          window.setAnalyticLayer = function(layerName, deviceId, domain) {
              var streamName = deviceId;
              currentLayer = layerName;
              ctx.clearRect(0, 0, overlay.width, overlay.height);
              
              if (layerName === 'none') {
                  mjpegImg.style.display = 'none';
                  overlay.style.display = 'none';
                  debugDiv.style.display = 'none';
                  video.style.opacity = '1';
                  if (videoSocket) {
                     videoSocket.emit('stop_streaming');
                     videoSocket.disconnect();
                     videoSocket = null;
                  }
                  return;
              }
              
              video.style.opacity = '0';
              mjpegImg.style.display = 'block';
              overlay.style.display = 'block';
              debugDiv.style.display = 'block';
              debugDiv.innerText = "Conectando IA: " + layerName + "...";
              
              if (videoSocket) {
                  videoSocket.emit('stop_streaming');
                  videoSocket.disconnect();
              }

              // Socket global al servidor
              const socketOpts = {
                  transports: ['polling', 'websocket'],
                  path: '/socket.io',
                  query: { EIO: 3, token: '${token}' }
              };

              videoSocket = io('https://' + domain, socketOpts);
              
              videoSocket.on('connect', () => {
                  debugDiv.innerText = "CONECTADO A SIVI.\\nPIDIENDO: " + streamName;
                  videoSocket.emit('start_streaming', streamName);
                  videoSocket.emit('draw_streaming', layerName);
              });
              
              videoSocket.on('draw_streaming', (payload) => {
                  
                  // Dibujar sobre el canvas
                  ctx.clearRect(0, 0, overlay.width, overlay.height);
                  
                  let items = [];
                  try {
                      let dataStr = typeof payload === 'object' && payload.message ? payload.message : payload;
                      if (typeof dataStr === 'string') items = JSON.parse(dataStr);
                      else items = dataStr || [];
                      if (!Array.isArray(items)) items = [items];
                  } catch(e) {}
                  
                  debugDiv.innerText = "Boxes detectadas: " + items.length;
                  
                  items.forEach(box => {
                      let nx = parseFloat(box.x || box.xmin || 0);
                      let ny = parseFloat(box.y || box.ymin || 0);
                      let nw = parseFloat(box.w || box.width || 0);
                      let nh = parseFloat(box.h || box.height || 0);

                      let vw = video.videoWidth || overlay.width;
                      let vh = video.videoHeight || overlay.height;
                      let vRatio = vw / vh;
                      let sRatio = overlay.width / overlay.height;
                      let renderW, renderH, offsetX = 0, offsetY = 0;
                      
                      if (sRatio > vRatio) {
                          renderH = overlay.height;
                          renderW = renderH * vRatio;
                          offsetX = (overlay.width - renderW) / 2;
                      } else {
                          renderW = overlay.width;
                          renderH = renderW / vRatio;
                          offsetY = (overlay.height - renderH) / 2;
                      }

                      let px = offsetX + (nx < 1 ? nx * renderW : nx);
                      let py = offsetY + (ny < 1 ? ny * renderH : ny);
                      let pw = nw < 1 ? nw * renderW : nw;
                      let ph = nh < 1 ? nh * renderH : nh;

                      ctx.beginPath();
                      ctx.rect(px, py, pw, Math.abs(ph));
                      
                      ctx.lineWidth = 3;
                      if (currentLayer === 'face') ctx.strokeStyle = 'lime';
                      else if (currentLayer === 'lpr') ctx.strokeStyle = '#2196f3';
                      else ctx.strokeStyle = 'red';
                      
                      ctx.stroke();

                      if (box.tag || box.motive_categorie) {
                          ctx.fillStyle = ctx.strokeStyle;
                          ctx.font = '16px sans-serif';
                          ctx.fillText((box.tag || box.motive_categorie) + (box.prob ? ' ' + Math.round(parseFloat(box.prob)*100) + '%' : ''), px, py > 20 ? py - 5 : py + 20);
                      }
                  });

                  if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'draw_streaming', payload: items }));
                  }
              });
              
              let mjpegCount = 0;
              videoSocket.on('stream', (payload) => {
                  mjpegCount++;
                  if (mjpegCount === 1) {
                      mjpegImg.style.display = 'block';
                      video.style.opacity = '0';
                  }

                  if(payload && payload.message) {
                      let base64 = payload.message;
                      if (!base64.startsWith('data:image')) {
                          base64 = "data:image/jpeg;base64," + base64;
                      }
                      mjpegImg.src = base64;
                      
                      if (debugDiv.innerText.includes('conectando') || debugDiv.innerText.includes('MJPEG')) {
                         debugDiv.innerText = "Recibiendo Stream IA (MJPEG) | Frame: " + mjpegCount;
                      }
                  }
              });
          };
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

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.titulo}>Cámaras</Text>
          <Text style={styles.subtitulo}>{cameras.length} dispositivos</Text>
        </View>
        <TouchableOpacity
          style={styles.toggleViewBtn}
          onPress={() => setViewMode(prev => prev === 'list' ? 'grid' : 'list')}
        >
          <Ionicons name={viewMode === 'list' ? 'grid' : 'list'} size={22} color="#2196f3" />
        </TouchableOpacity>
      </View>

      {/* LISTA */}
      <FlatList
        key={viewMode}
        numColumns={viewMode === 'grid' ? 2 : 1}
        data={cameras}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.lista}
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
        renderItem={({ item }) => {
          const online = isOnline(item);
          const statusLabel = getStatusLabel(item);

          if (viewMode === 'grid') {
            return (
              <TouchableOpacity
                style={styles.cardGrid}
                onPress={() => setSelected(item)}
              >
                <ImageBackground
                  source={{ uri: cameraThumbnails[item.id] || getCameraThumbnail(item) }}
                  style={styles.cardGridTop}
                  imageStyle={{ opacity: 0.6 }}
                >
                  <View style={[
                    styles.cardGridDot,
                    { backgroundColor: online ? '#4caf50' : '#ffffff22' }
                  ]} />
                  <Ionicons name="play-circle" size={42} color="#ffffff80" />
                </ImageBackground>
                <View style={styles.cardGridBottom}>
                  <Text style={styles.cardGridName}>{item.name}</Text>
                  <Text style={styles.cardGridStatus}>{statusLabel}</Text>
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelected(item)}
            >
              <View style={styles.cardLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons
                    name="videocam"
                    size={20}
                    color={online ? '#2196f3' : '#ffffff30'}
                  />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardNombre}>{item.name}</Text>
                  <Text style={styles.cardId}>
                    {item.deviceId?.slice(0, 18)}...
                  </Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: online ? '#4caf5018' : '#ffffff08' }
                ]}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: online ? '#4caf50' : '#ffffff22' }
                  ]} />
                  <Text style={[
                    styles.statusText,
                    { color: online ? '#4caf50' : '#ffffff30' }
                  ]}>
                    {online ? 'CONECTADO' : 'DESCONECTADO'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#2196f3" />
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
            source={{ html: getThumbnailCaptureHtml(thumbnailCamera), baseUrl: `https://alarms.guardian.imperium.pe` }}
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

          {/* LAYERS DE ANALÍTICA (Toolbar SIVI) */}
          <View style={styles.analyticsToolbar}>
            <Text style={styles.analyticsTitle}>Analíticas:</Text>
            <View style={styles.layerButtonsRow}>
              {['none', 'motion', 'face', 'lpr'].map(layer => (
                <TouchableOpacity
                  key={layer}
                  style={[
                    styles.layerBtn,
                    activeLayer === layer && styles.layerBtnActive,
                    layer === 'face' && activeLayer === layer && { backgroundColor: '#4caf50' }, // Face color
                    layer === 'lpr' && activeLayer === layer && { backgroundColor: '#2196f3' },  // LPR color
                    layer === 'motion' && activeLayer === layer && { backgroundColor: '#ff5722' },// Motion color
                  ]}
                  onPress={() => setActiveLayer(layer as any)}
                >
                  <Text style={[styles.layerBtnText, activeLayer === layer && styles.layerBtnTextActive]}>
                    {layer.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* VIDEO CONTENEDOR - usamos key para que solo se recargue al cambiar cámara/modo */}
          {selected && (
            <View style={styles.videoContainer}>
              <WebView
                key={`stream-${selected.id}-${streamMode}`}
                ref={webViewRef}
                source={{
                  html: streamMode === 'hls' ? getHlsHtml(selected) : getWebRtcHtml(selected),
                  baseUrl: 'https://alarms.guardian.imperium.pe'
                }}
                style={styles.webview}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
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
              <View style={[styles.modalInfo, { paddingLeft: 0, paddingRight: 0, paddingTop: 0 }]}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>⏱️ Último Evento Detectado</Text>
                  <Text style={styles.infoVal} numberOfLines={1}>
                    {activeLayer !== 'none' ? `Visualizando histórico de ${activeLayer.toUpperCase()}` : (filteredEvents[0] ? `Último registro activo hace un momento` : 'No se han detectado eventualidades recientes')}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>📍 Ubicación o Zona</Text>
                  <Text style={styles.infoVal}>
                    Sector Principal - {selected?.name?.replace(/_/g, ' ')}
                  </Text>
                </View>

                <Text style={styles.eventsTitle}>Registros ({activeLayer.toUpperCase()})</Text>
              </View>
            }
            renderItem={({ item }) => {
              const urlImage = (item.url_evidence || item.face_detected_url || '').replace('/alice-media', `https://${domain}`);
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
                <Text style={styles.emptyEventsText}>No hay eventos de {activeLayer === 'none' ? 'ningún tipo' : activeLayer.toUpperCase()} para esta cámara.</Text>
              </View>
            }
          />

        </View>
      </Modal>

    </View>
  );
}

const getStyles = (isDark: boolean) => {
  const bgMain = isDark ? '#0d0d0d' : '#f3f4f6';
  const bgCard = isDark ? '#161622' : '#ffffff';
  const textPrimary = isDark ? '#ffffff' : '#111827';
  const textSecondary = isDark ? '#ffffff60' : '#6b7280';
  const textMuted = isDark ? '#ffffff40' : '#9ca3af';
  const borderCol = isDark ? '#ffffff10' : '#e5e7eb';
  const modalBg = isDark ? '#0d0d0d' : '#f9fafb';
  const toggleBg = isDark ? '#161622' : '#e5e7eb';
  const toggleText = isDark ? '#ffffff50' : '#6b7280';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: bgMain,
      paddingTop: 60,
    },
    centrado: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 80,
    },
    header: {
      paddingHorizontal: 20,
      marginBottom: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitleWrap: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    toggleViewBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? '#ffffff10' : '#e5e7eb',
      justifyContent: 'center',
      alignItems: 'center',
    },
    titulo: {
      color: textPrimary,
      fontSize: 24,
      fontWeight: '700',
    },
    subtitulo: {
      color: '#3498db',
      fontSize: 14,
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
      backgroundColor: '#2196f3',
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
    },
    cardGridTop: {
      backgroundColor: '#050505',
      aspectRatio: 1.25,
      justifyContent: 'center',
      alignItems: 'center',
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
    cardGridDot: {
      position: 'absolute',
      top: 10,
      left: 10,
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    cardGridBottom: {
      padding: 12,
      backgroundColor: bgCard,
      minHeight: 72,
    },
    cardGridName: {
      color: textPrimary,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    cardGridStatus: {
      color: textSecondary,
      fontSize: 10,
      marginTop: 3,
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
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
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
    analyticsToolbar: {
      paddingHorizontal: 20,
      marginTop: 10,
    },
    analyticsTitle: {
      color: textMuted,
      fontSize: 12,
      marginBottom: 8,
    },
    layerButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    layerBtn: {
      flex: 1,
      backgroundColor: bgCard,
      paddingVertical: 10,
      marginHorizontal: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: borderCol,
      alignItems: 'center',
    },
    layerBtnActive: {
      borderColor: 'transparent',
    },
    layerBtnText: {
      color: textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    layerBtnTextActive: {
      color: '#fff',
    },
  });
};
