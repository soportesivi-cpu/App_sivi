# 🌐 AliceGuardian — Infraestructura y Stack Tecnológico

> **Documento 01:** Introducción, Visión de Infraestructura, Stack de Tecnologías y Mecanismos de Red del Cliente Móvil SIVI Imperium.

---

## 🗺️ Visión General del Sistema

**AliceGuardian** es una aplicación móvil de seguridad y analíticas de inteligencia artificial de nivel industrial. Actúa como el cliente nativo oficial de la suite corporativa **SIVI Imperium**. 

La aplicación no procesa video ni ejecuta modelos de IA de forma local. En su lugar, actúa como una **terminal interactiva de baja latencia** que centraliza y controla una infraestructura distribuida en la nube y servidores locales de borde (edge nodes).

La conectividad móvil está cimentada sobre **tres capas independientes**, cada una con sus propios protocolos de red, puertos de escucha y servidores especializados:

```
                      ┌───────────────────────────────────────┐
                      │           AliceGuardian App           │
                      └───┬───────────────┬───────────────┬───┘
                          │               │               │
      ┌───────────────────┴───┐   ┌───────┴──────────┐   ┌┴──────────────────────┐
      │       REST API        │   │  Socket.IO (WS)  │   │    Video Streaming    │
      │  (Datos y Consultas)  │   │  (Tiempo Real)   │   │  (WebRTC WHEP / HLS)  │
      └───────────────────┬───┘   └───────┬──────────┘   └───────┬───────────────┘
                          │               │                      │
                  Port: 443 (HTTPS)  Port: 443 (WSS)     Ports: 8888 & 8889 (HTTPS)
                          │               │                      │
              ┌───────────▼───────────────▼──────────┐   ┌───────▼───────────────┐
              │ orchestrator.guardian.imperium.pe   │   │ control.guardian...   │
              │  (API REST + Socket.IO Server BFF)   │   │  (MediaMTX Streaming) │
              └──────────────────────────────────────┘   └───────────────────────┘
```

---

## ⚡ Estructura Multidominio en Producción

La comunicación nativa está dividida geográficamente y por infraestructura técnica para optimizar la velocidad y seguridad de transmisión de datos sensibles:

### 1. Dominio de Control (BFF & WebSockets)
* **URL:** `https://orchestrator.guardian.imperium.pe` (y los subdominios de cada Workspace activo, como `control.guardian.imperium.pe`).
* **Protocolos:** HTTPS (REST API) y WSS (Socket.IO).
* **Propósito:** Registro y autenticación unificada de usuarios, consulta a la pasarela API Gateway, inventario de cámaras, consulta forense de alertas históricas, y recepción en milisegundos de eventos en vivo.

### 2. Dominio de Contenido Multimedia (Streaming Media Server)
* **URL:** `https://control.guardian.imperium.pe`
* **Protocolos:** HTTPS (SDP Offer/Answer para WebRTC, y M3U8 para HLS).
* **Propósito:** Retransmisión de video comprimido H.264 de cámaras IP directo a dispositivos móviles. Utiliza el servidor open-source de alto rendimiento **MediaMTX**.

---

## 🛠️ Stack Tecnológico Integrado

La aplicación móvil está construida con tecnologías de vanguardia para asegurar escalabilidad, fluidez táctil y facilidad de mantenimiento:

### 1. Core Framework & Ruteo
* **React Native + Expo SDK:** Framework de desarrollo nativo de alto rendimiento.
* **Expo Router (File-based Routing):** Sistema de ruteo basado en archivos en el directorio `/app`. Facilita la navegación organizada mediante pestañas (`(tabs)`) y pantallas modales protegidas.

### 2. Gestión de Estados Globales y Llavero Seguro
* **Zustand:** Gestor de estado global en memoria ultraligero. Administra:
  * El token JWT activo (`jwtToken`).
  * El dominio activo seleccionado (`activeDomain`).
  * Los datos del usuario autenticado (`userData`).
  * Las sesiones de cada workspace (`workspaceSessions`), el workspace seleccionado (`activeWorkspace`) y las personificaciones de superusuario (`impersonatedWorkspace`).
