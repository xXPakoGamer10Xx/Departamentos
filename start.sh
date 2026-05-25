#!/bin/bash
# start.sh - Script para entorno de PRODUCCIÓN en tu VPS (con Docker)
# Requiere: docker y docker compose instalados en el VPS

set -e

echo "╔══════════════════════════════════════════════╗"
echo "║  🏠 Admin Depas — Iniciar en Producción      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Verificar docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker no está instalado."
  echo "   Instálalo con: curl -fsSL https://get.docker.com | bash"
  exit 1
fi
echo "✅ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"

# Verificar docker compose (v2)
if ! docker compose version &> /dev/null; then
  echo "❌ Docker Compose v2 no está disponible."
  echo "   Asegúrate de tener Docker Engine >= 20.10 o instala el plugin:"
  echo "   https://docs.docker.com/compose/install/"
  exit 1
fi
echo "✅ Docker Compose $(docker compose version --short)"

echo ""

# ─── Verificar archivo .env ─────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  echo "⚠️  Archivo .env no encontrado. Creando uno desde backend/.env.example..."
  if [ -f "backend/.env.example" ]; then
    cp backend/.env.example .env
    echo ""
    echo "📝 IMPORTANTE: Edita el archivo .env con tus datos de producción:"
    echo "   nano .env"
    echo ""
    echo "   Variables críticas que DEBES cambiar:"
    echo "   - JWT_SECRET     (usa una cadena larga y aleatoria)"
    echo "   - DB_PASSWORD    (contraseña segura para la base de datos)"
    echo "   - NODE_ENV       (cambia a 'production')"
    echo ""
    exit 1
  else
    echo "❌ No se encontró backend/.env.example"
    exit 1
  fi
fi
echo "✅ Archivo .env encontrado"

# Crear directorio de backups si no existe
mkdir -p backups
echo "✅ Directorio de backups listo"

echo ""
echo "🔨 Construyendo imagen del backend..."
docker compose build backend

echo ""
echo "🚀 Levantando servicios (PostgreSQL + Backend)..."
docker compose up -d db backend

echo ""
echo "⏳ Esperando que PostgreSQL esté completamente listo..."
RETRIES=20
COUNT=0
until docker compose exec db pg_isready -U "${DB_USER:-depas_user}" -d "${DB_NAME:-departamentos}" &> /dev/null; do
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -ge "$RETRIES" ]; then
    echo "❌ La base de datos no respondió después de $RETRIES intentos."
    echo "   Revisa los logs: docker compose logs db"
    exit 1
  fi
  echo "   ... intento $COUNT/$RETRIES"
  sleep 3
done
echo "✅ PostgreSQL listo"

echo ""
echo "🔄 Ejecutando migraciones..."
docker compose --profile tools run --rm migrate
echo "✅ Migraciones completadas"

echo ""
echo "🌱 Ejecutando seed de datos iniciales (solo si es la primera vez)..."
docker compose --profile tools run --rm seed

echo ""
echo "✅ ¡Sistema en producción iniciado!"
echo ""
echo "   📡 API:    http://localhost:3001"
echo "   💓 Health: http://localhost:3001/health"
echo ""
echo "Comandos útiles:"
echo "  Ver logs del backend:   docker compose logs -f backend"
echo "  Ver logs de la DB:      docker compose logs -f db"
echo "  Detener todo:           docker compose down"
echo "  Backup manual:          docker compose exec backend node dist/config/backup.js"
echo "  Reiniciar backend:      docker compose restart backend"
echo "  Abrir shell en backend: docker compose exec backend sh"
