# AliceGuardian — Especificación API Móvil
## `https://control.guardian.imperium.pe/api/v1/mobile/`

Documento para el equipo de backend. Todos los endpoints que la app móvil necesita.

---

## Reglas Generales

- **Base URL:** `https://control.guardian.imperium.pe/api/v1/mobile/`
- **Auth:** Header `Authorization: Bearer {jwt}` en todos los endpoints (excepto login)
- **Formato listas:** Siempre `{ count, page, pages, limit, rows: [...] }`
- **Formato error:** `{ error: "mensaje" }` con código HTTP apropiado (401, 403, 404, 500)

---

## 1. 🔐 Autenticación

### POST `/api/v1/auth/login`
> *(Este ya existe y funciona — no cambiar)*

**Body:**
```json
{ "email": "string", "password": "string" }
```
**Respuesta:**
```json
{
  "jwt": "eyJ...",
  "user": {
    "id": "string",
    "name": "string",
    "email": "string",
    "avatar_url": "string | null",
    "role": { "name": "SuperAdmin | Admin | Operator" }
  }
}
```

---

## 2. 📊 Dashboard

### GET `/api/v1/mobile/dashboard`

**Query params opcionales:**
- `?manager_id=UUID` — filtrar por instalación específica (para SuperAdmin)

**Respuesta esperada:**
```json
{
  "summary": {
    "cameras": { "on": 10, "off": 2 },
    "storage":  { "percent": 75, "days": 15 }
  },
  "alerts24h": {
    "face":      45,
    "lpr":       30,
    "object":    12,
    "intrusion":  3
  },
  "metrics": {
    "total":      90,
    "resolved":   85,
    "unresolved":  5,
    "effective":  "94.4%"
  },
  "recentAlerts": [
    {
      "id":      "string",
      "title":   "Intrusión Perímetro Sur",
      "time":    "14:32:05",
      "camera":  "CAM-EXT-04",
      "percent": "98%",
      "type":    "error | primary | secondary | tertiary",
      "icon":    "walk-outline",
      "img":     "https://... | null"
    }
  ]
}
```

---

## 3. 📷 Dispositivos / Cámaras

### GET `/api/v1/mobile/devices`

**Query params:**
- `?page=1`
- `?manager_id=UUID` — filtrar por instalación

**Respuesta:**
```json
{
  "count": 10,
  "page": 1,
  "pages": 1,
  "limit": 30,
  "rows": [
    {
      "id":         666,
      "name":       "Bellavista_sala_de_reuniones_1",
      "deviceId":   "0438dafd-e297-48a6-8066-057cbda92af4",
      "stream_name":"sala_de_reuniones_1-0438dafd-e297-48a6-8066-057cbda92af4",
      "rtsp":       "rtsp://control.sivi.imperium.pe:8554/sala_de_reuniones_1-0438dafd-...",
      "manager_id": "UUID",
      "type":       "IP_CAM",
      "state":      "active | inactive",
      "hasMotion":  false,
      "latitude":   null,
      "longitude":  null
    }
  ]
}
```

> ⚠️ **Campo crítico:** `stream_name` debe venir poblado siempre.
> La app lo necesita para construir las URLs de video:
> - HLS:  `https://control.sivi.imperium.pe:8888/{stream_name}/index.m3u8`
> - WHEP: `https://control.sivi.imperium.pe:8889/{stream_name}/whep`

---

## 4. 🚨 Alertas

### GET `/api/v1/mobile/alerts`

**Query params:**
- `?page=1`
- `?manager_id=UUID`
- `?type=face|lpr|object|intrusion` — filtro por tipo
- `?device_id=UUID` — filtro por cámara

**Respuesta:**
```json
{
  "count": 100,
  "page": 1,
  "pages": 4,
  "limit": 30,
  "rows": [
    {
      "id":        "string",
      "type":      "face | lpr | object | intrusion | motion",
      "title":     "Rostro Detectado",
      "probability": 0.98,
      "createdAt": "2026-05-15T14:32:05.000Z",
      "image_url": "https://... | null",
      "deviceId":  "UUID",
      "device": {
        "name":    "Cámara Entrada",
        "manager_id": "UUID"
      }
    }
  ]
}
```

