#!/bin/bash
# dev.sh - Entorno de DESARROLLO local
# Requiere: Node.js, Docker (solo para levantar PostgreSQL)

export PATH="$HOME/.local/bin:$PATH"

echo "╔══════════════════════════════════════════╗"
echo "║  🏠 VertexRent — Entorno de Desarrollo   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ─── Verificar Node.js ──────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo "❌ Node.js no encontrado. Instálalo o agrégalo al PATH."
  exit 1
fi
echo "✅ Node.js $(node -v)"

# ─── Detectar docker compose (v2 preferido sobre v1) ───────────────────────
if docker compose version &> /dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose &> /dev/null; then
  DC="docker-compose"
else
  DC=""
fi

# ─── Limpieza al salir (guard contra doble ejecución) ──────────────────────
_CLEANUP_DONE=0
cleanup() {
  [ "$_CLEANUP_DONE" = "1" ] && return
  _CLEANUP_DONE=1
  echo ""
  echo "🛑 Deteniendo todos los procesos..."
  jobs -p | xargs -r kill -TERM 2>/dev/null || true
  pkill -f "ts-node-dev.*src/app.ts" 2>/dev/null || true
  pkill -f "expo start" 2>/dev/null || true
  sleep 0.5
  jobs -p | xargs -r kill -KILL 2>/dev/null || true
  echo "✅ Procesos detenidos"
}
trap 'cleanup; exit 0' SIGINT SIGTERM
trap 'cleanup' EXIT

# ─── Instalar dependencias si faltan ───────────────────────────────────────
if [ ! -d "backend/node_modules" ]; then
  echo "📦 Instalando dependencias del backend..."
  (cd backend && npm install)
fi
if [ ! -d "frontend/node_modules" ]; then
  echo "📦 Instalando dependencias del frontend..."
  (cd frontend && npm install)
fi

# ─── Levantar PostgreSQL en Docker ─────────────────────────────────────────
if [ -n "$DC" ]; then
  echo "🐳 Iniciando base de datos PostgreSQL..."
  $DC -f docker-compose.yml -f docker-compose.dev.yml up -d db

  echo "⏳ Esperando a que PostgreSQL esté listo..."
  RETRIES=30
  COUNT=0
  until docker exec depas_db pg_isready -U "depas_user" -d "departamentos" &>/dev/null 2>&1; do
    COUNT=$((COUNT + 1))
    if [ "$COUNT" -ge "$RETRIES" ]; then
      echo ""
      echo "❌ PostgreSQL no respondió. Revisa: docker logs depas_db"
      exit 1
    fi
    printf "   ... esperando (%d/%d)\r" "$COUNT" "$RETRIES"
    sleep 1
  done
  echo "✅ PostgreSQL listo                    "
else
  echo "⚠️  Docker no encontrado. Asegúrate de tener PostgreSQL corriendo en localhost:5432"
fi

# ─── Detectar IP de la red local ───────────────────────────────────────────
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null \
  || ipconfig getifaddr en1 2>/dev/null \
  || hostname -I 2>/dev/null | awk '{print $1}' \
  || echo "TU_IP_LOCAL")

CURRENT_ENV=$(grep 'EXPO_PUBLIC_API_URL' frontend/.env.local 2>/dev/null | cut -d'=' -f2 || echo "")

echo ""
echo "🚀 Iniciando servicios en modo desarrollo..."
echo "   Backend:  http://localhost:3001"
echo "   Frontend: http://localhost:8081"
echo ""
if [ "$CURRENT_ENV" != "http://${LAN_IP}:3001/api" ]; then
  echo "   ⚠️  IP local detectada: ${LAN_IP}"
  echo "      Verifica que frontend/.env.local tenga:"
  echo "      EXPO_PUBLIC_API_URL=http://${LAN_IP}:3001/api"
  echo ""
fi
echo "   Presiona Ctrl+C para detener ambos servicios"
echo ""

# ─── Iniciar Backend ───────────────────────────────────────────────────────
# Las migraciones seguras (ALTER TABLE IF NOT EXISTS) se ejecutan
# automáticamente dentro del backend al arrancar (database.ts STARTUP_MIGRATIONS)
(cd backend && npm run dev) &
BACKEND_PID=$!

# Esperar a que el backend responda en /health
echo "⏳ Esperando que el backend arranque..."
RETRIES=30
COUNT=0
until curl -sf http://localhost:3001/health &>/dev/null 2>&1; do
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -ge "$RETRIES" ]; then
    echo "⚠️  Backend tardó más de lo esperado — iniciando Expo de todos modos..."
    break
  fi
  sleep 1
done
[ "$COUNT" -lt "$RETRIES" ] && echo "✅ Backend listo (http://localhost:3001)"

# ─── Iniciar Frontend (Expo) ───────────────────────────────────────────────
(cd frontend && npm start) &
FRONTEND_PID=$!

# Esperar ambos procesos
wait $BACKEND_PID $FRONTEND_PID
