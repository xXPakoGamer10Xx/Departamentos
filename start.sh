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

# Crear archivo .env si no existe
if [ ! -f ".env" ]; then
  echo ""
  echo "⚠️  Archivo .env no encontrado. Creando uno desde .env.example..."
  if [ -f "backend/.env.example" ]; then
    cp backend/.env.example .env
    echo "📝 Edita el archivo .env con tus datos seguros antes de continuar."
    echo "   nano .env"
    exit 1
  fi
fi

# Crear directorio de backups si no existe
mkdir -p backups

echo ""
echo "🔨 Construyendo imagen del backend..."
docker compose build backend

echo ""
echo "🚀 Levantando servicios (PostgreSQL + Backend)..."
docker compose up -d db backend

echo ""
echo "⏳ Esperando que la base de datos esté lista..."
sleep 5

echo ""
echo "🔄 Ejecutando migraciones..."
docker compose run --rm migrate

echo ""
echo "🌱 Ejecutando seed de datos (si es primera vez)..."
docker compose run --rm seed

echo ""
echo "✅ ¡Sistema en producción iniciado!"
echo ""
echo "   📡 API:    http://localhost:3001"
echo "   💓 Health: http://localhost:3001/health"
echo ""
echo "Comandos útiles:"
echo "  Ver logs:          docker compose logs -f backend"
echo "  Detener todo:      docker compose down"
echo "  Backup manual:     docker compose exec backend node dist/config/seed.js"
echo "  Reiniciar backend: docker compose restart backend"
