# SIVI Imperium — Especificación de API Gateway Móvil
## `https://orchestrator.guardian.imperium.pe/mobile/`

Este documento describe la especificación técnica de la API consumida por el cliente móvil. A diferencia de una REST API tradicional basada en verbos GET, la comunicación con el móvil se realiza a través de un **Gateway Consolidador** (Orquestador) mediante peticiones `POST` que aíslan y gestionan la multi-sesión de workspaces en el cuerpo del mensaje.

---

## Reglas Generales

- **Base URL:** `https://orchestrator.guardian.imperium.pe`
- **Método de Red:** Todas las peticiones al Gateway (excepto login) se realizan mediante **`POST`** con cabecera `Content-Type: application/json`.
- **Aislamiento de Datos (Multi-sesión):** El cuerpo de cada petición al Gateway debe incluir las credenciales resueltas del o los workspaces consultados:
  ```json
  {
    "sessions": [
      {
        "workspace": "nombre_workspace",
        "token": "token_especifico_del_workspace"
      }
    ],
    ...filtros
  }
  ```
- **Formato estándar de respuestas:**
  * Respuestas exitosas: `{ workspaces: [ { workspace: "id", ...datos } ] }` o `{ count, rows: [...] }` dependiendo del endpoint.
  * Respuestas de error: Mensaje plano con código HTTP apropiado (400, 401, 403, 404, 500).

---

## 1. 🔐 Autenticación Móvil Unificada

### POST `/mobile/auth/login`
Autentica al usuario en el sistema y retorna sus credenciales, roles y la lista de todos los workspaces a los que tiene acceso junto con sus respectivos tokens locales.

**Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Respuesta Exitosa (HTTP 200):**
```json
{
  "results": [
    {
      "workspace": "cmarket",
      "token": "token_lpr_alarms_workspace",
      "jwt": "eyJ...",
      "user": {
        "id": 15,
        "Username": "jorge_admin",
        "Email": "admin@cmarket.pe",
        "role": {
          "id": 1,
          "name": "Admin"
        }
      }
    }
  ]
}
```

---

## 2. 📊 Métricas y Dashboard

### POST `/mobile/workspaces/alerts/dashboard`
Obtiene las métricas agregadas operacionales para el dashboard móvil en un rango temporal específico.

**Body:**
```json
{
  "sessions": [ ... ],
  "timePreset": "custom | hoy | ayer | semana | 15dias | 30dias",
  "timezone": "America/Lima",
  "from": "ISO Date String",
  "to": "ISO Date String"
}
```

**Respuesta Exitosa:**
```json
{
  "workspaces": [
    {
      "workspace": "cmarket",
      "charts": {
        "totalAlerts": { "total": 90, "slices": [ { "key": "lpr", "value": 30 } ] },
        "attendedAlerts": { "total": 85 },
        "unresolvedAlerts": { "total": 5 },
        "effectiveOperationPercentage": { "total_alerts": 90, "attended_total": 85 },
        "classifiedAlerts": { "slices": [ { "key": "positive", "value": 60 } ] },
        "operatorActionTime": { "averageSeconds": 14760, "bestSeconds": 9360 }
      }
    }
  ]
}
```

---

## 3. 📷 Dispositivos / Cámaras

### POST `/mobile/workspaces/devices`
Retorna el listado de cámaras activas del workspace, incluyendo el estado RTSP.

**Body:**
```json
{
  "sessions": [ ... ]
}
```

**Respuesta Exitosa:**
```json
{
  "workspaces": [
    {
      "workspace": "cmarket",
      "devices": [
        {
          "id": 666,
          "name": "Bellavista_sala_de_reuniones_1",
          "deviceId": "0438dafd-e297-48a6-8066-057cbda92af4",
          "rtsp": "rtsp://63.141.255.156:8554/sala_de_reuniones_1",
          "type": "IP_CAM",
          "state": "active",
          "rtspStatus": {
            "primary": "online | offline | unknown",
            "secondary": "online | offline | unknown"
          },
          "recording": {
            "configured": true,
            "active": true
          }
        }
      ]
    }
  ]
}
```

---

## 4. 🚨 Historial de Eventos y Alertas

### POST `/mobile/workspaces/events`
Obtiene las alertas procesadas e imágenes de evidencia en base al rango de tiempo e instalacion.

**Body:**
```json
{
  "sessions": [ ... ],
  "eventType": "alert | smart_event",
  "from": "ISO Date String (from)",
  "to": "ISO Date String (to)",
  "timezone": "America/Lima",
  "page": 1,
  "limit": 30,
  "filters": {
    "deviceId": "string | null"
  }
}
```

