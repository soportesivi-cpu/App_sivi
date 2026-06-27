# 📱 Arquitectura de Pantallas y Lógica de Negocio

> **Documento 02:** Detalle de pestañas, enrutamiento, lógica interna de frontend, sincronización reactiva en tiempo real y mecanismos de interacción avanzados de la interfaz móvil.

---

## 🗂️ Estructura de Navegación (Tabs y Expo Router)

La aplicación móvil organiza su flujo de trabajo principal en **pestañas operativas** bajo un tab-bar nativo, configuradas en la ruta `/app/(tabs)`. Cada pantalla posee su propio ciclo de vida y sus conexiones dinámicas a la API y el servidor de WebSockets de SIVI:

```
                  ┌──────────────────────────────────────────────┐
                  │              Tab-Bar Principal               │
                  └─┬──────────┬──────────┬──────────┬─────────┬─┘
                    │          │          │          │         │
              ┌─────▼───┐┌─────▼───┐┌─────▼───┐┌─────▼───┐┌────▼────┐
              │Dashboard││ Cámaras ││ Buscar  ││ Alertas ││ Eventos │
              └────┬────┘└─────────┘└─────────┘└─────────┘└────┬────┘
                   │                                           │
             (Navegación)                                 (Navegación)
                   │                                           │
             ┌─────▼─────┐                               ┌─────▼─────┐
             │  Ajustes  │                               │ Config.   │
             │(Settings) │                               │ Evento/ROI│
             └───────────┘                               └───────────┘
```

