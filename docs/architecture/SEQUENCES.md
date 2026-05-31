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

    Usuario->>UI: Ingresa Email, Contraseña y presiona "Ingresar"
    UI->>APIClient: autoLogin(email, password)
    
    rect rgb(230, 240, 255)
        Note right of APIClient: Prueba conectar con el Dominio Configurado
        APIClient->>API: POST /api/v1/auth/login
        API-->>APIClient: Retorna { jwt, userData }
    end

    APIClient-->>UI: Retorna datos de sesión
    
    UI->>Store: setSession(domain, jwt, userData)
    
    rect rgb(230, 255, 230)
        Note right of Store: Guarda en el teléfono para persistencia
        Store->>Secure: Guardar en disco (token, dominio)
    end
    
    Store-->>UI: Estado actualizado

    Note over UI, Router: El archivo index.tsx detecta el cambio
    alt Es SuperAdmin
        UI->>Router: Redirige a /(admin)/workspaces
    else Es Usuario Normal
        UI->>Router: Redirige a /(tabs)/dashboard
    end
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
    participant Router as Expo Router

    Usuario->>Layout: Abre la aplicación
    Layout->>Store: hydrate()
    
    Store->>Secure: ¿Hay sesión guardada?
    Secure-->>Store: Sí (Devuelve Token y Dominio)
    
    Store-->>Layout: isHydrated = true
    Layout->>Router: Muestra index.tsx
    
    Note right of Router: Como el Store tiene Token...
    Router-->>Usuario: Redirige directo al Dashboard
```
