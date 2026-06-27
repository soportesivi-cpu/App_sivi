# AliceGuardian App — Arquitectura de Conectividad y Lógica Operativa

> Documento de referencia para cualquier agente de IA o desarrollador senior que trabaje en este proyecto.
> Última actualización: Junio 2026

---

## 🗺️ Resumen del Sistema

AliceGuardian es una aplicación móvil nativa (React Native + Expo Router) que se conecta a la suite corporativa **SIVI Imperium**. La conectividad móvil está dividida en **tres capas independientes** con dominios, puertos y protocolos especializados.

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

### Autenticación y Envío de Parámetros
Las peticiones que consultan datos específicos de workspaces envían las credenciales o tokens de sesión resueltos a través de la pasarela API Gateway en un JSON body estructurado:
```json
{
  "sessions": [
    {
      "workspace": "nombre_workspace",
      "token": "token_especifico_del_workspace"
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

### Reescritura Dinámica de URLs de Evidencia (Local a Público)
La capa API en [`services/api.ts`](file:///d:/app_sivi/AliceGuardianApp/services/api.ts) intercepta las URLs de imágenes y recursos devueltas por el servidor que apunten a direcciones locales (ej: `127.0.0.1`, `localhost`, `local.imperium.pe`) y las reescribe dinámicamente utilizando el dominio público del workspace activo (ej: `control.guardian.imperium.pe`) obtenido de Zustand y mapeado contra los valores configurados en [`constants/config.ts`](file:///d:/app_sivi/AliceGuardianApp/constants/config.ts).

---

## 2. 📡 Socket.IO (Tiempo Real)

### Dominio y Protocolo Crítico
```
wss://{activeDomain}/socket.io/ (o wss://orchestrator.guardian.imperium.pe/socket.io/ por defecto)
```
- **Engine.IO Versión 3 (`EIO=3`):** El backend de SIVI requiere estrictamente el handshake de Engine.IO v3. Se implementa la dependencia `socket.io-client@2.3.0` para asegurar compatibilidad total.

### Namespaces Multiplexados en Producción
Para recibir eventos sin saturar un solo hilo de datos, la aplicación abre canales de WebSocket multiplexados simultáneamente con el token de sesión inyectado en el query:

| Namespace | Stream Name / Evento | Datos del Canal |
|---|---|---|
| `/workspace-data` | `data` | Rostros (`face`), alertas generales, telemetría (`alarm_stats`), y eventos. |
| `/workspace-lpr` | `lpr` | Patentes vehiculares (`lpr`), alertas y detecciones. |
| `/workspace-GUNS` | `GUNS` | Detección de amenazas de seguridad, armas y objetos peligrosos (`GUNS`). |

### Handshake y Re-conexión Dinámica
```javascript
// Paso 1: Autenticar la sesión en la conexión de cada socket namespace
socket.emit('authenticate', { token: wsToken });

// Paso 2: Emitir el evento de inicio (PASO CRÍTICO - Sin esto el servidor no envía nada)
socket.emit('start_streaming', streamName);
```

#### Sincronización en Caliente con Zustand Store
[`services/websocket.ts`](file:///d:/app_sivi/AliceGuardianApp/services/websocket.ts) está suscrito reactivamente al estado global de Zustand:
```typescript
useAppStore.subscribe((state) => { ... });
```
Si se detecta un cambio en las sesiones de los workspaces (`workspaceSessions`), en el workspace activo (`activeWorkspace`) o en el workspace personificado (`impersonatedWorkspace`), el servicio realiza una desconexión limpia (`wsService.disconnect()`) de todos los sockets en curso y reestablece automáticamente las conexiones multiplexadas utilizando los nuevos tokens y dominios.

---

## 3. 🎥 Video Streaming

### Servidor de Media (MediaMTX)
Las cámaras IP transmiten su flujo en tiempo real mediante el servidor open-source **MediaMTX**:
```
MediaMTX en: control.guardian.imperium.pe (PROD_MEDIA_DOMAIN)
HLS output:   https://control.guardian.imperium.pe:8888/{stream_name}/index.m3u8
WHEP output:  https://control.guardian.imperium.pe/webrtc/{stream_name}/whep
```

### Estrategia de Reproducción Híbrida
Para garantizar reproducción estable, la app monta un elemento `<WebView>` nativo inyectando un reproductor HTML5 con dos configuraciones:
1. **WebRTC WHEP (Baja Latencia, <1s):** Envía una SDP Offer al puerto `8889` mediante HTTP `POST` con la cabecera `Authorization: Bearer <workspace_token>` y establece una conexión directa Peer-to-Peer.
2. **HLS Fallback (Latencia 3-5s):** Utiliza `hls.js` para renderizar el manifiesto `.m3u8` en el puerto `8888` si los cortafuegos o la señal móvil impiden la negociación WebRTC.

---

## 4. 🔑 Persistencia Segura y Estados Globales

La aplicación móvil almacena de forma persistente sus credenciales encriptadas en el llavero físico del dispositivo a través de `expo-secure-store`:

- `jwt_token`: Token global de autenticación del usuario.
- `workspace_token`: Token del workspace activo seleccionado.
- `workspace_sessions`: JSON serializado con las sesiones activas de todos los workspaces.
- `active_domain`: El dominio de la pasarela activa.
- `active_workspace`: Datos del workspace activo actual.
- `theme_preference` y `sound_preference`: Preferencias de interfaz (`dark`/`light`) y habilitación de audio de alertas (`enabled`/`disabled`).

---

## 📁 5. Estructura de Archivos Clave

```
services/
  api.ts          → getDashboard(), getWorkspacesDevices(), getWorkspacesEvents(), getAlarms(), parseUTCDate(), getMediaUrl()
  store.ts        → Zustand store (jwtToken, activeDomain, userData, activeWorkspace, workspaceSessions, refreshWorkspacesSessions())
  websocket.ts    → AlertSocketService singleton (wsService) para namespaces multiplexados y re-conexión automática reactiva
  sound.ts        → Controlador de sonido para alertas en segundo plano/vivo

constants/
  config.ts       → Dominios de producción, WORKSPACES estáticos
  theme.ts        → Paleta cromática corporativa SIVI, fuentes y estilos globales

components/
  AdminDashboard.tsx      → Métricas de operador, estado de hardware y últimas alertas
  SuperAdminDashboard.tsx → Pantalla de selección y personificación de múltiples sucursales
  Loading.tsx             → Animaciones premium de transición

app/
  _layout.tsx     → Boot del ciclo de vida del socket al hidratar token y dominio
  index.tsx       → Guardia de tráfico de entrada (autenticado frente a no-autenticado)
  (tabs)/
    _layout.tsx   → Configura pestañas operativas y bloquea UI a SuperAdmin sin personificar (href: null)
    dashboard.tsx → Enrutador de pantallas de dashboard (SuperAdmin vs Admin)
    cameras.tsx   → Grid de cámaras, reproductor híbrido WebView y debugger postMessage
    alerts.tsx    → Gestión forense de alertas con scroll infinito, WS subscription y popup en caliente
    events.tsx    → Configuración de reglas, switches de activación y fallbacks de error de red
    settings.tsx  → Perfil de usuario, switch de tema/sonido y borrado seguro de persistencia
    event-config.tsx → Editor táctil interactivo de ROI mediante polígonos SVG y gestos nativos de PanResponder
```
