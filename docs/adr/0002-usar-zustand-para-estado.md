# ADR 0002: Uso de Zustand para el Estado Global

**Fecha:** Mayo 2026
**Estado:** Aceptado

## Contexto
La aplicación necesita mantener información disponible en cualquier pantalla (ej. si el usuario tiene una sesión iniciada `jwtToken`, el dominio activo `activeDomain`, y sus datos personales). Tradicionalmente, se usaba `Redux` o la `Context API` de React para esto.

## Decisión
Se decidió utilizar **Zustand** para la gestión del estado global en combinación con **Expo Secure Store** para la persistencia.

## Justificación (¿Por qué es mejor?)
1. **Simplicidad Extrema:** Zustand requiere mucho menos código que Redux. No hay *reducers*, *actions*, ni *dispatchers* complejos. Solo se crea el *store* y se usa.
2. **Rendimiento:** A diferencia de la *Context API* de React, Zustand no re-renderiza toda la aplicación cuando cambia un estado, sino solo el componente específico que está "escuchando" ese dato concreto.
3. **Fácil de Persistir:** Se integró fácilmente una función manual (`hydrate`, `setSession`) para guardar los datos sensibles directamente en `SecureStore`, asegurando que el token JWT no se guarde en texto plano en el celular.

## Consecuencias
*   **Positivo:** El archivo `services/store.ts` es corto, limpio y extremadamente fácil de leer para cualquier programador Junior o Senior.
*   **Positivo:** No envuelve la aplicación en Providers innecesarios.
