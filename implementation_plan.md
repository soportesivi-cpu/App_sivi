# Plan de Implementación: Conexión Real y Normalización de API para el Workspace de Control

Este plan detalla los pasos para realizar la transición del workspace **Imperium Control** (`control.guardian.imperium.pe`) desde el bypass virtual simulado hacia la **conexión real con el servidor en la nube**, cargando el Dashboard, Cámaras, Alertas, Rostros y Búsqueda Forense con datos auténticos en vivo.

---

## 📐 Objetivos Técnicos

1. **Autenticación Real:** Permitir que las credenciales `admin@control.com` / `admin123` se autentiquen contra el servidor físico real de Imperium Control en la nube, obteniendo un Token JWT genuino.
2. **Normalización Defensiva de API:** Evitar que discrepancias en los nombres de variables devueltas por el backend (snake_case) con respecto a la UI (camelCase) causen pantallas en blanco o crashes. Convertiremos y normalizaremos las respuestas directamente en los servicios de API.
3. **Conexión WebSocket en Vivo:** Habilitar de forma segura la conexión WebSocket (Socket.IO) real para este usuario, de modo que reciba eventos en tiempo real.
4. **Búsqueda Forense Funcional:** Conectar la pestaña **Buscar** a la API real de búsqueda forense del servidor en lugar de usar datos mock estáticos.
5. **Preservación de Entornos de Simulación:** Mantener la simulación de dominios virtuales `sim-` intacta para que el entorno de desarrollo y pruebas locales continúe siendo 100% utilizable.

---

## 🛠️ Paso a Paso Detallado

### Paso 1: Remover el Bypass Hardcodeado de `admin@control.com`
Eliminaremos la interceptación simulada para el correo `admin@control.com` en los archivos `services/api.ts` y `services/websocket.ts`. 
- Al hacer esto, cuando el usuario intente loguearse con `admin@control.com` / `admin123`, el sistema realizará una petición HTTP POST real hacia la nube (`https://control.guardian.imperium.pe/api/v1/auth/login`).
- De igual forma, el WebSocket intentará abrir una conexión de Socket.IO real contra la nube con el Token JWT real obtenido.
- *Nota:* Se mantendrán intactas las validaciones para dominios `sim-` (`sim-cloud.sivi.pe`, `sim-local.sivi.pe`) de modo que sigan sirviendo para demostraciones simuladas.

---

### Paso 2: Crear Capa de Normalización Defensiva en `services/api.ts`
El backend real expone campos en formato `snake_case`, mientras que la interfaz móvil de SIVI espera campos estructurados o en `camelCase`. Implementaremos funciones mapeadoras que transformen las respuestas antes de entregarlas a los componentes React.

#### A. Normalización del Dashboard (`normalizeDashboardData`)
Mapea el retorno del endpoint `/mobile/v1/dashboard`:
- `summary.cameras.online` ➔ `summary.cameras.on`
- `summary.cameras.offline` ➔ `summary.cameras.off`
- `summary.storage.percentage` ➔ `summary.storage.percent`
- `summary.storage.estimated_days_left` ➔ `summary.storage.days`
- `alerts_24h` ➔ `alerts24h` (manteniendo `face`, `lpr`, `object`, `intrusion`)
- `operation_metrics` ➔ `metrics`:
  - `total_alerts` ➔ `metrics.total`
  - `resolved` ➔ `metrics.resolved`
  - `unresolved` ➔ `metrics.unresolved`
  - `effective_percentage` ➔ `metrics.effective` (convertido a string format: `"XX.XX%"`)
- `recent_alerts` ➔ `recentAlerts` (mapeando cada elemento):
  - `time` ➔ `timestamp`
  - `camera` ➔ `camera_name`
  - `percent` ➔ `tag_value`
  - `img` ➔ `thumbnail_url`
  - `type` ➔ `type`
  - `icon` ➔ Mapeo dinámico según el tipo (`intrusion` -> `walk-outline`, `lpr` -> `car-outline`, `face` -> `person-outline`, etc.)

#### B. Normalización de Alertas (`normalizeAlerts`)
Asegura que el historial de alertas `/alerts/` tenga:
- `url_evidence` ➔ si el servidor devuelve `image_url`, mapearlo aquí. Si viene con prefijo `/alice-media`, resolverlo a la URL absoluta del dominio conectado.
- `motive_categorie` ➔ si el servidor devuelve `title` o `tag`, mapearlo apropiadamente para no romper la clasificación visual.

---

