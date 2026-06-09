# Sivi (Alice Guardian App)

Aplicación móvil de seguridad y analíticas de inteligencia artificial construida con React Native y Expo. Funciona como el cliente nativo oficial de la suite corporativa **SIVI Imperium**, actuando como una terminal interactiva de baja latencia para el monitoreo de dispositivos, videovigilancia y gestión de alertas en tiempo real.

---

## 🚀 Tecnologías Principales

*   **Framework:** [React Native](https://reactnative.dev/) v0.81.5 (compilación nativa híbrida).
*   **Plataforma:** [Expo](https://expo.dev/) SDK ~54
*   **Navegación:** [Expo Router](https://docs.expo.dev/router/introduction/) v6 (File-based Routing).
*   **Estado Global:** [Zustand](https://github.com/pmndrs/zustand) v5 (persistencia de tokens, sesiones de workspaces y estados de la UI).
*   **Server State & Fetching:** [React Query (@tanstack/react-query)](https://tanstack.com/query/v5) v5 (control de caché y sincronización de consultas).
*   **Almacenamiento Seguro:** Expo Secure Store (persistencia del llavero cifrado local para credenciales).
*   **Motor de Video:** WebRTC WHEP (`react-native-webrtc`) para video en vivo de baja latencia (<1s) con fallback automático a HLS (`.m3u8` en WebView) si la red restringe los puertos WebRTC.
*   **Tiempo Real:** [Socket.IO Client](https://socket.io/) v2.3.0 (Engine.IO v3) para la recepción reactiva e inmediata de alarmas de seguridad.

---

## 📂 Estructura del Proyecto

```text
/
├── app/                  # Rutas de la aplicación (Expo Router)
│   ├── (auth)/           # Flujos de autenticación (Login)
│   ├── (tabs)/           # Vistas operativas mediante pestañas principales:
│   │   ├── dashboard.tsx # Enrutador condicional de Dashboards según rol
│   │   ├── cameras.tsx   # Panel de cuadrícula de cámaras en vivo (WebView)
│   │   ├── search.tsx    # Formulario y resultados de búsqueda forense
│   │   ├── alerts.tsx    # Centro de control e histórico de alertas
│   │   ├── events.tsx    # Panel de configuración de reglas y estados de alarmas
│   │   ├── settings.tsx  # Configuración de perfil y cierre de sesión seguro
│   │   └── event-config.tsx # Detalle de alarma, ROI interactivo (SVG) y preview de video
│   ├── _layout.tsx       # Configuración global, providers y ciclo de vida de conexión socket
│   └── index.tsx         # Guardia de tráfico de entrada (auth frente a tabs)
├── components/           # Componentes UI reutilizables y Dashboards condicionales
│   ├── AdminDashboard.tsx      # Panel operativo de control para administradores
│   ├── SuperAdminDashboard.tsx # Vista global de Workspaces y personificación para SuperAdmins
│   └── Loading.tsx             # Indicador de carga global
├── constants/            # Variables estáticas y de entorno
│   └── config.ts         # Dominios oficiales de producción y catálogo de Workspaces
├── services/             # Lógica de negocio, conectividad y utilidades
│   ├── api.ts            # Cliente HTTP unificado (Axios) con endpoints y normalización de URLs
│   ├── store.ts          # Almacén de estado global con Zustand y persistencia
│   ├── websocket.ts      # Manejador Singleton de Socket.IO con namespaces multiplexados
│   └── sound.ts          # Controlador de alarmas sonoras locales (Expo AV)
├── assets/               # Imágenes, logotipos y recursos estáticos
├── app.json              # Configuración del manifiesto de Expo y plugins de compilación
└── package.json          # Dependencias y scripts de desarrollo
```

---

## 🌐 Arquitectura de Conectividad y Red

La aplicación organiza su conectividad en **tres capas independientes** con protocolos de red y puertos de escucha diferenciados:

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

### 1. Capa REST API (HTTPS - Puerto 443)
*   **Servidor Orquestador:** `https://orchestrator.guardian.imperium.pe`
*   Consume endpoints para la autenticación unificada (`/mobile/auth/login`), resúmenes de estado (`/mobile/workspaces/summary`), listado de dispositivos (`/mobile/workspaces/devices`), configuración de alertas (`/mobile/workspaces/alarms/configurations`) e incidentes.
*   Envía las credenciales y tokens de sesión en el payload para el aislamiento dinámico de Workspaces.

### 2. Capa de Tiempo Real (WebSocket WSS - Puerto 443)
*   **Librería Crítica:** `socket.io-client@2.3.0` (Engine.IO v3).
*   **Nota Técnica:** El servidor backend SIVI requiere estrictamente el protocolo `EIO=3` para el handshake inicial. La aplicación **no debe actualizar a socket.io v3.x o v4.x** ya que rompería la compatibilidad.
*   **Eventos:** Escucha de forma multiplexada sobre namespaces `/workspace-data`, `/workspace-lpr`, `/workspace-motion`, `/workspace-GUNS` para notificaciones inmediatas de rostros (`face`), placas (`lpr`), intrusiones (`alert`), movimiento (`event_motion`) y armas (`GUNS`).

### 3. Capa de Video Streaming (HTTPS/WSS - Puertos 8888 & 8889)
*   **Servidor de Media:** MediaMTX en `control.guardian.imperium.pe`
*   **WebRTC WHEP:** Intercambio SDP (Offer/Answer) en puerto `8889` con token de autorización en la cabecera. Ofrece latencia sub-segundo.
*   **HLS Fallback:** Carga de `.m3u8` en puerto `8888` en caso de restricción en canales UDP/ICE por redes móviles.

---

## ⚙️ Requisitos Previos

*   [Node.js](https://nodejs.org/) (versión LTS recomendada)
*   [npm](https://www.npmjs.com/) (viene con Node.js)
*   Entorno de compilación local configurado para Android (Android Studio / SDK) o iOS (macOS / Xcode) debido a dependencias nativas complejas.
*   **Nota Importante:** Debido al uso de librerías nativas personalizadas (`react-native-webrtc`), **la aplicación no es compatible con el cliente estándar Expo Go de las tiendas públicas**. Debes ejecutar compilaciones nativas de desarrollo (Development Builds) o generar un Custom Dev Client.

---

## 🛠️ Instalación y Configuración

1. Clona el repositorio:
   ```bash
   git clone <url-del-repositorio>
   cd AliceGuardianApp
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

---

## 🏃‍♂️ Ejecución en Desarrollo

Puedes arrancar con un servidor de mocks o apuntar al servidor del entorno correspondiente.

### Opción A: Probar con Servidor Local Mock (Mockoon)
Si no tienes acceso a la API del servidor BFF de desarrollo/producción, puedes iniciar un servidor simulado localmente:
```bash
npm run mock
```
Esto levantará el mock en `http://localhost:3001` utilizando la configuración del JSON en `./mocks/sivi-mockoon.json`.

### Opción B: Ejecutar la aplicación en Emulador o Dispositivo Físico (Desarrollo)
Compila y arranca el cliente nativo de desarrollo:
*   **Para Android:**
    ```bash
    npm run android
    ```
*   **Para iOS (macOS requerido):**
    ```bash
    npm run ios
    ```
*   **Servidor de Bundler únicamente (Metro):**
    ```bash
    npm run start
    ```

---

## 📦 Construcción (Builds)

Este proyecto está configurado para usar EAS (Expo Application Services) para la generación de builds. Revisa el archivo `eas.json` para las configuraciones de `preview` (genera APKs de prueba) y `production` (genera App Bundles para distribución en tiendas).

---

## 📜 Licencia
Propiedad de Sivi / Ebenezer Techs. Todos los derechos reservados.
