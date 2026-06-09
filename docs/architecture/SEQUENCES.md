# Diagramas de Secuencia

Estos diagramas explican paso a paso cómo suceden los flujos más importantes en la aplicación. Son fáciles de leer de arriba hacia abajo.

## 1. Flujo de Inicio de Sesión (Login)

Este es el proceso exacto de lo que ocurre cuando un usuario presiona "Ingresar" en la pantalla de Login.

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant UI as Pantalla (Login)
    participant APIClient as Cliente API (api.ts)
    participant API as Backend (Sivi API)
    participant Store as Estado Global (Zustand)
    participant Secure as SecureStore (Teléfono)
    participant Router as Expo Router

    Usuario->>UI: Ingresa Email, Contraseña y presiona "LOGIN"
    UI->>APIClient: autoLogin(email, password)
    
    rect rgb(230, 240, 255)
        Note right of APIClient: Conecta a la pasarela de login consolidada
        APIClient->>API: POST /mobile/auth/login
        API-->>APIClient: Retorna datos del usuario y workspaces vinculados
    end

    APIClient-->>UI: Retorna { workspace, data: { token, jwt, user, sessions } }
    
    UI->>Store: setSession(domain, token, jwt, user, workspace, sessions)
    
    rect rgb(230, 255, 230)
        Note right of Store: Guarda en el almacenamiento seguro del dispositivo
        Store->>Secure: Guardar en disco (dominio, tokens, user, workspace, sesiones)
    end
    
    Store-->>UI: Estado actualizado (jwtToken y activeDomain establecidos)

    UI->>Router: Redirige a /(tabs)/dashboard
    Note over Router: En (tabs)/dashboard, se renderiza condicionalmente el dashboard adecuado (SuperAdmin o Admin regular) según el rol del usuario.
```

## 2. Flujo de Hidratación (Abrir la App)

¿Qué pasa cuando el usuario cierra y vuelve a abrir la app? No queremos que inicie sesión otra vez. A esto le llamamos "Hidratación".

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant Layout as _layout.tsx (Inicio)
    participant Store as Estado Global (Zustand)
    participant Secure as SecureStore (Teléfono)
    participant Index as index.tsx (Rutero Inicial)
    participant Router as Expo Router

    Usuario->>Layout: Abre la aplicación
    Layout->>Store: hydrate()
    
    rect rgb(230, 240, 255)
        Note right of Store: Lee la sesión guardada del teléfono
        Store->>Secure: Cargar active_domain, jwt_token, user_data, etc.
        Secure-->>Store: Retorna datos guardados
    end
    
    Store-->>Layout: isHydrated = true
    Layout->>Index: Renderiza componente index.tsx
    
    alt jwtToken no está vacío (Sesión activa)
        Index->>Router: Redirige a /(tabs)/dashboard
    else jwtToken está vacío (Sin sesión)
        Index->>Router: Redirige a /(auth)/login
    end
```
