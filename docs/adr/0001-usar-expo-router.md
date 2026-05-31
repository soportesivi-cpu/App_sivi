# ADR 0001: Uso de Expo Router para Navegación

**Fecha:** Mayo 2026
**Estado:** Aceptado

## Contexto
En React Native, el estándar de facto para navegación durante muchos años fue `React Navigation`. Sin embargo, esto implicaba escribir mucho código "repetitivo" (boilerplate) para definir las rutas manualmente, anidar navegadores de "Stacks" y "Tabs" mediante código complejo, y pasar propiedades de forma manual.

## Decisión
Se decidió utilizar **Expo Router**.

## Justificación (¿Por qué es mejor?)
1. **Rutas basadas en archivos (File-based routing):** Funciona igual que Next.js en la web. Si creas un archivo `app/perfil.tsx`, la ruta automáticamente es `/perfil`. Esto hace que el proyecto sea **muy fácil de entender visualmente**. 
2. **Menos código:** Reduce drásticamente la cantidad de código necesario para configurar la navegación.
3. **Deep Linking automático:** Abrir la aplicación desde un enlace externo (como un correo) hacia una pantalla específica funciona casi automáticamente, sin configuraciones complejas.

## Consecuencias
*   **Positivo:** Onboarding más rápido para nuevos desarrolladores, código más limpio.
*   **Negativo:** Requiere entender cómo funcionan los grupos como `(auth)` o `(tabs)`, que son carpetas invisibles en la URL pero agrupan lógica visual.
