# AliceGuardian App — Arquitectura de Conectividad
> Documento de referencia para cualquier agente de IA o desarrollador que trabaje en este proyecto.
> Última actualización: Junio 2026

---

## 🗺 Resumen del Sistema

AliceGuardian es una app móvil (React Native + Expo Router) que se conecta a la plataforma **SIVI Imperium**. La conectividad tiene **tres capas independientes** con dominios y protocolos distintos.

```
┌─────────────────────────────────────────────────────────────────┐
│                        AliceGuardian App                        │
├────────────────────┬────────────────────┬───────────────────────┤
│    REST API        │   Socket.IO (WS)   │    Video Streaming    │
│    (datos)         │   (tiempo real)    │    HLS / WebRTC       │
├────────────────────┼────────────────────┼───────────────────────┤
│ orchestrator.      │ activeDomain o     │ control.guardian.     │
│ guardian.          │ orchestrator.      │ imperium.pe           │
│ imperium.pe        │ guardian.          │ puerto 8888 / 8889    │
│ puerto 443         │ imperium.pe (443)  │ (o puertos locales)   │
└────────────────────┴────────────────────┴───────────────────────┘
```

---

## 1. 🌐 REST API

### Dominio Principal (Orquestador API Gateway)
```
https://orchestrator.guardian.imperium.pe
```
Adicionalmente, se interactúa con las URLs de subdominios correspondientes a cada Workspace activo de producción configurado (ej. `https://control.guardian.imperium.pe`).

### Autenticación
Las peticiones que consultan datos específicos de workspaces envían las credenciales o tokens de sesión resueltos a través de la pasarela API Gateway en un JSON body estructurado:
```json
{
  "sessions": [
    {
      "workspace": "nombre_workspace",
      "token": "token_workspace"
    }
  ]
}
```

### Endpoints confirmados en producción (API Gateway)

| Endpoint | Método | Descripción |
|---|---|---|
| `/mobile/auth/login` | POST | Login unificado. Devuelve sesión, workspaces asociados y tokens JWT. |
| `/mobile/workspaces/summary` | POST | Estado de discos, cámaras y conteos del workspace. |
| `/mobile/workspaces/devices` | POST | Obtiene la lista de cámaras/dispositivos por workspace. |
| `/mobile/workspaces/events` | POST | Alertas y eventos históricos y en tiempo real (Smart Events). |
| `/mobile/workspaces/alarms/configurations` | POST | Reglas de alarmas configuradas (con paginación exhaustiva). |
| `/mobile/workspaces/events/classify` | POST | Clasificación de una alerta (Confirmar / Falso Positivo / Ignorar). |
| `/mobile/workspaces/events/incidents/description` | POST | Agregar minutas/notas a incidentes de seguridad. |

---

## 2. 📡 Socket.IO (Tiempo Real)

### Dominio
```
wss://{activeDomain}/socket.io/ (o wss://orchestrator.guardian.imperium.pe/socket.io/ por defecto)
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

### Eventos que escucha la app (canales activos)
Multiplexado en los namespaces `/workspace-data`, `/workspace-lpr`, `/workspace-motion`, `/workspace-GUNS` según la configuración:
| Evento / Canal | Namespace | Descripción |
|---|---|---|
| `face` | `/workspace-data` | Detección de rostros |
| `lpr` | `/workspace-lpr` | Lectura de placa vehicular |
| `alert` / `new_alert` | Todos | Alerta general de analítica (intrusión, movimiento) |
| `event_motion` | `/workspace-motion` | Movimiento detectado en zona |
| `GUNS` | `/workspace-GUNS` | Detección de armas u objetos peligrosos |
| `alarm_stats` | `/workspace-data` | Métricas y estado global del Workspace |

### Handshake y Handlers de analítica
```javascript
// Autenticar la sesión WebSocket en la conexión
socket.emit('authenticate', { token: jwtToken });

// PASO CRÍTICO: Iniciar el streaming en el namespace para que el servidor comience a enviar eventos
socket.emit('start_streaming', streamName);
```

---

## 3. 🎥 Video Streaming

### Servidor de media (MediaMTX)
```
MediaMTX corriendo en: control.guardian.imperium.pe (PROD_MEDIA_DOMAIN)
HLS output:   https://control.guardian.imperium.pe:8888/{stream_name}/index.m3u8
WHEP output:  https://control.guardian.imperium.pe/webrtc/{stream_name}/whep
```

### Estrategia de reproducción (alternancia manual)
```
1. WebRTC WHEP   → latencia < 1 segundo (preferido, por defecto)
2. HLS           → latencia 3–5 segundos (alternativo en caso de restricciones de red)
```

### WebRTC WHEP — Flujo de negociación
```
1. POST https://control.guardian.imperium.pe/webrtc/{stream_name}/whep
   Headers: Content-Type: application/sdp
            Authorization: Bearer {workspaceToken}
   Body: SDP offer

2. Respuesta: SDP answer (body)
```

### Archivos relevantes
- `constants/config.ts` → `PROD_MEDIA_DOMAIN = 'control.guardian.imperium.pe'`
- `app/(tabs)/cameras.tsx` → `getStreamName()`, `getHlsUrl()`, `getWebRtcUrl()` y HTML del reproductor inyectado.

---

## 4. ⚙️ Constantes del Proyecto

```typescript
// constants/config.ts
PROD_API_DOMAIN   = 'orchestrator.guardian.imperium.pe'  // API principal / Gateway
PROD_MEDIA_DOMAIN = 'control.guardian.imperium.pe'       // HLS + WebRTC WHEP

// Workspaces registrados
WORKSPACES = [
  { id: 'control', name: 'Imperium Control', domain: 'control.guardian.imperium.pe', ... },
  { id: 'cmarket', name: 'Imperium Cmarket', domain: 'cmarket.guardian.imperium.pe', ... },
  ...
]
```

---

## 5. 🔑 JWT Token

- Se obtiene del endpoint unificado `POST /mobile/auth/login`
- Se almacena en `expo-secure-store` bajo la clave `jwt_token`
- Las credenciales de workspaces adicionales y sesiones se persisten también en `workspace_sessions` y `active_workspace` para aislamiento de datos.

---

## 6. 📁 Estructura de Archivos Clave

```
services/
  api.ts          → getDashboard(), getWorkspacesDevices(), getWorkspacesEvents(), getAlarms()
  store.ts        → Zustand store (jwtToken, activeDomain, userData, activeWorkspace, workspaceSessions)
  websocket.ts    → AlertSocketService singleton (wsService) para namespaces multiplexados

constants/
  config.ts       → Dominios de producción, WORKSPACES

app/
  _layout.tsx     → Boot del ciclo de vida del socket al hidratar token y dominio
  index.tsx       → Guardia de tráfico de entrada (auth frente a tabs)
  (tabs)/
    dashboard.tsx → Enrutador condicional de dashboards
    cameras.tsx   → Grid de cámaras y WebView player
    alerts.tsx    → Gestión forense de alertas con scroll infinito y acciones de confirmación
    events.tsx    → Configuración y reglas de eventos
    settings.tsx  → Ajustes de perfil, sucursal activa y cierre de sesión seguro
    event-config.tsx → Configuración detallada de alarma y región de interés (ROI) interactiva con SVG
```


