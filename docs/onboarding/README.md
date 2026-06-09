# Guía de Onboarding para Nuevos Desarrolladores

¡Bienvenido al equipo de **Sivi (AliceGuardianApp)**! 

Sabemos que el primer día en un proyecto nuevo puede ser abrumador. Esta guía está diseñada para que, de forma fácil y rápida, puedas tener la aplicación corriendo en tu computadora y entiendas dónde están las cosas.

## Día 1: Configurando tu Entorno

### 1. Requisitos Previos
Asegúrate de tener instalado en tu computadora:
*   [Node.js](https://nodejs.org/en) (Usa la versión LTS recomendada).
*   Un editor de código (Recomendamos **Visual Studio Code**).
*   Un emulador de Android (Android Studio) o simulador de iOS (Xcode en Mac), o bien un dispositivo físico conectado por USB con la depuración USB activada.
*   **Nota importante:** Debido a que el proyecto incluye dependencias nativas personalizadas (como `react-native-webrtc` para la transmisión de video), la aplicación **no es compatible con la app estándar Expo Go**. Se requiere construir y ejecutar un cliente de desarrollo local.

### 2. Levantar el proyecto
Abre tu terminal, ve a la carpeta donde quieres guardar el proyecto y ejecuta:

```bash
# 1. Clona el proyecto (pide acceso si no lo tienes)
git clone <url-del-repo>
cd AliceGuardianApp

# 2. Instala las dependencias (librerías)
npm install

# 3. Compila y ejecuta en Android (requiere emulador abierto o celular por USB)
npm run android

# O si estás en Mac para iOS:
npm run ios
```

### 3. ¡Ver la magia!
Al ejecutar el comando de compilación nativa (`npm run android` o `npm run ios`), se abrirá el emulador, se compilará el código nativo (esto puede tardar unos minutos la primera vez) y se instalará el Cliente de Desarrollo de SIVI en tu dispositivo.

¡Felicidades! Ya deberías estar viendo la pantalla de inicio de sesión de Sivi.

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