**Respuesta: (Formato Paginado)**
```json
{
  "count": 100,
  "rows": [
    {
      "id": 1492,
      "tag": "lpr | face | intrusion | motion",
      "probability": "0.98",
      "url_evidence": "capturas/cmarket_evidencia.jpg",
      "face_detected_url": "rostros/cmarket_rostro.jpg",
      "createdAt": "2026-05-15T14:32:05.000Z",
      "is_confirmed": true,
      "is_fp": false,
      "state": "resolved",
      "vinfo": "{\"name\":\"Alarma 1\",\"schedule\":\"08:00 - 18:00\"}",
      "device": {
        "name": "Cámara Entrada"
      }
    }
  ]
}
```

---

## 5. ⚙️ Configuraciones de Reglas de Eventos

### POST `/mobile/workspaces/alarms/configurations`
Mapea las analíticas e inteligencia artificial configuradas en las cámaras del workspace.

**Body:**
```json
{
  "sessions": [ ... ],
  "page": 1,
  "limit": 100
}
```

**Respuesta Exitosa:**
```json
{
  "workspaces": [
    {
      "workspace": "cmarket",
      "configurations": {
        "count": 15,
        "rows": [
          {
            "id": 23,
            "name": "INGRESO_CASTAÑOS_Aforo",
            "state": true,
            "Detail_device_alarm": [ { "id": 1 } ],
            "Detail_rule_obj_alarm": [ { "tag": "person", "alertime": 2.0, "prob": 75 } ]
          }
        ]
      }
    }
  ]
}
```

---

### POST `/mobile/workspaces/alarms/configurations/detail`
Obtiene los detalles completos y las analíticas de una regla de alarma específica.

**Body:**
```json
{
  "sessions": [ ... ],
  "alarmId": 23
}
```

**Respuesta Exitosa:**
```json
{
  "workspaces": [
    {
      "workspace": "cmarket",
      "alarm": {
        "id": 23,
        "name": "INGRESO_CASTAÑOS_Aforo",
        "state": true,
        "sound": 1,
        "frequency": 3,
        "cooldown": 10,
        "Detail_device_alarm": [ ... ],
        "Detail_rule_obj_alarm": [ ... ],
        "Detail_rule_face__alarm": [ ... ],
        "Detail_rule_lpr__alarm": [ ... ],
        "Detail_rule_action_alarm": [ ... ],
        "actions": [
          {
            "id": 12,
            "issound": true,
            "isalert": true,
            "ismodal": true,
            "manual_confirmation": false,
            "timeout": 30,
            "iswhatsapp": false,
            "isemail": false,
            "notifiable": true
          }
        ],
        "roi": [
          {
            "id": 4,
            "state": true,
            "points": "[[0.25,0.25],[0.75,0.25],[0.75,0.75],[0.25,0.75]]"
          }
        ]
      }
    }
  ]
}
```

---

### POST `/mobile/workspaces/alarms/configurations/update`
Actualiza el estado general, sonido, frecuencia, y las acciones de una configuración de alarma.

**Body:**
```json
{
  "sessions": [ ... ],
  "alarmId": 23,
  "alarm": {
    "state": true,
    "sound": 1,
    "frequency": 3
  },
  "action": {
    "id": 12,
    "issound": true,
    "isalert": true,
    "ismodal": true,
    "manual_confirmation": false,
    "timeout": 30
  }
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Configuración de alarma actualizada con éxito"
}
```

---

### POST `/mobile/workspaces/alarms/configurations/polygons/update`
Actualiza las coordenadas de la Región de Interés (ROI) de los polígonos asociados a la alarma.

**Body:**
```json
{
  "sessions": [ ... ],
  "polygons": [
    {
      "roiId": 4,
      "state": true,
      "points": "[[0.2,0.2],[0.8,0.2],[0.8,0.8],[0.2,0.8]]"
    }
  ]
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Polígonos de ROI actualizados con éxito"
}
```


---

## 6. 🔍 Búsqueda Forense Inteligente

### POST `/mobile/workspaces/search`
Realiza filtros avanzados en todas las colecciones de metadatos (Placas, Rostros, Objetos).

**Body:**
```json
{
  "sessions": [ ... ],
  "tag": "face | lpr | object | intrusion",
  "timePreset": "custom",
  "from": "ISO Date String",
  "to": "ISO Date String",
  "deviceId": "string | null",
  "page": 1,
  "limit": 30
}
```

**Respuesta:** mismo formato estandar con `rows`.

---

## 7. 🚨 Acciones de Gestión y Clasificación de Seguridad

### POST `/mobile/workspaces/events/classification`
Clasifica una alerta recibida (Confirmada, Falso Positivo o Ignorada).

**Body:**
```json
{
  "sessions": [ ... ],
  "eventType": "alert",
  "eventId": 1492,
  "classification": "confirm | false_positive | ignore"
}
```

### POST `/mobile/workspaces/events/description`
Agrega una nota visual/minuta sobre el incidente.

**Body:**
```json
{
  "sessions": [ ... ],
  "eventId": 1492,
  "incidentId": 23091,
  "name": "Manual Confirmation",
  "description": "El operador observó ingreso autorizado por portón principal."
}
```

