# 📱 Arquitectura de Pantallas y Lógica de Negocio
> **Documento 02:** Detalle de pestañas, enrutamiento, lógica interna de frontend y mecanismos de resiliencia de la interfaz móvil.

---

## 🗂️ Estructura de Navegación (Tabs y Expo Router)

La aplicación móvil organiza su flujo de trabajo principal en **pestañas operativas** bajo el tab-bar nativo, configuradas en la ruta `/app/(tabs)`. Cada pantalla posee su propio ciclo de vida y sus conexiones dinámicas a la API de producción de SIVI:

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

---

## ⚙️ Análisis Detallado de Cada Pestaña y su Lógica

---

### 1. 📊 Panel de Control (Dashboard)
* **Archivo Principal:** `app/(tabs)/dashboard.tsx` (Componentes de UI: `components/AdminDashboard.tsx` y `components/SuperAdminDashboard.tsx`)
* **Lógica Interna:**
  * **Síntesis Dinámica de Datos (REST BFF):** Al cargar, llama de forma asíncrona a la función `getDashboard()`, la cual realiza peticiones concurrentes en el backend para unificar `getWorkspaceState()` (estado de hardware/cámaras/discos), `getWorkspacesEvents()` (lista de últimas alertas) y `getWorkspacesAlertsDashboard()` (métricas del operador).
  * **Normalizador Intermedio:** Une y traduce los datos de producción:
    * Convierte el listado de cámaras en un estado en vivo binario: si la cámara tiene la propiedad `error: true` en el JSON remoto, se clasifica como **Offline**, de lo contrario se clasifica como **Online**.
    * Extrae el porcentaje de almacenamiento en disco real (`disk0.percent` o `ram.percent`).
    * Mapea la lista de alertas recientes traduciendo tipos de analíticas en strings legibles e íconos gráficos (`walk-outline` para intrusiones, `car-outline` para placas, `person-outline` para rostros).
  * **Interacción:** El botón "Ver todas" redirige instantáneamente al usuario a la pestaña de Alertas con una transición animada.

---

### 2. 🎥 Monitoreo en Vivo (Cámaras)
* **Archivo Principal:** `app/(tabs)/cameras.tsx`
* **Lógica Interna:**
  * **Carga de Grid Dinámico:** Recupera la lista de cámaras activas (`getDevices()` o `getWorkspacesDevices()`). Construye de manera determinista el nombre del stream HLS/WebRTC (usando la función `getStreamName`) concatenando el nombre normalizado del dispositivo y su identificador único (ej: `{cleanName}-{deviceId}`).
  * **Reproductor WebRTC / HLS Híbrido:** Renderiza cada celda de video a través de un componente `<WebView>` que hospeda un reproductor interno HTML5. Este inyecta scripts optimizados para:
    1. Intentar conectarse a la API de WHEP (baja latencia WebRTC Peer Connection).
    2. Escuchar candidatos ICE del MediaMTX.
    3. Si falla la conexión WebRTC por cortafuegos o mala señal, realiza un fallback transparente en menos de 3 segundos cargando la lista HLS `.m3u8` en el puerto `8888`.
  * **Overlay de Analíticas en Consola:** El reproductor en el WebView envía eventos del tipo `draw_streaming` a través de `postMessage`, los cuales son capturados en el handler `onMessage` de React Native para registrar los datos en los logs de la consola (`console.log`) con fines de depuración, sin pintar overlays 2D flotantes directamente sobre el video en esta versión.

---

