# Sivi (Alice Guardian App)

Aplicación móvil construida con React Native y Expo para la gestión de seguridad, videovigilancia, monitoreo de dispositivos, y alertas (detección de movimiento, reconocimiento facial y de objetos).

## 🚀 Tecnologías Principales

*   **Framework:** [React Native](https://reactnative.dev/) v0.81.5
*   **Plataforma:** [Expo](https://expo.dev/) SDK ~54
*   **Navegación:** [Expo Router](https://docs.expo.dev/router/introduction/) v6
*   **Estado Global:** [Zustand](https://github.com/pmndrs/zustand)
*   **Server State & Fetching:** [React Query (@tanstack/react-query)](https://tanstack.com/query/v5)
*   **Almacenamiento Seguro:** Expo Secure Store

## 📂 Estructura del Proyecto

```text
/
├── app/                  # Rutas de la aplicación (Expo Router)
│   ├── (admin)/          # Vistas exclusivas de SuperAdmin
│   ├── (auth)/           # Flujos de autenticación (Login)
│   ├── (tabs)/           # Vistas principales (Dashboard)
│   ├── _layout.tsx       # Configuración global y providers
│   └── index.tsx         # Controlador de acceso y redirecciones
├── components/           # Componentes UI reutilizables (ej. Loading)
├── constants/            # Variables estáticas y configuración (config.ts)
├── services/             # Lógica de negocio y conectividad
│   ├── api.ts            # Cliente HTTP y Endpoints
│   ├── store.ts          # Store de Zustand
│   └── websocket.ts      # Manejo de WebSockets en tiempo real
├── assets/               # Imágenes, íconos y recursos estáticos
├── app.json              # Configuración de Expo
└── package.json          # Dependencias y scripts
```

## ⚙️ Requisitos Previos

*   [Node.js](https://nodejs.org/) (versión LTS recomendada)
*   [npm](https://www.npmjs.com/) (viene con Node.js)
*   La aplicación **Expo Go** en tu dispositivo móvil o un emulador de Android/iOS configurado.

## 🛠️ Instalación y Configuración

1. Clona el repositorio:
   ```bash
   git clone <url-del-repositorio>
   cd AliceGuardianApp
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

## 🏃‍♂️ Ejecución en Desarrollo

Inicia el servidor de desarrollo de Expo:

```bash
npm start
```

*   Presiona `a` para abrir en un emulador de Android.
*   Presiona `i` para abrir en un simulador de iOS.
*   Escanea el código QR con la app de cámara de tu dispositivo (iOS) o la app Expo Go (Android) para probarlo en físico.

## 📦 Construcción (Builds)

Este proyecto está configurado para usar EAS (Expo Application Services) para la generación de builds. Revisa el archivo `eas.json` para las configuraciones de `preview` y `production`.

## 📜 Licencia
Propiedad de Sivi / Ebenezer Techs. Todos los derechos reservados.
