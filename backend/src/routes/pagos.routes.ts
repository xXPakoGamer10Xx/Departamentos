import { Router } from 'express';
import { generarQr, confirmarPago, getEstadoPago, getPagoByToken, subirComprobante, confirmarPagoAdmin, getHistorialPagos } from '../controllers/pagos.controller';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware';

export const pagosRouter = Router();

// Rutas públicas (para confirmación desde escaneo de QR sin sesión)
pagosRouter.get('/info/:token', getPagoByToken);
pagosRouter.post('/confirmar/:token', confirmarPago);

// Rutas protegidas
pagosRouter.use(authMiddleware);
pagosRouter.post('/generar-qr/:inquilino_id', generarQr);
pagosRouter.get('/estado/:inquilino_id', getEstadoPago);
pagosRouter.post('/comprobante/:inquilino_id', subirComprobante);
pagosRouter.post('/confirmar-admin/:pago_id', adminOnly, confirmarPagoAdmin);
pagosRouter.get('/historial/:inquilino_id', getHistorialPagos);
