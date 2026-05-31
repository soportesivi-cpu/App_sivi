# Runbook y Troubleshooting (Solución de Problemas)

El desarrollo en React Native y Expo puede tener pequeños inconvenientes técnicos (caché sucia, módulos no encontrados, etc). 
Si tienes un error que no entiendes, **antes de buscar en Google o preguntar al equipo, intenta estos pasos solucionadores universales:**

## Problema 1: "Module not found" o errores extraños de importación
A veces instalas una librería nueva (`npm install algo`) pero la aplicación dice que no existe.

**Solución rápida (Limpiar la caché de Expo):**
1. Detén el servidor en la terminal (Ctrl + C).
2. Vuelve a iniciarlo usando la bandera `-c` (clear):
```bash
npm start -c
```

## Problema 2: El simulador/celular se quedó congelado en una pantalla blanca
A veces el código tiene un ciclo infinito o un error grave en la renderización que traba el dispositivo.

**Solución:**
1. En la terminal donde corre Expo, presiona la letra `r` (Recargar).
2. Si no funciona, agita físicamente tu celular (o presiona Cmd+D / Ctrl+M en el simulador) y selecciona "Reload".

## Problema 3: "Error de Dependencias" o nada compila después de un `git pull`
Cuando un compañero añade nuevas librerías y tú descargas sus cambios, tu computadora no tiene esas librerías instaladas aún.

**Solución (El botón nuclear):**
Borra la carpeta de dependencias y reinstala todo desde cero.
```bash
# Si estás en Windows:
rmdir /s /q node_modules
# Si estás en Mac/Linux:
rm -rf node_modules

# Luego, vuelve a instalar
npm install
```

## Problema 4: Problemas de conexión con la API
La app dice "Network Request Failed" pero tu internet funciona bien.

**Posibles causas:**
1.  **Dominio Incorrecto:** Asegúrate de que el dominio asignado en tu `SecureStore` (o el que está por defecto en `constants/config.ts` -> `control.guardian.imperium.pe`) esté encendido y respondiendo.
2.  **CORS:** Si estás probando la app en Web (`npm run web`), es posible que el servidor rechace tu petición por seguridad. Trata de probar en un celular físico o emulador.

## Problema 5: Error al intentar crear un Build (APK / AAB)
Si el comando `eas build` falla, normalmente el error detallado está al final de los logs en la plataforma web de Expo. 
Asegúrate de que tus credenciales (como los archivos `.jks` que tienes en la raíz del proyecto) no hayan expirado y las contraseñas en Expo estén correctas.
