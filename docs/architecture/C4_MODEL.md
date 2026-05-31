# Modelo de Arquitectura (C4)

Este documento explica cómo funciona la aplicación Sivi a vista de pájaro, para que sea fácil de entender.

## 1. Diagrama de Contexto (Nivel 1)
*¿Quién usa el sistema y con qué interactúa?*

```mermaid
C4Context
    title Diagrama de Contexto de Sivi (Alice Guardian App)

    Person(user, "Usuario / Administrador", "Usuario que monitorea alertas y dispositivos en la app móvil.")
    System(app, "Sivi App", "Aplicación móvil React Native/Expo. Permite visualizar cámaras, alertas y gestionar el Workspace.")
    System_Ext(api, "API Sivi Backend", "El servidor principal (ej. Imperium). Gestiona lógica pesada, IA, reconocimiento facial y base de datos.")

    Rel(user, app, "Usa la app", "Táctil")
    Rel(app, api, "Consume datos, video en vivo y WebSockets", "HTTPS/WSS")
```

---

## 2. Diagrama de Contenedores (Nivel 2)
*¿Cómo está estructurada la app móvil por dentro?*

```mermaid
C4Container
    title Diagrama de Contenedores - Sivi App

    System_Boundary(mobile, "Aplicación Móvil Sivi") {
        Container(ui, "Capa de Vistas (Expo Router)", "React/TypeScript", "Gestiona las pantallas (Auth, Tabs, Admin) y la navegación.")
        Container(state, "Gestor de Estado (Zustand)", "TypeScript", "Mantiene en memoria el Token, Dominio y Usuario.")
        Container(fetching, "Sincronizador (React Query)", "TypeScript", "Se encarga de hacer las peticiones a la API y guardar en caché (ej. lista de alertas).")
        Container(secure, "Almacenamiento Seguro", "Expo SecureStore", "Guarda el JWT Token y el Dominio encriptados en el celular.")
    }

    System_Ext(api, "API Sivi Backend", "control.guardian.imperium.pe")

    Rel(ui, state, "Lee y actualiza estado")
    Rel(ui, fetching, "Pide datos (Hooks)")
    Rel(fetching, api, "Hace peticiones HTTPS")
    Rel(state, secure, "Guarda persistencia en disco")
```

**Explicación Simple:**
1. Las pantallas (**Expo Router**) piden datos usando **React Query**.
2. **React Query** se comunica con la **API externa**.
3. Si la pantalla necesita saber quién está logueado, le pregunta a **Zustand**.
4. **Zustand** guarda la sesión de forma segura usando **SecureStore** para que al reiniciar la app no haya que volver a poner la contraseña.
