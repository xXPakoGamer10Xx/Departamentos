#!/bin/bash
# dev.sh - Script para entorno de DESARROLLO (sin Docker, todo local)
# Requiere: Node.js en ~/.local/bin, PostgreSQL corriendo localmente

export PATH="$HOME/.local/bin:$PATH"

echo "╔══════════════════════════════════════════╗"
echo "║  🏠 Admin Depas — Entorno de Desarrollo  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js no encontrado. Asegúrate de tenerlo en ~/.local/bin"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# Función para matar el árbol completo de procesos
cleanup() {
  echo ""
  echo "🛑 Deteniendo todos los procesos..."
  # Matar todos los hijos directos del script
  jobs -p | xargs -r kill -TERM 2>/dev/null || true
  # Matar procesos específicos por nombre (ts-node-dev y expo pueden quedar huérfanos)
  pkill -f "ts-node-dev.*src/app.ts" 2>/dev/null || true
  pkill -f "expo start" 2>/dev/null || true
  pkill -f "react-native/cli" 2>/dev/null || true
  # Esperar un momento para limpieza ordenada
  sleep 0.5
  # Forzar kill de los que no respondieron
  jobs -p | xargs -r kill -KILL 2>/dev/null || true
  echo "✅ Procesos detenidos"
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Instalar dependencias de backend si es necesario
if [ ! -d "backend/node_modules" ]; then
  echo "📦 Instalando dependencias del backend..."
  (cd backend && npm install)
fi

# Instalar dependencias de frontend si es necesario
if [ ! -d "frontend/node_modules" ]; then
  echo "📦 Instalando dependencias del frontend..."
  (cd frontend && npm install)
fi

# Asegurar que la base de datos esté corriendo (usando Docker Compose)
echo "🐳 Iniciando base de datos PostgreSQL local..."
if command -v docker-compose &> /dev/null; then
  docker-compose up -d db
  echo "⏳ Esperando a que PostgreSQL inicie..."
  sleep 3
else
  echo "⚠️ docker-compose no encontrado. Asegúrate de tener PostgreSQL corriendo."
fi

# Ejecutar migraciones si la DB está lista
echo ""
echo "🔄 Ejecutando migraciones de base de datos..."
if (cd backend && node -e "require('./dist/config/migrate.js')" 2>/dev/null) || \
   (cd backend && npx ts-node src/config/migrate.ts 2>/dev/null); then
  echo "✅ Migraciones completadas"
else
  echo "⚠️  Las migraciones fallaron (¿está PostgreSQL corriendo?)"
fi

echo ""
echo "🚀 Iniciando servicios en modo desarrollo..."
echo "   Backend:  http://localhost:3001"
echo "   Frontend: http://localhost:8081"
echo ""
echo "   Presiona Ctrl+C para detener ambos servicios"
echo ""

# Iniciar Backend en background y guardar PID
(cd backend && npm run dev) &
BACKEND_PID=$!

# Esperar un momento para que el backend arranque
sleep 3

# Iniciar Frontend en background también (así Ctrl+C dispara el trap correctamente)
(cd frontend && npm start) &
FRONTEND_PID=$!

# Esperar ambos procesos — si alguno muere, el trap limpia el otro
wait $BACKEND_PID $FRONTEND_PID
