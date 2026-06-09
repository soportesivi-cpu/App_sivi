# Glosario del Proyecto

Para que cualquier persona pueda entender el proyecto rápidamente, aquí definimos los conceptos y términos clave utilizados en el código y en el negocio.

## Términos de la Aplicación

| Término | Qué significa en Sivi |
| :--- | :--- |
| **Workspace (Espacio de Trabajo)** | Es un entorno aislado para un cliente específico (ejemplo: `Imperium`). Cada Workspace tiene sus propios dispositivos, reglas y configuración. |
| **Domain (Dominio)** | La URL específica a la que la aplicación móvil se conecta para consumir la API de un Workspace (ejemplo: `control.guardian.imperium.pe`). |
| **Orchestrator BFF (API Gateway)** | El servidor central (`orchestrator.guardian.imperium.pe`) que maneja la autenticación unificada, distribuye las sesiones de múltiples workspaces y media las peticiones de datos de la app. |
| **JWT Token** | Es una "llave" digital temporal que la aplicación recibe después de iniciar sesión. Se envía en cada petición a la API Gateway para autorizar el acceso a los datos. |
| **Impersonation (Personificación)** | Acción que permite al rol de `SuperAdmin` seleccionar un workspace específico y visualizar su dashboard y cámaras como si fuera un administrador local. |
| **Store (Zustand)** | Memoria de la aplicación que guarda estados globales importantes en tiempo de ejecución (como el token activo, el dominio seleccionado o la lista de sesiones). |
| **Secure Store** | "Caja fuerte" local del móvil (`expo-secure-store`). Guarda datos persistentes de forma segura, como los tokens de sesión de cada workspace y el tema visual. |
| **WebRTC WHEP** | Protocolo primario de streaming de video de bajísima latencia (<1s) que establece conexiones P2P directas desde MediaMTX a la app usando un `<WebView>`. |
| **HLS (HTTP Live Streaming)** | Protocolo secundario de video por segmentos (`.m3u8`) que actúa como fallback en la WebView si las restricciones de red bloquean la conexión WebRTC. |

## Módulos del Sistema (API Externa / Analíticas)

*   **Alerts / Smart Events:** Notificaciones críticas de analíticas generadas por las cámaras (intrusión, rostro detectado, etc.) que se muestran en el historial o alertas rápidas.
*   **Devices (Dispositivos):** Las cámaras físicas de videovigilancia IP o grabadores conectados en cada workspace.
*   **FACE (Reconocimiento Facial):** Reglas de analíticas que identifican rostros de personas registradas o desconocidas.
*   **LPR (License Plate Recognition):** Reglas de analíticas diseñadas para leer y registrar placas vehiculares.
*   **OBJECT (Objetos):** Reglas de analíticas encargadas de detectar objetos de interés (ej: armas o mochilas).
*   **ACTION (Acciones / Intrusiones):** Reglas de analíticas que alertan sobre intrusiones o movimiento en áreas prohibidas.