### 3. 🔍 Búsqueda Forense (Buscar)
* **Archivo Principal:** `app/(tabs)/search.tsx`
* **Lógica Interna:**
  * **Formulario de Filtros Avanzados:** Expone selectores táctiles para acotar búsquedas por tipo de analítica (Rostros, Placas, Objetos, Movimiento), selector de cámara, rango de fechas en calendario y rangos de horarios en formato de 24 horas.
  * **Petición con Normalización Defensiva:** Llama a `searchForense(params)`. Dado que la base de datos de producción puede retornar URLs relativas para capturas e imágenes, la capa del servicio API las intercepta en segundo plano y les concatena el dominio activo de producción en tiempo real.
  * **Estados Fluidos de Carga:** Controla estados visuales mediante un spinner de actividad centralizado (`loadingResults`) y muestra un banner elegante de *"No se encontraron resultados"* si la consulta no regresa filas.

---

### 4. 🚨 Centro de Alertas Histórico y en Vivo (Alertas)
* **Archivo Principal:** `app/(tabs)/alerts.tsx`
* **Lógica Interna:**
  * **Doble Modo de Visualización:** Permite alternar mediante un switch en la barra superior entre vista en **Lista** (tarjetas informativas detalladas) y vista en **Cuadrícula** (grilla compacta de dos columnas).
  * **Modal de Detalle Premium ("Cuadritos" Estilo Web):** Al pulsar una alerta en cuadrícula, abre un modal completo que extrae la información del objeto remoto:
    * **Panel Dual de Imágenes:** Jala la captura del rostro recortado (`face_detected_url` con dominio absoluto) y la evidencia completa (`url_evidence`).
    * **Grilla de Datos:** Recrea las tarjetas de visualización de la web (Dispositivo, Motivo, Etiquetas literales en arreglo, Probabilidad de precisión en porcentaje).
    * **Parseo de `vinfo`:** Analiza la cadena de texto JSON del campo `vinfo` para extraer y renderizar en pantalla las horas de programación del calendario y la frecuencia de la regla del servidor de producción.
  * **Sincronización Reactiva de Contadores:** Los contadores del turno superior ("Confirmadas" y "Falsas") se actualizan dinámicamente. Al resolver una alerta pulsando "Confirmar" o "Falso Positivo" desde el modal o la lista, se incrementan instantáneamente (+1 interactivo).

---

### 5. ⚙️ Reglas de Analíticas (Eventos)
* **Archivo Principal:** `app/(tabs)/events.tsx`
* **Lógica Interna:**
  * **Mapeo Automatizado de Alarmas:** Llama a `getAlarms()`, el cual consume el endpoint `/mobile/workspaces/alarms/configurations` a través de la pasarela API Gateway, iterando automáticamente todas las páginas disponibles hasta acumular todas las reglas configuradas.
  * **Clasificador:** Clasifica las alarmas complejas del servidor en cuatro categorías reconocibles en el móvil (`FACE` para rostros, `LPR` para patentes, `OBJECT` para objetos, `ACTION` para intrusiones/movimiento).
  * **Cámara-Rules Sync:** Cuenta cuántas cámaras físicas tienen asignada esa regla específica analizando la propiedad remota `Detail_device_alarm.length`.
  * **Manejo de Estados Persistentes:** Almacena localmente las activaciones del switch a través de un gestor de estados de React (`localActiveStates`) para asegurar una respuesta visual inmediata.
  * **Resiliencia Automática (Fallback de Red):** Si el servidor de producción no está disponible, el sistema detecta la falla de red y carga dinámicamente un conjunto de datos ficticios locales (mocks de alta calidad) para mantener la app 100% interactiva sin cerrarse o lanzar excepciones visuales críticas al usuario.

---

