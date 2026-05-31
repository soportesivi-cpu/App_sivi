# Changelog

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto se adhiere al [Versionamiento Semántico](https://semver.org/lang/es/).

## [Unreleased]
### Añadido
- Documentación inicial del proyecto (Fase 1): `README.md`, `CONTRIBUTING.md` y `CHANGELOG.md`.

## [1.0.1] - Versión actual base
### Añadido
- Integración con Expo Router para la navegación entre `(auth)`, `(admin)` y `(tabs)`.
- Implementación del store global con Zustand para manejar el estado de la sesión, dominios y preferencias de tema oscuro/claro.
- Cliente de API configurado para conectarse a endpoints como `/alerts/`, `/device/`, `/face/`, etc.
- Interceptor básico para cerrar sesión automáticamente tras recibir un error `401 Unauthorized`.
- Soporte para WebSockets.
- Dependencia de `@tanstack/react-query` para la gestión de peticiones.
