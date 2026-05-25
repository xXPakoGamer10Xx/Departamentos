# 🏠 NethRent — Sistema de Gestión Inteligente de Arrendamientos

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

**NethRent** es una solución integral y moderna diseñada para la administración y automatización de departamentos en alquiler, cobro de rentas, gestión de contratos, control de incidencias (tickets) y comunicación fluida entre el arrendador y los inquilinos. 

El sistema está optimizado para funcionar tanto en dispositivos móviles (Android/iOS) como en navegadores web de escritorio, ofreciendo una experiencia responsiva, fluida y en tiempo real.

---

## 📌 Índice de Contenidos
1. [✨ Características Principales](#-características-principales)
2. [⚙️ Arquitectura y Tecnologías](#️-arquitectura-y-tecnologías)
3. [📁 Estructura del Proyecto](#-estructura-del-proyecto)
4. [🚀 Despliegue en Producción (VPS)](#-despliegue-en-producción-vps)
5. [💻 Configuración para Desarrollo Local](#-configuración-para-desarrollo-local)
6. [🔐 Variables de Entorno](#-variables-de-entorno)
7. [👥 Credenciales de Prueba (Seed)](#-credenciales-de-prueba-seed)
8. [💾 Copias de Seguridad (Backups)](#-copias-de-seguridad-backups)
9. [🔌 API Endpoints](#-api-endpoints)

---

## ✨ Características Principales

### 👨‍💼 Módulo de Administración (Arrendador)
- **Control General**: Visualización de estadísticas financieras en tiempo real, ocupación y alertas de atrasos.
- **Gestión de Inquilinos**: Filtros avanzados de búsqueda, registro, edición e historial completo de pagos.
- **Generación de Contratos**: Creación digitalizada de contratos listos para descargar en formato PDF estructurado.
- **Auditoría Interna**: Registro transparente de actividades críticas dentro del sistema.

### 👥 Módulo del Inquilino (Multiplataforma)
- **Diseño Adaptativo Premium**: Panel web con vista en rejilla de doble columna (desktop) y diseño optimizado a una columna en dispositivos móviles.
- **Estado de Cuenta**: Desglose automático de cargos pendientes (renta del mes + cuotas o servicios extra).
- **Recibos de Pago QR**: Descarga de códigos QR únicos y comprobantes oficiales para agilizar los pagos.
- **Sistema de Incidencias (Tickets)**: Reporte y seguimiento interactivo de fallos, reparaciones o solicitudes de soporte con estados de progreso.

### 🔔 Notificaciones Inteligentes y en Tiempo Real
- **Canal Web (SSE)**: Conexión mediante Server-Sent Events (SSE) para alertas instantáneas sin recargar la página.
- **Canal Móvil (Push)**: Integración con Expo Push Notifications para recordar fechas límite de pago directamente en el celular del inquilino.

---

## ⚙️ Arquitectura y Tecnologías

El sistema utiliza una arquitectura desacoplada y modular diseñada para la escalabilidad:

- **Frontend (Multiplataforma)**: React Native con Expo Router. Un solo código base genera aplicaciones nativas de alto rendimiento para Android, iOS y la plataforma Web.
- **Backend (API REST)**: Express con TypeScript. Arquitectura por capas (Rutas, Controladores, Middlewares, Utilidades y Configuración de DB).
- **Base de Datos**: PostgreSQL para almacenamiento relacional robusto con integridad referencial.
- **Infraestructura**: Orquestación nativa mediante Docker Compose para garantizar consistencia entre desarrollo y producción.

---

## 📁 Estructura del Proyecto

```text
Departamentos/
├── frontend/               # Frontend Multiplataforma (React Native + Expo)
│   ├── app/                # Enrutamiento basado en archivos (Expo Router)
│   ├── components/         # Componentes visuales UI/UX responsivos
│   └── package.json        # Dependencias del cliente
├── backend/                # Backend API REST (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── config/         # Base de datos, tareas cron, migraciones y seed
│   │   ├── controllers/    # Controladores de lógica de negocio
│   │   ├── middleware/     # Auth JWT, manejo de errores y logs de auditoría
│   │   ├── routes/         # Definición de endpoints de la API
│   │   └── utils/          # Utilidades comunes (PDF, fechas, formato)
│   ├── Dockerfile          # Empaquetado Docker del backend
│   └── package.json        # Dependencias del servidor
├── backups/                # Directorio automático para copias de seguridad (.sql)
├── docker-compose.yml      # Definición de servicios para producción (API + DB)
├── dev.sh                  # Script interactivo de desarrollo local
└── start.sh                # Script autogestionado de arranque en producción
```

---

## 🚀 Despliegue en Producción (VPS)

> [!IMPORTANT]
> El sistema incluye un script automatizado (`start.sh`) que realiza todo el proceso de orquestación, verificación de dependencias, migración y configuración inicial por ti.

### Requisitos Previos
Tener instalados **Docker** y **Docker Compose** en tu servidor.

### Pasos para Arrancar el Sistema:

1. **Clona el repositorio** en tu servidor VPS:
   ```bash
   git clone https://github.com/xXPakoGamer10Xx/Departamentos.git
   cd Departamentos
   ```

2. **Ejecuta el script de inicio en producción**:
   ```bash
   bash start.sh
   ```

### ¿Qué hace `start.sh` por ti de manera automática?
- **Comprobación de Herramientas**: Verifica que Docker y Docker Compose estén activos en el host.
- **Gestión de Variables**: Si no existe el archivo `.env` en la raíz, lo genera automáticamente a partir de la plantilla y solicita los ajustes necesarios de producción de manera segura.
- **Aislamiento de Puertos (Seguridad)**: Configura la base de datos PostgreSQL en una red interna privada. El puerto `5432` no se expone a internet, evitando ataques externos de fuerza bruta.
- **Construcción y Despliegue**: Levanta los contenedores en segundo plano (`db` y `backend`).
- **Migraciones e Inicialización**: Ejecuta las migraciones de base de datos para estructurar las tablas e inserta los datos semilla iniciales (`seed`) sin necesidad de configuraciones manuales.

---

## 💻 Configuración para Desarrollo Local

Para trabajar localmente sin interferir con producción, el sistema cuenta con el script autogestionado `dev.sh`.

### Pasos para iniciar en local:

1. Asegúrate de tener Node.js instalado en tu máquina local.
2. Inicia el entorno de desarrollo ejecutando:
   ```bash
   bash dev.sh
   ```

### ¿Qué realiza `dev.sh`?
- Levanta únicamente la base de datos PostgreSQL local dentro de un contenedor Docker para no saturar de dependencias locales tu sistema.
- Inicia el servidor backend en modo "Hot Reload" mediante `ts-node-dev` en el puerto `3001`.
- Ejecuta las migraciones locales en la base de datos.
- Lanza el servidor de desarrollo de Expo para que puedas abrir el frontend en tu navegador, simulador o en la app móvil Expo Go usando el código QR generado.

---

## 🔐 Variables de Entorno

El archivo `.env` se ubica en la raíz del proyecto. A continuación se listan las variables necesarias:

| Variable | Tipo / Valor por defecto | Descripción |
|----------|--------------------------|-------------|
| `NODE_ENV` | `development` \| `production` | Entorno de ejecución de la aplicación. |
| `PORT` | `3001` | Puerto en el que escucha el servidor backend. |
| `TZ` | `America/Mexico_City` | Zona horaria del servidor para consistencia en fechas de pago. |
| `DB_HOST` | `db` | Host de conexión a la base de datos. |
| `DB_PORT` | `5432` | Puerto interno de PostgreSQL. |
| `DB_NAME` | `departamentos` | Nombre de la base de datos. |
| `DB_USER` | `depas_user` | Nombre de usuario de la base de datos. |
| `DB_PASSWORD` | *Generado en arranque* | Contraseña de conexión a PostgreSQL. |
| `JWT_SECRET` | *Generado en arranque* | Secreto criptográfico de firma para tokens JWT de sesión. |
| `JWT_EXPIRES_IN` | `7d` | Duración de validez de la sesión del usuario. |
| `BACKUP_CRON` | `0 4 * * *` | Formato cron de ejecución automática para respaldos diarios. |
| `ARRENDADOR_NOMBRE`| `Alba Eunice Armijo Ogazon` | Nombre predeterminado de arrendador para contratos PDF. |

---

## 👥 Credenciales de Prueba (Seed)

Al iniciar el sistema por primera vez, el cargador de datos iniciales inserta los siguientes usuarios de pruebas:

### 👤 Administrador (Arrendador)
- **Correo Electrónico**: `admin@departamentos.local`
- **Contraseña**: `Admin2024!`

### 🏠 Inquilino de Prueba (Depto 1)
- **Nombre**: Valeria Irene Ortiz
- **Correo Electrónico**: `inquilino@departamentos.local`
- **Contraseña**: `Inquilino2024!`

> [!WARNING]
> Recuerda cambiar estas contraseñas en tu primer inicio de sesión para asegurar el control de tu información.

---

## 💾 Copias de Seguridad (Backups)

El sistema incluye una tarea programada interna (`cron`) que crea respaldos automáticos de la base de datos de manera periódica.

- **Frecuencia**: Todos los días a las **4:00 AM (Hora de la CDMX)**.
- **Ubicación**: Carpeta `./backups/` en la raíz del proyecto.
- **Retención**: Los backups antiguos se eliminan automáticamente tras 30 días para optimizar espacio.

### Ejecución de Copia Manual
Puedes generar copias de seguridad de forma instantánea de dos maneras:
1. **Desde la App**: Menú `Configuración` ➡️ `Backups` ➡️ `Crear copia ahora`.
2. **Vía API REST**:
   ```bash
   curl -X POST http://localhost:3001/api/backups/manual \
     -H "Authorization: Bearer TU_TOKEN_DE_SESION"
   ```

---

## 🔌 API Endpoints

A continuación se detallan los endpoints principales expuestos por el backend:

### 🔑 Autenticación y Cuentas
- `POST /api/auth/login` - Iniciar sesión y obtener token JWT.
- `GET /api/auth/me` - Obtener información del usuario en sesión.
- `GET /api/usuarios` - Listar cuentas registradas en el sistema.

### 👤 Inquilinos y Departamentos
- `GET /api/inquilinos` - Listar inquilinos con soporte de búsqueda y paginación.
- `POST /api/inquilinos` - Crear un nuevo registro de inquilino.
- `PUT /api/inquilinos/:id` - Actualizar información detallada del inquilino.
- `DELETE /api/inquilinos/:id` - Dar de baja un inquilino del sistema.
- `GET /api/departamentos` - Consultar inventario y estado de departamentos.
- `GET /api/departamentos/stats` - Obtener métricas rápidas de ocupación e ingresos.

### 💳 Finanzas, Pagos e Incidencias
- `GET /api/pagos` - Listar historial completo de transacciones realizadas.
- `POST /api/pagos` - Registrar un nuevo cobro o pago de mensualidad.
- `GET /api/cuotas` - Listar cargos extraordinarios y servicios adicionales.
- `POST /api/cuotas` - Asignar una nueva cuota a un inquilino.
- `GET /api/tickets` - Listar reportes de mantenimiento activos y cerrados.
- `POST /api/tickets` - Crear reporte de incidencia (por inquilino o admin).

### 🔔 Notificaciones, Sistema y Copias de Seguridad
- `GET /api/events` - Canal en tiempo real (Server-Sent Events) para recibir notificaciones inmediatas.
- `GET /api/notificaciones` - Historial de notificaciones del usuario logueado.
- `POST /api/push/register` - Guardar token para notificaciones push en móviles.
- `GET /api/backups` - Listar archivos de respaldo disponibles en disco.
- `POST /api/backups/manual` - Forzar la generación de una copia de seguridad.
- `GET /api/config` - Consultar variables editables del arrendador.
- `PUT /api/config` - Modificar datos de contacto y datos fiscales del arrendador.

---

Desarrollado con dedicación y enfoque profesional para simplificar la gestión diaria de departamentos. 🏢