### 6. ⚙️ Panel de Ajustes (Ajustes)
* **Archivo Principal:** `app/(tabs)/settings.tsx`
* **Lógica Interna:**
  * **Acceso desde UI:** Se accede directamente desde la rueda dentada (ícono de Ajustes) en el panel superior de la pantalla del Dashboard de Administrador (`AdminDashboard.tsx`). En el caso de SuperAdmin, interactúa mediante un modal interno y permite también la navegación si fuera requerido.
  * **Resolución de Perfil y Sesión:**
    * Resuelve el nombre completo del usuario a partir del estado global de Zustand (`userData`), evaluando los atributos `first_name`, `lastName`, `Username` o `username`.
    * Determina el rol de manera condicional (ej. `SUPERADMIN` o `ADMIN`).
    * Identifica el Workspace activo o suplantado (`impersonatedWorkspace || activeWorkspace`) para mostrar su respectivo nombre en la cabecera del perfil.
  * **Cierre de Sesión Seguro:** Al presionar "Cerrar Sesión Segura", ejecuta la acción `clearSession()` de la Zustand Store. Esta acción limpia de forma segura las credenciales de la memoria de la aplicación y remueve los datos persistentes de `Expo Secure Store`, provocando que el enrutador central de la app (`app/index.tsx`) detecte que no hay token JWT válido y redirija automáticamente al usuario al flujo de `/login`.

---

### 7. 🎛️ Configuración Avanzada de Alarma y Región de Interés (Config. Evento / ROI)
* **Archivo Principal:** `app/(tabs)/event-config.tsx`
* **Lógica Interna:**
  * **Acceso desde UI:** Se navega a esta pantalla cuando el usuario pulsa sobre cualquiera de las tarjetas de alarmas registradas en la pestaña de Eventos (`app/(tabs)/events.tsx`). La ruta requiere el parámetro dinámico `id` de la alarma seleccionada.
  * **Gestión de Estados Reactivos y Caché (React Query):**
    * Recupera la información detallada de la regla de forma asíncrona mediante `@tanstack/react-query` llamando a la función `getWorkspaceAlarmConfigurationDetail(String(id))`.
    * Al guardar las modificaciones, ejecuta en paralelo las peticiones `updateWorkspaceAlarmConfiguration()` (para actualizar el estado de la alarma y los parámetros de acción en base de datos) y `updateWorkspaceAlarmPolygons()` (si la alarma tiene polígonos asociados a su región de interés).
    * Al completarse con éxito, invalida las queries en caché (`alarms` y `alarm-detail`) para asegurar que la UI muestre los datos frescos y redirige de vuelta al listado de eventos (`app/(tabs)/events`).
  * **Vinculación Dinámica de Cámaras y Streams:** Resuelve la correspondencia de la cámara asociada a la regla cruzando la información con la lista completa de dispositivos del workspace (obtenidos con `getDevices()`). Esto permite mapear IDs lógicos y UUIDs físicos para construir el stream correcto del reproductor en vivo (`{deviceId}/1`).
  * **Parseador de Reglas Específicas:** Mapea e itera las diferentes reglas complejas de analítica asociadas a la alarma (`Detail_rule_obj_alarm`, `Detail_rule_face__alarm`, `Detail_rule_lpr__alarm`, `Detail_rule_action_alarm`), extrayendo el tipo de analítica, el estado activo/inactivo, las etiquetas vinculadas (ej. `person`), la precisión mínima/probabilidad y los contadores.
  * **Canvas Interactivo SVG y Gestos (Region of Interest):**
    * Dibuja un polígono coloreado en pantalla con vértices redondos arrastrables para definir la zona en la que la analítica del servidor de producción debe alertar.
    * Utiliza el API nativo `PanResponder` de React Native para capturar gestos de arrastre táctiles y mapear las posiciones de los puntos en tiempo real, normalizando las coordenadas en un plano de 0.0 a 1.0.
    * Muestra un listado dinámico de las coordenadas relativas (%) de cada punto del polígono.
  * **Reproductor WebRTC WHEP / Fallback Integrado:**
    * Integra un switch y el botón "Iniciar Video en Vivo" que monta un componente `<WebView>` de React Native.
    * Dicho WebView carga de forma segura la URL WebRTC WHEP generada a partir de `getWebRtcUrl(resolvedCamera)` inyectando el token JWT de la sesión correspondiente en la URL para autenticar el stream en MediaMTX.
    * Si no se inicia la reproducción, muestra una imagen de marcador de posición de cámara de alta fidelidad desde un recurso estático de red.


