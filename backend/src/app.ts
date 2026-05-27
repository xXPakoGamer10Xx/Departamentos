import 'dotenv/config';
import express from 'express';
import cors from 'cors';

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
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { initDB } from './config/database';
import { initBackupCron } from './config/backup';
import { initScheduler } from './services/scheduler.service';

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares globales
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : true)
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// Rutas de la API
app.use('/api/auth', authRouter);
app.use('/api/inquilinos', inquilinosRouter);
app.use('/api/departamentos', departamentosRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/backups', backupsRouter);
app.use('/api/config', configRouter);
app.use('/api/pagos', pagosRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/cuotas', cuotasRouter);
app.use('/api/push', pushRouter);
app.use('/api/events', eventsRouter);
app.use('/api/notificaciones', notificacionesRouter);
app.use('/api/invite-codes', inviteCodesRouter);

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

// Arranque del servidor
async function bootstrap() {
  try {
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
