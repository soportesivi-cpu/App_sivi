# 🔄 Flujos de Datos, Ciclos de Vida y Diagramas de Secuencia (Mermaid.js)
> **Documento 03:** Planos técnicos de secuencia y flujos de datos interactivos, diseñados para visualizarse en Mermaid.js y Markdown Live Preview.

---

## 🔐 1. Flujo de Inicio de Sesión y Selección de Workspaces
Este diagrama detalla la secuencia de autenticación centralizada a través de la REST API y la persistencia segura del token JWT en el dispositivo móvil:

```mermaid
sequenceDiagram
    autonumber
    actor Operador as Operador de Seguridad
    participant UI as Login (Pantalla de Acceso)
    participant API as Capa de Red (api.ts)
    participant Store as Estado Global (Zustand Store)
    participant Cloud as Servidor SIVI (BFF en la Nube)

    Operador->>UI: Ingresa Email e Imperium Password
    UI->>API: autoLogin("email", "password")
    
    rect rgb(20, 25, 40)
        Note over API: Conecta a la pasarela de login consolidada
        API->>Cloud: POST /mobile/auth/login (Credenciales)
        Cloud-->>API: Retorna JSON { workspace, data: { token, jwt, user, sessions } }
    end

    API->>Store: setSession(domain, token, jwt, user, workspace, sessions)
    Note over Store: Guarda sesión y colecciones de tokens en Expo Secure Store<br/>para mantener la persistencia
    Store-->>UI: Notifica cambio de estado de sesión
    UI->>Operador: Redirecciona automáticamente a /(tabs)/dashboard
```

---

## 🎥 2. Negociación Híbrida de Video (WebRTC / HLS)
Este flujo detalla la negociación Peer-to-Peer a través del protocolo WHEP para transmisiones con latencia menor a un segundo, y la alternancia de reproducción en el móvil:

```mermaid
sequenceDiagram
    autonumber
    participant UI as Interfaz Cámaras (Grid)
    participant WV as WebView Container (HTML5 Player)
    participant Media as Servidor MediaMTX (control.guardian...)

    UI->>WV: Carga reproductor con HTML inyectado y Bearer Token
    
    rect rgb(25, 20, 20)
        Note over WV: Modo WebRTC (WHEP)
        WV->>Media: POST /webrtc/stream_name/whep (SDP Offer + Bearer Token)
        Media-->>WV: Retorna SDP Answer (201 Created + SDP Answer text)
        Note over WV: Conectando video P2P...
    end

    alt Conexión WebRTC Establecida Exitosamente
        Media-->>WV: Flujo de Video Directo H.264 (Latencia < 1s)
    else Falla de Conexión (Notifica vía postMessage)
        WV->>UI: Envía stream_status "disconnected"
        Note over UI: Operador conmuta manualmente a HLS
        UI->>WV: Carga reproductor en Modo HLS
        WV->>Media: GET /stream_name/index.m3u8
        Media-->>WV: Retorna Manifiesto M3U8 y Segmentos TS
        WV-->>UI: Renderiza transmisión de video HLS (Latencia 3-5s)
    end
```

---

## 📡 3. Recepción y Normalización de Eventos en Tiempo Real
El siguiente flujo describe cómo se capturan las detecciones inteligentes de la nube mediante WebSockets y se transforman antes de renderizarse en el teléfono:

```mermaid
graph TD
    %% Definición de Estilos
    classDef cloudStyle fill:#2A1B1B,stroke:#F44336,stroke-width:2px,color:#fff;
    classDef socketStyle fill:#162435,stroke:#2E9BFF,stroke-width:2px,color:#fff;
    classDef bffStyle fill:#162E25,stroke:#4CAF50,stroke-width:2px,color:#fff;
    classDef uiStyle fill:#1C1D2A,stroke:#ffffff20,stroke-width:1px,color:#fff;

    %% Nodos
    A[Cámara IP en Campo]:::cloudStyle -->|Video en Bruto| B(Edge Node: Motor de Analíticas de IA):::cloudStyle
    B -->|Detección de Intruder / Rostro| C(Servidor SIVI Imperium Cloud):::cloudStyle
    
    subgraph Socket Connection (WSS)
        C -->|Emit 'alert' / 'face' / 'lpr'| D(Socket.IO Server en activeDomain / PROD_API_DOMAIN):::socketStyle
        D -->|Websocket Stream EIO=3| E(AlertSocketService en AliceGuardian Mobile):::socketStyle
    end
    
    subgraph Frontend Normalization Layer
        E -->|Payload Crudo snake_case| F[api.ts: normalizeAlertsData / normalizeSearchRows]:::bffStyle
        F -->|Une con activeDomain para construir URLs de Fotos| G[Estandariza a CamelCase e íconos dinámicos]:::bffStyle
    end

    G -->|Actualiza Estado Local: setAlerts| H(Pestaña de Alertas: Renderizado Reactivo):::uiStyle
    G -->|Invalida Caché / Refetch| I(Dashboard / AdminDashboard: Recarga datos unificados):::uiStyle
```

---

## 🚨 4. Resolución de Alertas y Sincronización de Historial
Flujo interactivo de toma de acciones desde la aplicación móvil y su sincronización inmediata con la interfaz:

```mermaid
sequenceDiagram
    autonumber
    actor Operador as Operador de Seguridad
    participant UI as Pantalla Alertas (Lista/Cuadrícula)
    participant Modal as Modal de Detalle (Estilo Web)
    participant State as React Local State (alerts / selectedAlert)
    participant API as Capa de Red (api.ts)

    Operador->>UI: Toca tarjeta de alerta
    UI->>Modal: Abre Modal de Alta Fidelidad
    Operador->>Modal: Presiona botón "Confirmar Alerta" o "Falso Positivo"
    
    rect rgb(20, 25, 20)
        Note over Modal: Invoca handleQuickAction(alertItem, action)
        Modal->>State: Actualización optimista de is_confirmed, is_fp y state
        Modal->>API: classifyWorkspacesEvent(eventId, classification)
    end
    
    State-->>UI: Actualiza fila en pantalla (Muestra badge CONFIRMADA / FALSO POS.)
    UI-->>Operador: Muestra badge de estado actualizado e incrementa conteo en lista
```