### 🔒 Restricciones de Acceso por Rol (SuperAdmin vs Admin)
El archivo layout [`app/(tabs)/_layout.tsx`](file:///d:/app_sivi/AliceGuardianApp/app/(tabs)/_layout.tsx) implementa lógica de seguridad y restricción de navegación dinámica basada en roles y estado de personificación:
1. **Acceso Restringido (`restrictAccess`):** Si el usuario logueado posee el rol de `SuperAdmin` y no ha seleccionado ningún espacio de trabajo activo (es decir, `impersonatedWorkspace` es `null`), se activa esta bandera.
2. **Ocultación Completa de Barra:** Al cumplirse `restrictAccess`, la propiedad `tabBarStyle.display` se establece en `'none'`, ocultando la barra de pestañas por completo para impedir navegación errónea.
3. **Desactivación de Rutas:** Las pestañas de **Cámaras**, **Alertas**, **Eventos** y **Buscar** reciben `href: null` dinámicamente, deshabilitando su registro y acceso directo en el enrutador de Expo.

---

## ⚙️ Análisis Detallado de Cada Pestaña y su Lógica

---

### 1. 📊 Panel de Control (Dashboard)
* **Archivo Principal:** [`app/(tabs)/dashboard.tsx`](file:///d:/app_sivi/AliceGuardianApp/app/(tabs)/dashboard.tsx)
* **Componentes de UI:** [`components/AdminDashboard.tsx`](file:///d:/app_sivi/AliceGuardianApp/components/AdminDashboard.tsx) y [`components/SuperAdminDashboard.tsx`](file:///d:/app_sivi/AliceGuardianApp/components/SuperAdminDashboard.tsx)
* **Lógica Interna:**
  * **Enrutador de Pantalla Condicional:** Al cargar, `dashboard.tsx` evalúa el rol de usuario de Zustand:
    - Si es `SuperAdmin` y no hay workspace personificado, renderiza `<SuperAdminDashboard />`, presentando la grilla de selección global de sucursales/workspaces.
    - Si es un `Admin` regular, o un `SuperAdmin` con un workspace personificado (`impersonatedWorkspace !== null`), renderiza el `<AdminDashboard />` operativo.
  * **Síntesis Dinámica de Datos (REST BFF):** `AdminDashboard` llama de forma asíncrona a `getDashboard()`, la cual unifica llamadas concurrentes a nivel de backend:
    - `getWorkspaceState()` (estado físico de red, discos, procesadores).
    - `getWorkspacesEvents()` (historial de alertas recientes).
    - `getWorkspacesAlertsDashboard()` (métricas agregadas de eficacia y tiempos del operador).
  * **Normalizador Intermedio:** Convierte e integra los datos:
    - Traduce el listado de cámaras a estado binario: si el JSON del backend incluye `error: true` para un dispositivo, se define como **Offline**, de lo contrario se considera **Online**.
    - Resuelve el porcentaje de almacenamiento a partir de `disk0.percent` o `ram.percent`.
    - Mapea las alertas asociándoles íconos descriptivos según el tipo de analítica (`walk-outline` para intrusiones, `car-outline` para placas, `person-outline` para rostros).

---

### 2. 🎥 Monitoreo en Vivo (Cámaras)
* **Archivo Principal:** [`app/(tabs)/cameras.tsx`](file:///d:/app_sivi/AliceGuardianApp/app/(tabs)/cameras.tsx)
* **Lógica Interna:**
  * **Carga de Grid Dinámico:** Recupera la lista de dispositivos activos (`getDevices()` o `getWorkspacesDevices()`). Construye el nombre canónico del stream de video concatenando el nombre formateado y el ID único del dispositivo (`{cleanName}-{deviceId}`).
  * **WebView Player Híbrido:** Renderiza el stream a través de un componente `<WebView>` que hospeda reproductores HTML5 inyectados según el modo de video seleccionado:
    1. **WebRTC WHEP (Baja Latencia, <1s):** Inyecta una plantilla de página web que inicializa un `RTCPeerConnection` nativo del navegador WebView, agrega transceptores de audio/video para recibir datos (`recvonly`), y realiza un apretón de manos HTTP `POST` enviando el *SDP Offer* y el token de sesión en la cabecera `Authorization: Bearer <token>` hacia la API WHEP de MediaMTX.
    2. **HLS Fallback (Latencia 3-5s):** Utiliza la librería `hls.js` dentro del HTML inyectado para reproducir fragmentos de video `.m3u8` en navegadores/dispositivos Android sin soporte nativo de HLS. Si `hls.js` no está soportado, cae al reproductor nativo del tag `<video>` con lógica de reintento automático (hasta 3 veces con 2 segundos de cooldown).
  * **Puente de Comunicación WebView-React Native (`postMessage`):**
    - El reproductor interno envía mensajes JSON que son recibidos por el callback `onMessage` de la WebView.
    - Se procesa el estado del stream (`connected` o `disconnected`) para actualizar badges visuales en caliente.
    - Captura eventos del tipo `draw_streaming` (metadatos de bounding boxes detectadas en caliente por la analítica del servidor) y los imprime en la consola del desarrollador con fines de depuración y pruebas de telemetría.

---

### 3. 🔍 Búsqueda Forense (Buscar)
* **Archivo Principal:** [`app/(tabs)/search.tsx`](file:///d:/app_sivi/AliceGuardianApp/app/(tabs)/search.tsx)
* **Lógica Interna:**
  * **Formulario de Filtros de Red:** Expone componentes selectores para acotar la búsqueda por tipo de analítica (Rostros, Placas, Objetos, Movimiento), cámara de origen, y un rango de fechas y horas operativas.
  * **Consumo de API con Mapeo CamelCase:** Llama a la función `searchForense(params)` en [`services/api.ts`](file:///d:/app_sivi/AliceGuardianApp/services/api.ts). Dado que las rutas de imágenes relativas guardadas por el backend pueden carecer de dominio absoluto, la función API intercepta y concatena el dominio activo del workspace en caliente para garantizar que la imagen se renderice adecuadamente en el APK.
  * **Paginación Dinámica:** Implementa un indicador de carga (`loadingResults`) y maneja estados vacíos elegantes si el servidor devuelve cero filas.

---

### 4. 🚨 Centro de Alertas Histórico y en Vivo (Alertas)
* **Archivo Principal:** [`app/(tabs)/alerts.tsx`](file:///d:/app_sivi/AliceGuardianApp/app/(tabs)/alerts.tsx)
* **Lógica Interna y Sincronización en Tiempo Real:**
  * **Suscripción de Sockets Activa:** Al montarse, el componente inicializa la suscripción al socket en vivo a través del singleton de red `wsService`:
    ```typescript
    wsService.connect();
    const unsubscribe = wsService.subscribe((payload) => { ... });
    ```
  * **Filtrado y Mapeo de Smart Events:**
    - Ignora y descarta eventos de telemetría de alta frecuencia (`alarm_stats`, `alarm_throughput`, `data`, `ping`, `pong`, etc.).
    - Solo añade a la lista eventos reales que tengan reglas activas de analítica (`ruleId`, `rule_id` o `vinfo`).
    - Traduce el ID lógico de la cámara que reportó el evento a un nombre legible del dispositivo cruzándolo con el mapa `devicesMapRef.current` precargado.
    - Identifica el tipo de evento y lo clasifica bajo un tema cromático en la UI (Intrusión, Rostro, Vehículo, Métrica, Crítica, Activo).
    - Agrega el nuevo objeto de alerta al inicio del estado de alertas local (`setAlerts`) controlando que el buffer no exceda los 100 elementos (`.slice(0, 100)`).
  * **Popup Emergente en Caliente (Banners):** Si la pestaña de alertas está activa en pantalla (`isFocusedRef.current === true`), la llegada de una nueva alerta activa instantáneamente un banner animado de notificación superior (`triggerRealTimePopup`) y reproduce el audio de alerta de seguridad en el dispositivo móvil si las preferencias de sonido (`soundEnabled`) están activadas.
  * **Modal de Detalle Estilo Web:** Al pulsar una tarjeta, se abre un modal de alta fidelidad:
    - **Panel Dual de Evidencias:** Muestra de forma paralela la captura del recorte (ej: el rostro o placa detectados) y la escena general completa de la cámara IP.
    - **Parseo de Reglas e Intervalos (`vinfo`):** Convierte el string JSON guardado en el campo `vinfo` para extraer datos sobre el horario permitido de la regla y el cooldown del servidor.
  * **Confirmación de Alertas:** El operador puede presionar "Confirmar Alerta" o "Falso Positivo", lo cual invoca a `classifyWorkspacesEvent(eventId, classification)`. La UI ejecuta una actualización optimista en los contadores locales para una experiencia táctil instantánea.

---

### 5. ⚙️ Reglas de Analíticas (Eventos)
* **Archivo Principal:** [`app/(tabs)/events.tsx`](file:///d:/app_sivi/AliceGuardianApp/app/(tabs)/events.tsx)
* **Lógica Interna:**
  * **Consumo de Alarmas de Red:** Realiza llamadas paginadas hacia `/mobile/workspaces/alarms/configurations` para listar todas las reglas activas de IA del workspace.
  * **Asociación de Dispositivos:** Calcula y muestra el número de cámaras asignadas a cada regla analizando la propiedad `Detail_device_alarm.length`.
  * **Toggles Reactivos de Estado:** Mantiene un estado reactivo local (`localActiveStates`) para los interruptores de encendido/desactivación de la regla. Al conmutar el switch, se actualiza el estado de forma optimista y se lanza la petición HTTP POST de actualización.
  * **Resiliencia ante Caídas de Servidor:** Si la petición falla por problemas de cobertura móvil o caída del backend, el componente captura el error y mantiene los switches funcionales de forma simulada para evitar que la interfaz se congele.

---

### 6. ⚙️ Panel de Ajustes (Ajustes)
* **Archivo Principal:** [`app/(tabs)/settings.tsx`](file:///d:/app_sivi/AliceGuardianApp/app/(tabs)/settings.tsx)
* **Lógica Interna:**
  * **Navegación e Identidad:** Muestra el perfil del usuario resolviendo su nombre de Zustand (`first_name`, `lastName` o `username`). Identifica si se encuentra en un flujo de personificación de superusuario (`impersonatedWorkspace`) y dibuja un banner superior indicando la sucursal que está operando en ese instante.
  * **Cierre de Sesión Seguro (`clearSession`):** Al presionar "Cerrar Sesión", borra todos los tokens JWT y configuraciones del dominio de Zustand y remueve físicamente los ítems de `SecureStore` (como `jwt_token`, `workspace_sessions` y contraseñas seguras guardadas), forzando una redirección instantánea a `/(auth)/login`.

---

### 7. 🎛️ Configuración Avanzada de Alarma y Región de Interés (Config. Evento / ROI)
* **Archivo Principal:** [`app/(tabs)/event-config.tsx`](file:///d:/app_sivi/AliceGuardianApp/app/(tabs)/event-config.tsx)
* **Lógica Interna:**
  * **React Query Lifecycle:** Utiliza `@tanstack/react-query` para gestionar la asincronía y el cacheo de los detalles de la alarma mediante `getWorkspaceAlarmConfigurationDetail(id)`. Al confirmar los cambios en la pantalla, se ejecutan peticiones concurrentes para actualizar datos generales de la regla y polígonos, invalidando después las claves de query `['alarms']` y `['alarm-detail']` para asegurar consistencia total.
  * **Editor de ROI con Canvas SVG Interactivo:**
    - Renderiza una imagen estática o WebView de la cámara como fondo y superpone un elemento `<Svg>` que dibuja un polígono dinámico a partir de un arreglo de coordenadas normalizadas `[[x1,y1], [x2,y2], ...]`.
    - **Algoritmo de Interacción Táctil (PanResponder):**
      - Al presionar sobre el Canvas, se capturan las coordenadas `locationX` y `locationY` del evento de toque.
      - **Detección de Vértice más Cercano (Fórmula de Pitágoras):** Compara el toque contra los vértices del polígono escalados al tamaño actual de la pantalla de visualización:
        $$\text{Distancia} = \sqrt{(x_{vertex} \cdot \text{width} - x_{touch})^2 + (y_{vertex} \cdot \text{height} - y_{touch})^2}$$
      - Si la distancia calculada al vértice más cercano es menor a **40 píxeles lógicos**, se almacena su índice en `activePointIndex.current`.
      - Al mover el dedo, el manejador `onPanResponderMove` calcula las nuevas coordenadas relativas dividiendo la posición táctil entre las dimensiones físicas de la vista en pantalla:
        $$x_{new} = \max\left(0, \min\left(1, \frac{x_{touch}}{\text{width}}\right)\right)$$
        $$y_{new} = \max\left(0, \min\left(1, \frac{y_{touch}}{\text{height}}\right)\right)$$
      - Actualiza el estado del polígono en formato JSON y redibuja la figura SVG instantáneamente en pantalla a tiempo real.
