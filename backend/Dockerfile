# ---- Build Frontend ----
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Configuramos la API URL para que apunte al mismo dominio
ENV EXPO_PUBLIC_API_URL=/api
# Llave pública VAPID para Web Push (pública por diseño, va embebida en el bundle del cliente)
ENV EXPO_PUBLIC_VAPID_PUBLIC_KEY=BHyeq9PZ1co5YK671ZOWXLfUn2VwPvRMPFjZVpWf3EB_WbgXAhTlIKfGuAhbZnkipi2Mgr9yGqOtcaHQcOxMIt8
RUN npx expo export -p web
RUN if [ -d public ]; then cp -r public/* dist/ 2>/dev/null || true; fi
RUN sed -i 's|</head>|<link rel="manifest" href="/manifest.json" /><meta name="theme-color" content="#0E1321" /><meta name="apple-mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" /><meta name="apple-mobile-web-app-title" content="NethRent" /><meta name="mobile-web-app-capable" content="yes" /><link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" /><link rel="apple-touch-icon" href="/icons/icon-192x192.png" /><link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" /><link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png" /></head>|' dist/index.html

# ---- Build Backend ----
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine AS production
WORKDIR /app

# Solo dependencias de producción
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar código compilado
COPY --from=backend-builder /app/backend/dist ./dist
# Copiar el frontend compilado a la carpeta public
COPY --from=frontend-builder /app/frontend/dist ./public

# Directorio de backups
RUN mkdir -p /app/backups

# Usuario no-root para seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/app.js"]
