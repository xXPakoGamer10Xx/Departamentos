import { Router } from 'express';
import { generarQr, confirmarPago, getEstadoPago, getPagoByToken, subirComprobante, confirmarPagoAdmin, rechazarPagoAdmin, getComprobantesPendientes, getHistorialPagos } from '../controllers/pagos.controller';
import { authMiddleware, adminOnly, cobradorOrAdmin, softAuth } from '../middleware/auth.middleware';

export const pagosRouter = Router();

// Rutas públicas (softAuth registra quién escaneó si hay sesión activa)
pagosRouter.get('/info/:token', getPagoByToken);
pagosRouter.post('/confirmar/:token', softAuth, confirmarPago);

// Rutas protegidas
pagosRouter.use(authMiddleware);
pagosRouter.post('/generar-qr/:inquilino_id', generarQr);
pagosRouter.get('/estado/:inquilino_id', getEstadoPago);
pagosRouter.post('/comprobante/:inquilino_id', subirComprobante);
pagosRouter.post('/confirmar-admin/:pago_id', cobradorOrAdmin, confirmarPagoAdmin);
pagosRouter.post('/rechazar-admin/:pago_id', adminOnly, rechazarPagoAdmin);
pagosRouter.get('/comprobantes-pendientes', cobradorOrAdmin, getComprobantesPendientes);
pagosRouter.get('/historial/:inquilino_id', getHistorialPagos);
