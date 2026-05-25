# ---- Build Frontend ----
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Configuramos la API URL para que apunte al mismo dominio
ENV EXPO_PUBLIC_API_URL=/api
RUN npx expo export -p web

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