### Paso 3: Conectar la Búsqueda Forense Real en `app/(tabs)/search.tsx`
Actualmente la pantalla de búsqueda utiliza el arreglo estático `MOCK_RESULTS` y no realiza peticiones reales.
1. **Crear función `searchForense` en `services/api.ts`:**
   - Consumirá el endpoint `GET /mobile/v1/search` pasando los query params:
     - `type`: `face | lpr | object | motion` (convertido a minúsculas)
     - `date_from` y `date_to`: formateados en estándar ISO (`YYYY-MM-DDTHH:mm:ss`) calculados dinámicamente según el rango seleccionado en el calendario.
     - `device_id`: ID de la cámara seleccionada (si aplica)
     - `page`: Número de página (por defecto 1)
2. **Normalizar los Resultados de Búsqueda (`normalizeSearchRows`):**
   - Transforma los datos de la nube en la estructura del UI:
     ```typescript
     {
       id: row.id,
       type: row.type.toUpperCase(),
       name: row.title || row.label || row.plate || 'Detección',
       cam: row.device?.name || 'Cámara',
       time: formatearFecha(row.createdAt),
       confidence: Math.round((row.probability || 0.95) * 100),
       icon: obtenerIcono(row.type),
       color: obtenerColor(row.type),
       img: row.image_url || row.url_evidence
     }
     ```
3. **Refactorizar `search.tsx`:**
   - Eliminar el uso del mock estático `MOCK_RESULTS`.
   - Crear un estado `results` y un indicador `loadingResults` en React.
   - Enlazar el botón **"Ejecutar Búsqueda"** para llamar a `searchForense(...)` pasando todos los filtros seleccionados en los modales interactivos (Analítica, Cámaras, Fechas y Horas) y actualizar el listado en tiempo real.

---

### Paso 4: Estado de la Pestaña "Eventos"
La pestaña **Eventos** (`events.tsx`) maneja reglas estáticas de analíticas activas locales (toggles de encendido/apagado de analíticas y thresholds). 
- Para control de flujo del lado de la app, se mantendrá la lógica interactiva local de switches totalmente funcional.
- Si en el futuro se proporciona un endpoint de configuración de reglas, se acoplará de inmediato. Por ahora permanece como componente interactivo para demostración offline.

---

## 📁 Archivos a Modificar

1. **[services/api.ts](file:///d:/AliceGuardianApp/AliceGuardianApp/services/api.ts):**
   - Eliminar checks de bypass para `admin@control.com`.
   - Implementar funciones mappers de normalización (`normalizeDashboardData`, `normalizeAlertsData`, `normalizeSearchRows`).
   - Crear la función exportable `searchForense(params)`.
2. **[services/websocket.ts](file:///d:/AliceGuardianApp/AliceGuardianApp/services/websocket.ts):**
   - Permitir la conexión física a Socket.IO real cuando el token de sesión sea real y el dominio sea de producción.
3. **[app/(tabs)/search.tsx](file:///d:/AliceGuardianApp/AliceGuardianApp/app/(tabs)/search.tsx):**
   - Integrar la llamada a `searchForense` en el botón de Ejecutar Búsqueda.
   - Reemplazar el renderizado estático por datos reales devueltos por el servidor de Imperium en la nube.

---

## 🧪 Plan de Verificación

1. **Inicio de Sesión Limpio:**
   - Ingresar con `admin@control.com` / `admin123`.
   - Validar en consola que la petición viaja a `https://control.guardian.imperium.pe/api/v1/auth/login`.
   - Verificar que se almacena el token JWT real en `SecureStore`.
2. **Validación del Dashboard Real:**
   - Comprobar que se cargan las métricas reales del servidor.
   - Verificar que el badge visual superior derecho muestra **🟢 NUBE**.
   - Validar que las "Últimas Alertas" renderizan con sus fotos reales de la nube.
3. **Verificación de Cámaras:**
   - Acceder a la pestaña **Cámaras**.
   - Validar que se listan los dispositivos reales de Imperium y que cargan sus streams de video WHEP/HLS en vivo.
4. **Verificación de Alertas en Tiempo Real:**
   - Abrir la pestaña **Alertas**.
   - Verificar el historial dinámico real y la conexión del Socket.IO (Socket.IO conectado exitosamente).
5. **Ejecución de Búsqueda Forense:**
   - Ir a la pestaña **Buscar**.
   - Seleccionar un tipo de analítica (por ejemplo, "Face") y presionar **"Ejecutar Búsqueda"**.
   - Validar que los resultados cargan dinámicamente y se actualiza el contador.
6. **Compilación y Tipado:**
   - Ejecutar `npx tsc --noEmit` para asegurar que el proyecto no contiene errores sintácticos ni de TypeScript.
