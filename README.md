# Admin Depas — Gestión de Contratos de Arrendamiento

Sistema web/móvil para gestionar contratos, inquilinos y departamentos.

## Estructura del Proyecto

```
Departamentos/
├── frontend/          # React Native + Expo (iOS, Android, Web)
├── backend/           # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/    # DB, backup cron, migraciones, seed
│   │   ├── controllers/
│   │   ├── middleware/ # Auth JWT, auditoría, error handler
│   │   ├── routes/
│   │   └── utils/     # Formateadores de texto
│   └── Dockerfile
├── docker-compose.yml
├── dev.sh             # Desarrollo local
├── start.sh           # Producción en VPS
└── backups/           # Backups automáticos diarios
```

## Inicio Rápido

### Desarrollo Local

```bash
./dev.sh
```

### Producción (VPS con Docker)

```bash
./start.sh
```

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/auth/me` | Perfil del usuario actual |
| GET | `/api/inquilinos` | Listar inquilinos (búsqueda, filtros) |
| POST | `/api/inquilinos` | Crear inquilino |
| PUT | `/api/inquilinos/:id` | Actualizar inquilino |
| DELETE | `/api/inquilinos/:id` | Eliminar inquilino |
| GET | `/api/departamentos` | Listar departamentos |
| GET | `/api/departamentos/stats` | Estadísticas generales |
| GET | `/api/backups` | Listar backups |
| POST | `/api/backups/manual` | Crear backup manual |
| GET | `/api/config` | Obtener configuración |
| PUT | `/api/config` | Actualizar configuración |

## Credenciales Iniciales (cambiar al primer uso)

- **Email:** `admin@departamentos.local`
- **Contraseña:** `Admin2024!`

## Backup Automático

Se ejecuta **todos los días a las 4:00 AM (Hora CDMX)**.
Los backups se guardan en `./backups/` y se conservan por 30 días.

Para backup manual:
```bash
# Desde la app: Configuración → Backups → Crear Backup
# O desde la API:
curl -X POST http://localhost:3001/api/backups/manual \
  -H "Authorization: Bearer TU_TOKEN"
```