* **Expo Secure Store (Llavero Físico):** Los datos sensibles de Zustand se persisten y leen encriptados en el disco del teléfono para evitar la expiración o pérdida de sesión ante reinicios:
  - `active_domain` ➔ URL/IP del servidor activo.
  - `jwt_token` ➔ Token de autenticación global del operador.
  - `workspace_token` ➔ Token de acceso al espacio de trabajo actual.
  - `workspace_sessions` ➔ JSON serializado conteniendo las claves y sesiones activas del orquestador para todos los workspaces del operador.
  - `user_data` y `active_workspace` ➔ Datos serializados del perfil del usuario y de la sucursal seleccionada.
  - `theme_preference` y `sound_preference` ➔ Ajustes del tema visual (`dark`/`light`) y sonido de alarmas (`enabled`/`disabled`).

### 3. Redes y Sockets (Tiempo Real)
* **Socket.IO Client (v2.3.0) — Engine.IO v3:**
  * El servidor en la nube de SIVI requiere estrictamente el protocolo `EIO=3` para el handshake inicial. La aplicación implementa esta versión específica del cliente para garantizar la autenticación inmediata mediante el evento `authenticate` tras establecer el enlace de red.
  * Mantiene una conexión activa persistente con un ciclo de vida atado al token JWT.

### 4. Motor de Video Híbrido (Latencia Sub-Segundo)
* **WebRTC WHEP (WebRTC HTTP Egress Protocol):**
  * **Latencia:** < 1 segundo (Peer-to-Peer directo desde MediaMTX).
  * **Flujo:** La app realiza un intercambio de descriptores de sesión (SDP Offer -> Answer) mediante peticiones HTTP `POST` y `PATCH` al puerto de media para establecer la transmisión de video.
* **HLS (HTTP Live Streaming) — Fallback Automático:**
  * **Latencia:** 3 - 5 segundos.
  * **Flujo:** Si las restricciones de red móvil bloquean los puertos WebRTC (UDP/ICE), el reproductor integrado cae de forma automática a la descarga por segmentos TS mediante listas de reproducción `.m3u8`.
* **WebView Reproductor:** Para una renderización impecable y alto rendimiento en la decodificación de video, la app inyecta un HTML optimizado con aceleración por hardware dentro de un `<WebView>` nativo.

---

## 🔄 Mecanismo de Red Avanzado: Reescritura de Direcciones de Media Locales

Una particularidad crítica de la capa de red en [`services/api.ts`](file:///d:/app_sivi/AliceGuardianApp/services/api.ts) es la función [`getMediaUrl()`](file:///d:/app_sivi/AliceGuardianApp/services/api.ts#L20-L100). 

### El Problema
El backend local de SIVI almacena las imágenes de evidencia y capturas utilizando direcciones de host loopback o locales (`http://127.0.0.1:19090/...`, `http://localhost/...`, `http://local.imperium.pe/...`). Al ser consultadas desde fuera de la red local (ej. a través de datos móviles 4G/5G en el APK), estas direcciones resultan inalcanzables, provocando que las imágenes no carguen en las tarjetas ni en el modal de detalle de alertas.

### La Solución (Reescritura Dinámica)
Cuando `getMediaUrl` detecta un prefijo local en la URL de la evidencia:
1. Extrae la ruta relativa de la imagen utilizando una expresión regular:
   ```typescript
   /https?:\/\/(127\.0\.0\.1|localhost|local\.imperium\.pe)(:\d+)?(.+)/
   ```
2. Consulta el estado del workspace activo (`activeWorkspace` o `impersonatedWorkspace`) en la Zustand store de la aplicación.
3. Busca la coincidencia del identificador del workspace dentro del listado de configuración estática [`WORKSPACES`](file:///d:/app_sivi/AliceGuardianApp/constants/config.ts).
4. Reemplaza el origen local por el dominio público de producción del workspace (ej: `control.guardian.imperium.pe`), construyendo una URL absoluta segura `https://<workspace_domain>/alice-media/...` que es ruteada con éxito por la red pública.