---

## 5. 👤 Rostros (Face Recognition)

### GET `/api/v1/mobile/faces`

**Query params:**
- `?page=1`
- `?manager_id=UUID`
- `?device_id=UUID`

**Respuesta:**
```json
{
  "count": 50,
  "page": 1,
  "pages": 2,
  "limit": 30,
  "rows": [
    {
      "id":          "string",
      "probability": 0.97,
      "label":       "Autorizado | Desconocido | string",
      "image_url":   "https://...",
      "createdAt":   "2026-05-15T14:32:05.000Z",
      "deviceId":    "UUID",
      "device":      { "name": "string" }
    }
  ]
}
```

---

## 6. 🚗 LPR (Placas)

### GET `/api/v1/mobile/lpr`

**Query params:**
- `?page=1`
- `?manager_id=UUID`

**Respuesta:**
```json
{
  "count": 30,
  "page": 1,
  "pages": 1,
  "limit": 30,
  "rows": [
    {
      "id":        "string",
      "plate":     "ABC-123",
      "authorized": true,
      "image_url": "https://...",
      "createdAt": "2026-05-15T14:32:05.000Z",
      "deviceId":  "UUID",
      "device":    { "name": "string" }
    }
  ]
}
```

---

## 7. 🏢 Workspaces (para SuperAdmin)

### GET `/api/v1/mobile/workspaces`

> *(Equivalente a `/api/v1/workspace` pero con más info)*

**Respuesta:**
```json
{
  "count": 10,
  "page": 1,
  "pages": 1,
  "limit": 30,
  "rows": [
    {
      "id":          1,
      "name":        "Bellavista",
      "manager_id":  "UUID",
      "computer":    "sivi-server-01",
      "state":       "active | inactive",
      "type":        "manager | local",
      "cameras_count": 12,
      "users_count":   5,
      "plan":        "PRO | LITE | ENT",
      "createdAt":   "2026-05-15T00:00:00.000Z"
    }
  ]
}
```

> ⚠️ **Campos nuevos necesarios:** `cameras_count`, `users_count`, `plan`
> La pantalla SuperAdmin los muestra como "Cámaras: 128", "Usuarios: 45".

---

## 8. 🔍 Búsqueda Forense

### GET `/api/v1/mobile/search`

**Query params (todos opcionales, al menos uno requerido):**
- `?type=face|lpr|object|motion`
- `?date_from=2026-05-15T00:00:00`
- `?date_to=2026-05-15T23:59:59`
- `?device_id=UUID`
- `?manager_id=UUID`
- `?page=1`

**Respuesta:** mismo formato estándar con `rows`.

---

## 9. 📈 Estadísticas en Vivo

### GET `/api/v1/mobile/stats`

**Query params:**
- `?manager_id=UUID`
- `?range=24h|7d|30d`

**Respuesta:**
```json
{
  "range": "24h",
  "data": [
    { "hour": "00:00", "face": 5, "lpr": 3, "object": 1 },
    { "hour": "01:00", "face": 2, "lpr": 1, "object": 0 }
  ]
}
```

---

## Resumen de Endpoints

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/v1/auth/login` | Login (ya existe) |
| GET | `/api/v1/mobile/dashboard` | Dashboard con resumen |
| GET | `/api/v1/mobile/devices` | Lista de cámaras |
| GET | `/api/v1/mobile/alerts` | Historial de alertas |
| GET | `/api/v1/mobile/faces` | Detecciones de rostros |
| GET | `/api/v1/mobile/lpr` | Lecturas de placas |
| GET | `/api/v1/mobile/workspaces` | Lista de instalaciones (SuperAdmin) |
| GET | `/api/v1/mobile/search` | Búsqueda forense |
| GET | `/api/v1/mobile/stats` | Estadísticas por rango |
