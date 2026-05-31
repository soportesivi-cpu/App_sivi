# 📱 Arquitectura de Pantallas y Lógica de Negocio
> **Documento 02:** Detalle de pestañas, enrutamiento, lógica interna de frontend y mecanismos de resiliencia de la interfaz móvil.

---

## 🗂️ Estructura de Navegación (Tabs y Expo Router)

La aplicación móvil organiza su flujo de trabajo principal en **cinco pestañas operativas** bajo el tab-bar nativo, configuradas en la ruta `/app/(tabs)`. Cada pantalla posee su propio ciclo de vida y sus conexiones dinámicas a la API de producción de SIVI:

```
                  ┌──────────────────────────────────────────────┐
                  │              Tab-Bar Principal               │
                  └─┬──────────┬──────────┬──────────┬─────────┬─┘
                    │          │          │          │         │
              ┌─────▼───┐┌─────▼───┐┌─────▼───┐┌─────▼───┐┌────▼────┐
              │Dashboard││ Cámaras ││ Buscar  ││ Alertas ││ Eventos │
              └─────────┘└─────────┘└─────────┘└─────────┘└─────────┘
```

---

## ⚙️ Análisis Detallado de Cada Pestaña y su Lógica

---

### 1. 📊 Panel de Control (Dashboard)
* **Archivo Principal:** `app/(tabs)/index.tsx` (Componente de UI: `components/AdminDashboard.tsx`)
* **Lógica Interna:**
  * **Síntesis Dinámica de Datos (REST BFF):** Al cargar, ejecuta de forma asíncrona y en paralelo dos consultas: `getWorkspaceState()` (estado del hardware/discos/cámaras) y `getAlerts(1)` (lista de alertas históricas recientes).
  * **Normalizador Intermedio:** Une y traduce los datos de producción de ambos endpoints:
    * Convierte el listado de cámaras en un estado en vivo binario: si la cámara tiene la propiedad `error: true` en el JSON remoto, se clasifica como **Offline**, de lo contrario se clasifica como **Online**.
    * Extrae el porcentaje de almacenamiento en disco real (`disk0.percent` o `ram.percent`).
    * Mapea la lista de alertas recientes traduciendo tipos de analíticas en strings legibles e íconos gráficos (`walk-outline` para intrusiones, `car-outline` para placas, `person-outline` para rostros).
  * **Interacción:** El botón "Ver todas" redirige instantáneamente al usuario a la pestaña de Alertas con una transición animada.

---

### 2. 🎥 Monitoreo en Vivo (Cámaras)
* **Archivo Principal:** `app/(tabs)/cameras.tsx`
* **Lógica Interna:**
  * **Carga de Grid Dinámico:** Recupera la lista de cámaras activas del servidor (`getDevices()`). Extrae el nombre del stream HLS/WebRTC directamente analizando la cadena RTSP:
    `rtsp://control.sivi.imperium.pe:8554/{STREAM_NAME}`
  * **Reproductor WebRTC / HLS Híbrido:** Renderiza cada celda de video a través de un componente `<WebView>` que hospeda un reproductor interno HTML5. Este inyecta scripts optimizados para:
    1. Intentar conectarse a la API de WHEP (baja latencia WebRTC Peer Connection).
    2. Escuchar candidatos ICE del MediaMTX.
    3. Si falla la conexión WebRTC por cortafuegos o mala señal, realiza un fallback transparente en menos de 3 segundos cargando la lista HLS `.m3u8` en el puerto `8888`.
  * **Overlay de Analíticas en Tiempo Real:** Establece un canal WebSocket exclusivo escuchando el evento `draw_streaming`. Recibe las coordenadas normalizadas (rango `0.0` a `1.0`) de los objetos e intrusiones detectados y dibuja cajas dinámicas de color rojo/verde flotando exactamente encima del video en vivo.

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
  * **Mapeo Automatizado de Alarmas:** Consume el endpoint real `/alarm/?page=1` de producción.
  * **Clasificador:** Clasifica las alarmas complejas del servidor en cuatro categorías reconocibles en el móvil (`FACE` para rostros, `LPR` para patentes, `OBJECT` para objetos, `ACTION` para intrusiones/movimiento).
  * **Cámara-Rules Sync:** Cuenta cuántas cámaras físicas tienen asignada esa regla específica analizando la propiedad remota `Detail_device_alarm.length`.
  * **Manejo de Estados Persistentes:** Almacena localmente las activaciones del switch a través de un gestor de estados de React (`localActiveStates`) para asegurar una respuesta visual inmediata.
  * **Resiliencia Automática (Fallback de Red):** Si el servidor de producción no está disponible, el sistema detecta la falla de red y carga dinámicamente un conjunto de datos ficticios locales (mocks de alta calidad) para mantener la app 100% interactiva sin cerrarse o lanzar excepciones visuales críticas al usuario.
