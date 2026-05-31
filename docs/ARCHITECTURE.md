# AliceGuardian App — Arquitectura de Conectividad
> Documento de referencia para cualquier agente de IA o desarrollador que trabaje en este proyecto.
> Última actualización: 2026-05-15

---

## 🗺 Resumen del Sistema

AliceGuardian es una app móvil (React Native + Expo Router) que se conecta a la plataforma **SIVI Imperium**. La conectividad tiene **tres capas independientes** con dominios y protocolos distintos.

```
┌─────────────────────────────────────────────────────────────┐
│                      AliceGuardian App                      │
├──────────────────┬────────────────────┬─────────────────────┤
│   REST API       │   Socket.IO (WS)   │   Video Streaming   │
│   (datos)        │   (tiempo real)    │   HLS / WebRTC      │
├──────────────────┼────────────────────┼─────────────────────┤
│ control.guardian │ control.guardian   │ control.sivi        │
│ .imperium.pe     │ .imperium.pe       │ .imperium.pe        │
│ puerto 443       │ puerto 443         │ puerto 8888 / 8889  │
└──────────────────┴────────────────────┴─────────────────────┘
```

---

## 1. 🌐 REST API

### Dominio
```
https://control.guardian.imperium.pe/api/v1/
```

### Autenticación
Todas las peticiones (excepto login) llevan el header:
```
Authorization: Bearer {jwtToken}
```

### Formato estándar de respuesta (listas)
```json
{
  "count": 10,
  "page": 1,
  "pages": 1,
  "limit": 30,
  "rows": [ ... ]
}
```

### Endpoints confirmados en producción

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/v1/auth/login` | POST | Login. Devuelve `{ jwt, user }` |
| `/api/v1/device/?page=1` | GET | Lista de cámaras/dispositivos |
| `/api/v1/workspace` | GET | Lista de workspaces/managers registrados |
| `/api/v1/alerts/?page=1` | GET | Alertas históricas |
| `/api/v1/face/?page=1` | GET | Detecciones de rostros |
| `/api/v1/object/?page=1` | GET | Detecciones de objetos |
| `/api/v1/motion/?page=1` | GET | Detecciones de movimiento |

> ⚠️ El prefijo `/mobile/` (`/api/v1/mobile/...`) **NO existe** en el servidor actual.
> Usar siempre `/api/v1/` directamente.

### Estructura real del objeto Dispositivo/Cámara
```json
{
  "id": 666,
  "name": "Bellavista_sala_de_reuniones_1",
  "deviceId": "0438dafd-e297-48a6-8066-057cbda92af4",
  "rtsp": "rtsp://control.sivi.imperium.pe:8554/sala_de_reuniones_1-0438dafd-e297-48a6-8066-057cbda92af4",
  "stream_name": null,
  "manager_id": "46a689d7-cbaf-427a-9fdb-f16641bcc4a9",
  "type": "IP_CAM",
  "state": "active"
}
```

> 🔑 **El `stream_name` es null**. Extraer el nombre del stream desde el campo `rtsp`:
> ```
> rtsp://control.sivi.imperium.pe:8554/{STREAM_NAME}
> ```
> Función implementada en `cameras.tsx → getStreamName(camera)`.

### Estructura real del objeto Workspace
```json
{
  "id": 199,
  "name": "movil",
  "manager_id": "5a33d541-c5b7-459a-96d3-43700503ad35",
  "computer": "sivi-S14AT",
  "state": "active",
  "type": "manager"
}
```

> ⚠️ Los workspaces **NO tienen campo `domain`**. Todos comparten el mismo dominio API.
> El `manager_id` es el filtro para diferenciar instalaciones.

### Entorno de desarrollo (Mock)
- Se usa **Mockoon** corriendo en `192.168.1.19:3001`
- Sirve **solo REST API** con datos ficticios
- Archivo: `mocks/sivi-mockoon.json`
- Comando: `npm run mock`

---

## 2. 📡 Socket.IO (Tiempo Real)

### Dominio (SIEMPRE el servidor real, incluso en modo mock)
```
wss://control.guardian.imperium.pe/socket.io/
```

### Configuración crítica
```
EIO=3  ← Engine.IO versión 3 (obligatorio para compatibilidad con SIVI)
pingInterval: 25000 ms  ← confirmado por handshake del servidor
pingTimeout:  20000 ms
```

### Librería
```
socket.io-client@2.3.0  ← NO usar versiones 3.x o 4.x (incompatibles con EIO=3)
```

### Handshake confirmado del servidor
```
GET /socket.io/?EIO=3&transport=polling → HTTP 200
Respuesta: {"sid":"...","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":20000}
```

### Eventos que escucha la app (canales activos)
| Evento | Descripción |
|---|---|
| `face` | Detección de rostro en tiempo real |
| `lpr` | Lectura de placa vehicular |
| `alert` | Alerta general (intrusión, movimiento) |
| `event_motion` | Evento de movimiento detectado |
| `statistics` | Estadísticas de la sesión |

### Evento de autenticación (emit tras connect)
```javascript
socket.emit('authenticate', { token: jwtToken });
```

### Eventos de analítica (para overlay en video)
```javascript
// Solicitar stream de analítica de una cámara
socket.emit('start_streaming', streamName);
socket.emit('draw_streaming', 'object' | 'action');

