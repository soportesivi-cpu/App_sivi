# Módulos y Organización de Archivos

Para que un nuevo programador no se pierda, este diagrama explica de forma muy visual para qué sirve cada carpeta del proyecto.

```mermaid
graph TD
    %% Estilos simples
    classDef carpeta fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef archivo fill:#fff9c4,stroke:#fbc02d,stroke-width:1px;
    classDef funcion fill:#e8f5e9,stroke:#2e7d32,stroke-width:1px;

    Raiz(fa:fa-folder / AliceGuardianApp) ::: carpeta
    
    %% Capa Visual
    AppFolder(fa:fa-folder app/) ::: carpeta
    AppFolder --> AuthRoute(fa:fa-file-code auth/) ::: archivo
    AppFolder --> TabsRoute(fa:fa-file-code tabs/ - Dashboard) ::: archivo
    AppFolder --> AdminRoute(fa:fa-file-code admin/ - SuperAdmin) ::: archivo
    AppFolder --> Index(fa:fa-file-code index.tsx - Rutero Principal) ::: archivo

    %% Capa Lógica
    ServicesFolder(fa:fa-folder services/) ::: carpeta
    ServicesFolder --> Api(fa:fa-file-code api.ts - Conexión al Backend) ::: archivo
    ServicesFolder --> Store(fa:fa-file-code store.ts - Memoria Zustand) ::: archivo
    ServicesFolder --> WebSockets(fa:fa-file-code websocket.ts - Tiempo Real) ::: archivo

    %% Capa de Constantes
    ConstantsFolder(fa:fa-folder constants/) ::: carpeta
    ConstantsFolder --> Config(fa:fa-file-code config.ts - Dominios/URLs) ::: archivo

    %% Relaciones Principales
    Raiz --> AppFolder
    Raiz --> ServicesFolder
    Raiz --> ConstantsFolder

    %% Como se hablan entre ellos
    AuthRoute -.->|Llama a| Api
    AuthRoute -.->|Guarda en| Store
    TabsRoute -.->|Llama a| Api
    Index -.->|Lee estado de| Store
```

### Regla de Oro (Muy fácil de entender):
1. **Nada de lógica pesada en `app/`:** Las pantallas solo deben preocuparse por mostrar botones y textos bonitos.
2. **Las peticiones van en `services/api.ts`:** Si necesitas llamar a la base de datos externa, hazlo desde ahí.
3. **Los datos que se comparten van en `services/store.ts`:** Si la pantalla A y la pantalla B necesitan saber qué cámara está seleccionada, guárdalo en Zustand (`store.ts`).
