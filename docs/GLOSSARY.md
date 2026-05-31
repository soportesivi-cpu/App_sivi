# Glosario del Proyecto

Para que cualquier persona pueda entender el proyecto rápidamente, aquí definimos los conceptos y términos clave utilizados en el código y en el negocio.

## Términos de la Aplicación

| Término | Qué significa en Sivi |
| :--- | :--- |
| **Workspace (Espacio de Trabajo)** | Es un entorno aislado para un cliente específico (ejemplo: `Imperium`). Cada Workspace tiene su propio dominio asignado para conectarse. |
| **Domain (Dominio)** | La URL específica a la que la aplicación móvil se conecta para consumir la API de un Workspace (ejemplo: `control.guardian.imperium.pe`). |
| **JWT Token** | Es una "llave" digital temporal que la aplicación recibe después de un inicio de sesión exitoso. Se envía en cada petición a la API para demostrar que el usuario tiene permiso. |
| **Store (Zustand)** | Es la "memoria a corto plazo" de la aplicación. Guarda datos importantes que se necesitan en múltiples pantallas (como el usuario actual o el dominio) para no tener que consultarlos a cada rato. |
| **Secure Store** | Es la "caja fuerte" del teléfono (Keychain en iOS, Keystore en Android). Aquí guardamos datos sensibles como el JWT Token para que no se pierdan si se cierra la app. |
| **HLS (HTTP Live Streaming)** | Es la tecnología que usamos para transmitir video en vivo desde las cámaras hacia la aplicación (`react-native-webview` / `expo-av`). |

## Módulos del Sistema (API Externa)

*   **Alerts:** Notificaciones críticas generadas por el sistema.
*   **Devices:** Las cámaras físicas o dispositivos de monitoreo conectados.
*   **Faces / Trained Faces:** El módulo de reconocimiento facial (personas registradas y detectadas).
*   **Motion:** El módulo encargado de detectar movimiento en áreas configuradas.
*   **Objects:** Detección de objetos específicos en la escena.
