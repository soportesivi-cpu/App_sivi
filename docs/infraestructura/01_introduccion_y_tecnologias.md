# 🌐 AliceGuardian — Infraestructura y Stack Tecnológico
> **Documento 01:** Introducción, Visión de Infraestructura y Stack de Tecnologías del Cliente Móvil SIVI Imperium.

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
* **React Native + Expo SDK:** Framework de desarrollo nativo multiplataforma. Permite una compilación híbrida fluida para iOS y Android compartiendo el 99% del código fuente.
* **Expo Router (File-based Routing):** Sistema de ruteo basado en archivos en el directorio `/app`. Facilita la navegación organizada mediante pestañas (`(tabs)`) y pantallas modales protegidas.

### 2. Gestión de Estados Globales
* **Zustand:** Gestor de estado global ultraligero y de alto rendimiento. En AliceGuardian, administra:
  * El token JWT activo (`jwtToken`).
  * El dominio activo seleccionado (`activeDomain`).
  * Los datos del usuario autenticado (`userData`).
  * Las sesiones activas de cada workspace (`workspaceSessions`), el workspace seleccionado (`activeWorkspace`) y las personificaciones de superusuario (`impersonatedWorkspace`).
  * Almacenamiento seguro en el llavero del dispositivo móvil a través de `expo-secure-store` para mantener la sesión iniciada de manera persistente.

### 3. Redes y Sockets (Tiempo Real)
* **Socket.IO Client (v2.3.0) — Engine.IO v3:**
  * **Decisión Crítica de Infraestructura:** El servidor en la nube de SIVI requiere estrictamente el protocolo `EIO=3` para el handshake inicial. La aplicación implementa esta versión específica del cliente para garantizar la autenticación inmediata mediante el evento `authenticate` tras establecer el enlace de red.
  * Mantiene una conexión activa persistente con un ciclo de vida atado al token JWT.

### 4. Motor de Video Híbrido (Latencia Sub-Segundo)
* **WebRTC WHEP (WebRTC HTTP Egress Protocol):**
  * **Latencia:** < 1 segundo.
  * **Flujo:** La app realiza un intercambio de descriptores de sesión (SDP Offer -> Answer) mediante peticiones HTTP `POST` y `PATCH` al puerto de media `8889` para establecer un canal directo de video Peer-to-Peer (P2P).
* **HLS (HTTP Live Streaming) — Fallback Automático:**
  * **Latencia:** 3 - 5 segundos.
  * **Flujo:** Si las restricciones de red móvil bloquean los puertos WebRTC (UDP/ICE), el reproductor integrado cae de forma automática a la descarga por segmentos TS mediante listas de reproducción `.m3u8` en el puerto `8888`.
* **WebView Reproductor:** Para una renderización impecable y alto rendimiento en la decodificación de video, la app inyecta un HTML optimizado con aceleración por hardware dentro de un `<WebView>` nativo.

