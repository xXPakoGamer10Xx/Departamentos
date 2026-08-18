import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { authRouter } from './routes/auth.routes';
import { inquilinosRouter } from './routes/inquilinos.routes';
import { departamentosRouter } from './routes/departamentos.routes';
import { usuariosRouter } from './routes/usuarios.routes';
import { backupsRouter } from './routes/backups.routes';
import { configRouter } from './routes/config.routes';
import { pagosRouter } from './routes/pagos.routes';
import { ticketsRouter } from './routes/tickets.routes';
import { cuotasRouter } from './routes/cuotas.routes';
import { pushRouter } from './routes/push.routes';
import { eventsRouter } from './routes/events.routes';
import { notificacionesRouter } from './routes/notificaciones.routes';
import { inviteCodesRouter } from './routes/invite-codes.routes';
import { depositosRouter } from './routes/depositos.routes';
import { reportesRouter } from './routes/reportes.routes';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { generalLimiter } from './middleware/rateLimit.middleware';
import { cuentasBancariasRouter } from './routes/cuentas-bancarias.routes';
import { initDB } from './config/database';
import { initBackupCron } from './config/backup';
import { initScheduler } from './services/scheduler.service';

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// Detrás de nginx/reverse-proxy: necesario para que rate-limit lea la IP real.
app.set('trust proxy', 1);

// Cabeceras de seguridad HTTP. crossOriginResourcePolicy se relaja para permitir
// que la app sirva el frontend estático y PDFs/recursos desde el mismo origen.
app.use(helmet({
  contentSecurityPolicy: false, // el frontend es una SPA Expo; CSP estricta rompe inline
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS: en producción solo orígenes permitidos. Si FRONTEND_URL no está definida,
// se usa el dominio de producción conocido en lugar de permitir TODOS los orígenes.
const PROD_DEFAULT_ORIGIN = 'https://laspuercotas.xyz';
app.use(cors({
  origin: IS_PROD
    ? (process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(',').map(u => u.trim())
        : [PROD_DEFAULT_ORIGIN])
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// Rate limiting general (los limitadores estrictos se aplican por ruta).
app.use('/api', generalLimiter);

// Health check — mínimo, sin exponer entorno/versión a no autenticados.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Rutas de la API
app.use('/api/auth', authRouter);
app.use('/api/inquilinos', inquilinosRouter);
app.use('/api/departamentos', departamentosRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/backups', backupsRouter);
app.use('/api/config', configRouter);
app.use('/api/cuentas-bancarias', cuentasBancariasRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/cuotas', cuotasRouter);
app.use('/api/push', pushRouter);
app.use('/api/events', eventsRouter);
app.use('/api/notificaciones', notificacionesRouter);
app.use('/api/invite-codes', inviteCodesRouter);
app.use('/api/depositos', depositosRouter);
app.use('/api/reportes', reportesRouter);

// Error handler global (debe ir al final)
app.use(errorHandler);

import path from 'path';
import fs from 'fs';
const publicPath = path.join(__dirname, '../public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Guard de seguridad: en producción el JWT_SECRET debe estar definido y NO ser
// el valor por defecto del docker-compose. Evita desplegar con un secreto conocido.
function assertSecureConfig() {
  const secret = process.env.JWT_SECRET;
  const INSEGUROS = ['cambia_este_secreto_en_produccion', 'cambia_este_secreto_muy_largo_y_seguro_2024'];
  if (IS_PROD) {
    if (!secret || secret.length < 32 || INSEGUROS.includes(secret)) {
      console.error('❌ JWT_SECRET inseguro o ausente en producción. Define un JWT_SECRET aleatorio (>=32 chars) en el .env.');
      process.exit(1);
    }
  }
}

// Arranque del servidor
async function bootstrap() {
  try {
    assertSecureConfig();
    await initDB();
    console.log('✅ Conexión a PostgreSQL establecida');

    initBackupCron();
    console.log('✅ Cron de backup configurado');

    initScheduler();

    app.listen(PORT, () => {
      console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('❌ Error al iniciar el servidor:', err);
    process.exit(1);
  }
}

bootstrap();
