# Modelo de Datos (Estado Global de la App)

A diferencia de una aplicación web tradicional, esta aplicación móvil no tiene una base de datos local grande (como SQLite). En su lugar, utilizamos un **Store en memoria (Zustand)** para guardar los datos que se necesitan rápido, y **SecureStore** para guardarlos en el disco físico del celular para que no se borren.

Este diagrama muestra exactamente qué datos guarda la aplicación para funcionar. Es muy sencillo de entender.

```mermaid
erDiagram
    %% Definición de las "Tablas" o Entidades
    ZUSTAND_STORE {
        boolean isHydrated "Indica si la app ya cargó los datos del celular"
        string activeDomain "URL del servidor al que estamos conectados"
        string jwtToken "Llave temporal para tener acceso a la API"
        json userData "Datos básicos del usuario (rol, nombre)"
        json activeWorkspace "Workspace activo del usuario"
        json impersonatedWorkspace "Workspace personificado (SuperAdmin)"
        array workspaceSessions "Lista de sesiones autorizadas en cada workspace"
        boolean isDarkMode "Preferencia visual: Tema Oscuro o Claro"
        boolean soundEnabled "Preferencia de audio para alertas de seguridad"
    }

    SECURE_STORE_DISCO {
        string active_domain "Guardado seguro de la URL activa"
        string jwt_token "Token JWT guardado seguro"
        string workspace_token "Token de acceso al workspace activo"
        string user_data "Datos serializados del usuario en JSON"
        string active_workspace "Datos serializados del workspace activo"
        string workspace_sessions "Colección serializada de sesiones de workspaces"
        string theme_preference "Preferencia guardada de tema (dark/light)"
        string sound_preference "Preferencia de sonido de alertas (enabled/disabled)"
    }

    API_RESPONSES_CACHE {
        json Alerts "Lista de alertas cacheadas (React Query)"
        json Devices "Lista de cámaras cacheadas (React Query)"
    }

    %% Relaciones explicativas
    SECURE_STORE_DISCO ||--o| ZUSTAND_STORE : "Alimenta al Store al abrir la app"
    ZUSTAND_STORE ||--o| API_RESPONSES_CACHE : "El token da permiso para traer estos datos"
```

### ¿Qué significa esto de forma práctica?

1. **Zustand Store:** Es la memoria rápida. Si la pantalla de Perfil quiere saber el nombre del usuario, se lo pide a `userData` en Zustand. Es instantáneo.
2. **Secure Store (Disco):** Si apagas el celular y vuelves a abrir la app, la memoria rápida (Zustand) está vacía. Entonces, la app lee el `Secure Store` (el disco) para recuperar el `jwtToken` y no pedirte que inicies sesión de nuevo. A este proceso se le llama **Hidratación**.
3. **Caché (React Query):** Los datos grandes (listas de cámaras, alertas de movimiento) **no** se guardan de por vida en el celular. Se traen de internet y se guardan temporalmente en caché para que la app se sienta rápida, pero se descartan cuando se cierra la aplicación.

