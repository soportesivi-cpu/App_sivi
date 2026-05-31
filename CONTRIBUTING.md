# Guía de Contribución (CONTRIBUTING)

¡Gracias por interesarte en contribuir a **Sivi (AliceGuardianApp)**! Esta guía establece los estándares para mantener el código limpio y organizado.

## 🌿 Convenciones de Ramas (Branches)

Por favor, crea una rama nueva para cada funcionalidad o corrección. Usa la siguiente nomenclatura:

*   `feature/nombre-de-la-funcionalidad`: Para nuevas funcionalidades.
*   `bugfix/descripcion-del-bug`: Para corrección de errores de desarrollo.
*   `hotfix/descripcion-critica`: Para corrección de errores urgentes en producción.
*   `refactor/descripcion`: Para mejoras o reestructuración de código existente sin añadir funcionalidades nuevas.
*   `docs/descripcion`: Para cambios que solo afectan a la documentación.

**Ejemplo:** `feature/agregar-login-biometrico`

## 💬 Convenciones de Commits

Utilizamos [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/). El formato básico es:

```text
<tipo>[ámbito opcional]: <descripción corta>
```

**Tipos permitidos:**
*   `feat`: Nueva característica.
*   `fix`: Solución de un error.
*   `docs`: Cambios en la documentación.
*   `style`: Formato (espacios, punto y coma, etc; sin cambios de lógica).
*   `refactor`: Refactorización del código.
*   `test`: Añadir o corregir pruebas.
*   `chore`: Tareas de mantenimiento, actualización de dependencias.

**Ejemplos:**
*   `feat(auth): implementar persistencia del token en secure store`
*   `fix(api): manejar error 401 correctamente al renovar token`
*   `chore: actualizar @tanstack/react-query a la versión 5.99.1`

## 🔄 Proceso de Pull Requests (PR)

1.  Asegúrate de que tu código sigue el estilo del proyecto y funciona correctamente (ejecuta la app antes de hacer commit).
2.  Haz `push` de tu rama al repositorio remoto.
3.  Abre un Pull Request hacia la rama principal (usualmente `main` o `develop`).
4.  Proporciona una descripción clara en el PR explicando qué problema resuelve y qué cambios hiciste.
5.  Asigna un revisor.
6.  Una vez aprobado, el PR podrá ser fusionado (merged).

## 🛠️ Estándares de Código

*   Usa **TypeScript** de forma estricta siempre que sea posible. Evita usar el tipo `any`.
*   Para estados globales de UI y configuración, usa **Zustand** en `services/store.ts`.
*   Para estados de servidor (fetching de datos), usa **React Query**.
*   Mantén los componentes funcionales de React pequeños y enfocados en una sola responsabilidad.