// Recibir cajas de detección (coordenadas 0.0–1.0 normalizadas)
socket.on('draw_streaming', (payload) => { /* dibujar overlay */ });

// Recibir frames MJPEG de la analítica
socket.on('stream', (payload) => { /* payload.message = base64 JPEG */ });
```

### Archivos relevantes
- `services/websocket.ts` → clase `AlertSocketService` (singleton `wsService`)
- `hooks/useSocket.ts` → hook de React para suscribirse a eventos
- `app/_layout.tsx` → arranca/para el socket según el token JWT

---

## 3. 🎥 Video Streaming

### Servidor de media (SIEMPRE el servidor real, incluso en modo mock)
```
MediaMTX corriendo en: control.sivi.imperium.pe
RTSP fuente:  rtsp://control.sivi.imperium.pe:8554/{stream_name}
HLS output:   https://control.sivi.imperium.pe:8888/{stream_name}/index.m3u8
WHEP output:  https://control.sivi.imperium.pe:8889/{stream_name}/whep
```

> ⚠️ Los puertos 8888 y 8889 en `control.guardian.imperium.pe` devuelven **502**.
> El video solo está disponible en `control.sivi.imperium.pe`.

### Estrategia de reproducción (prioridad)
```
1. WebRTC WHEP   → latencia < 1 segundo  (preferido)
2. HLS           → latencia 3–5 segundos  (fallback automático)
```

### WebRTC WHEP — Flujo de negociación
```
1. POST https://control.sivi.imperium.pe:8889/{stream_name}/whep
   Headers: Content-Type: application/sdp
            Authorization: Bearer {token}
   Body: SDP offer

2. Respuesta: SDP answer (body) + Location header (URL para ICE patches)

3. PATCH {Location URL}
   Headers: Content-Type: application/trickle-ice-sdpfrag
            Authorization: Bearer {token}
   Body: a={iceCandidate}\r\n
   (Repetir por cada candidato ICE descubierto)
```

### HLS — Estructura del manifiesto
```
GET https://control.sivi.imperium.pe:8888/{stream_name}/index.m3u8
→ Playlist M3U8 → segmentos .ts (relativos a la URL base)
```

### Archivos relevantes
- `constants/config.ts` → `PROD_MEDIA_DOMAIN = 'control.sivi.imperium.pe'`
- `app/(tabs)/cameras.tsx` → `getStreamName()`, `getHlsUrl()`, `getWebRtcUrl()`
- `hooks/useWhep.ts` → hook nativo de negociación WebRTC (requiere dev build)
- HTML embebido en WebView dentro de `cameras.tsx` → player WebRTC + HLS + overlay analítica

---

## 4. ⚙️ Constantes del Proyecto

```typescript
// constants/config.ts
PROD_API_DOMAIN   = 'control.guardian.imperium.pe'  // API + Socket.IO
PROD_MEDIA_DOMAIN = 'control.sivi.imperium.pe'       // HLS + WebRTC

// Mock local (solo REST API)
WORKSPACES = [{ id: 'mock', domain: '192.168.1.19:3001' }]
```

---

## 5. 🔑 JWT Token

- Se obtiene del endpoint `POST /api/v1/auth/login` → campo `jwt` en la respuesta
- Se almacena en `expo-secure-store` bajo la clave `jwt_token`
- Accesible globalmente via `useAppStore.getState().jwtToken`
- El token actual de prueba tiene solo claim `iat` (sin roles/userId) — es un token mínimo de desarrollo

---

## 6. 📁 Estructura de Archivos Clave

```
services/
  api.ts          → fetchAPI(), getDevices(), getAlerts(), etc.
  store.ts        → Zustand store (jwtToken, activeDomain, userData)
  websocket.ts    → AlertSocketService singleton (wsService)

hooks/
  useSocket.ts    → Hook React para suscripción a eventos en tiempo real
  useWhep.ts      → Hook nativo para negociación WebRTC/WHEP

constants/
  config.ts       → Dominios de producción, WORKSPACES, buildUrls()

app/
  _layout.tsx     → Boot del socket al detectar token
  (tabs)/
    cameras.tsx   → Stream de video + analítica overlay
    alerts.tsx    → Alertas históricas + tiempo real

mocks/
  sivi-mockoon.json → Mockoon config (solo REST API ficticia)
```
