# Guía de Onboarding para Nuevos Desarrolladores

¡Bienvenido al equipo de **Sivi (AliceGuardianApp)**! 

Sabemos que el primer día en un proyecto nuevo puede ser abrumador. Esta guía está diseñada para que, de forma fácil y rápida, puedas tener la aplicación corriendo en tu computadora y entiendas dónde están las cosas.

## Día 1: Configurando tu Entorno

### 1. Requisitos Previos
Asegúrate de tener instalado en tu computadora:
*   [Node.js](https://nodejs.org/en) (Usa la versión LTS recomendada).
*   Un editor de código (Recomendamos **Visual Studio Code**).
*   En tu celular (Android o iOS), descarga la aplicación **Expo Go** desde tu tienda de aplicaciones.

### 2. Levantar el proyecto
Abre tu terminal, ve a la carpeta donde quieres guardar el proyecto y ejecuta:

```bash
# 1. Clona el proyecto (pide acceso si no lo tienes)
git clone <url-del-repo>
cd AliceGuardianApp

# 2. Instala las dependencias (librerías)
npm install

# 3. Inicia el servidor local
npm start
```

### 3. ¡Ver la magia!
Al ejecutar `npm start`, verás un código QR en tu terminal. 
*   **Si tienes iPhone:** Abre la cámara de tu iPhone y escanea el código. Toca la notificación que aparece.
*   **Si tienes Android:** Abre la app **Expo Go** que descargaste y selecciona "Scan QR Code".

¡Felicidades! Ya deberías estar viendo la pantalla de inicio de sesión de Sivi en tu celular.

## ¿Dónde empiezo a leer el código?

No intentes leer todo de golpe. Sigue este orden:

1.  **Mira el archivo `app.json`:** Aquí está el nombre de la app, el ícono, y la versión.
2.  **Abre `app/_layout.tsx`:** Este es el punto de entrada principal. Fíjate cómo envuelve la app y revisa si el usuario tiene sesión guardada.
3.  **Abre `app/index.tsx`:** Es el "oficial de tránsito". Dependiendo de si tienes o no sesión, te enviará a `/(auth)` (login) o a `/(tabs)` (dashboard).
4.  **Abre `services/api.ts`:** Si necesitas conectar una pantalla nueva a la base de datos externa, aquí es donde crearás la función para hacerlo.

## Consejos Finales
*   **No toques el `package.json`** a menos que sea estrictamente necesario instalar una nueva librería, y siempre avisa al equipo.
*   Si algo falla o marca error en rojo, revisa el archivo `docs/runbook.md` para ver soluciones comunes.
*   Ante cualquier duda, lee la carpeta `docs/`. ¡Para eso está!
