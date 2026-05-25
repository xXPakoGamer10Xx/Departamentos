#!/bin/bash
# start.sh - Script para entorno de PRODUCCIÓN en tu VPS (con Docker)
# Requiere: docker y docker compose instalados en el VPS
# Este script se encarga de TODA la configuración automáticamente.

set -e

echo "╔══════════════════════════════════════════════╗"
echo "║  🏠 Admin Depas — Iniciar en Producción      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── Verificar docker ───────────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo "❌ Docker no está instalado."
  echo "   Instálalo con: curl -fsSL https://get.docker.com | bash"
  exit 1
fi
echo "✅ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"

# Verificar docker compose (v2)
if ! docker compose version &> /dev/null; then
  echo "❌ Docker Compose v2 no está disponible."
  echo "   Asegúrate de tener Docker Engine >= 20.10"
  exit 1
fi
echo "✅ Docker Compose $(docker compose version --short)"
echo ""

# ─── Generar .env automáticamente si no existe ─────────────────────────────
if [ ! -f ".env" ]; then
  echo "⚙️  Archivo .env no encontrado. Generando configuración automática..."

  # Generar secretos seguros automáticamente
  JWT_SECRET=$(openssl rand -hex 48 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
  DB_PASSWORD=$(openssl rand -hex 16 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 24 | head -n 1)

  cat > .env <<EOF
# Generado automáticamente por start.sh — $(date)

# Server
NODE_ENV=production
PORT=3001
TZ=America/Mexico_City

# Database
DB_HOST=db
DB_PORT=5432
DB_NAME=departamentos
DB_USER=depas_user
DB_PASSWORD=${DB_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# Backup
BACKUP_DIR=/app/backups
BACKUP_CRON=0 4 * * *

# Arrendador (configurable desde la app)
ARRENDADOR_NOMBRE=Alba Eunice Armijo Ogazon
ARRENDADOR_DIRECCION=Callejón Zaragoza s/n, San Juan Chiautla, C.P. 56030
EOF

  echo "✅ Archivo .env generado con credenciales seguras automáticamente"
  echo ""
  echo "   🔑 JWT_SECRET  → (64 caracteres aleatorios)"
  echo "   🔑 DB_PASSWORD → ${DB_PASSWORD}"
  echo ""
  echo "   ℹ️  Guarda estas credenciales en un lugar seguro."
  echo "   ℹ️  El archivo .env está en la raíz del proyecto."
  echo ""
else
  echo "✅ Archivo .env encontrado"
  echo ""
fi

# Cargar variables del .env para usarlas en el healthcheck
set -a
# shellcheck disable=SC1091
source .env
set +a

# ─── Crear directorio de backups ────────────────────────────────────────────
mkdir -p backups
echo "✅ Directorio de backups listo"

# ─── Construir imagen del backend ───────────────────────────────────────────
echo ""
echo "🔨 Construyendo imagen del backend..."
docker compose build backend

# ─── Levantar servicios ─────────────────────────────────────────────────────
echo ""
echo "🚀 Levantando servicios (PostgreSQL + Backend)..."
docker compose up -d db backend

# ─── Esperar a que PostgreSQL esté completamente listo ──────────────────────
echo ""
echo "⏳ Esperando que PostgreSQL esté completamente listo..."
RETRIES=30
COUNT=0
until docker compose exec -T db pg_isready -U "${DB_USER:-depas_user}" -d "${DB_NAME:-departamentos}" &> /dev/null; do
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -ge "$RETRIES" ]; then
    echo ""
    echo "❌ La base de datos no respondió después de $RETRIES intentos."
    echo "   Revisa los logs: docker compose logs db"
    exit 1
  fi
  printf "   ... esperando (%d/%d)\r" "$COUNT" "$RETRIES"
  sleep 3
done
echo "✅ PostgreSQL listo                    "

# ─── Ejecutar migraciones ───────────────────────────────────────────────────
echo ""
echo "🔄 Ejecutando migraciones de base de datos..."
docker compose --profile tools run --rm migrate
echo "✅ Migraciones completadas"

# ─── Ejecutar seed (solo si es la primera vez — usa ON CONFLICT DO NOTHING) ─
echo ""
echo "🌱 Ejecutando seed de datos iniciales..."
docker compose --profile tools run --rm seed
echo "✅ Seed completado"

# ─── Verificar que el backend responde ──────────────────────────────────────
echo ""
echo "🔍 Verificando que el backend responde..."
HEALTH_RETRIES=15
HEALTH_COUNT=0
until curl -sf http://localhost:3001/health &> /dev/null; do
  HEALTH_COUNT=$((HEALTH_COUNT + 1))
  if [ "$HEALTH_COUNT" -ge "$HEALTH_RETRIES" ]; then
    echo "⚠️  El backend aún no responde en /health. Revisa los logs:"
    echo "   docker compose logs backend"
    break
  fi
  printf "   ... verificando (%d/%d)\r" "$HEALTH_COUNT" "$HEALTH_RETRIES"
  sleep 2
done

if curl -sf http://localhost:3001/health &> /dev/null; then
  echo "✅ Backend respondiendo correctamente"
fi

# ─── Resumen final ──────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        ✅  Sistema en producción listo        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "   📡 API:    http://localhost:3001"
echo "   💓 Health: http://localhost:3001/health"
echo ""
echo "📋 Credenciales de acceso a la app:"
echo "   Admin Email:      admin@departamentos.local"
echo "   Admin Contraseña: Admin2024!"
echo "   ⚠️  Cambia la contraseña al primer inicio de sesión"
echo ""
echo "Comandos útiles:"
echo "  Ver logs del backend:   docker compose logs -f backend"
echo "  Ver logs de la DB:      docker compose logs -f db"
echo "  Detener todo:           docker compose down"
echo "  Reiniciar backend:      docker compose restart backend"
echo "  Backup manual:          docker compose exec backend node dist/config/backup.js"
echo "  Abrir shell en backend: docker compose exec backend sh"
