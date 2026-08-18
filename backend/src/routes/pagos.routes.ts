import { Router } from 'express';
import { generarQr, confirmarPago, getEstadoPago, getEstadosPagosActuales, getPagoByToken, subirComprobante, confirmarPagoAdmin, rechazarPagoAdmin, getComprobantesPendientes, getHistorialPagos, marcarPagadoAdmin, registrarAbono, getAbonosPago, editarAbono, eliminarAbono, getSaldoInquilino, getSaldosInquilinos, getResumenDeuda, setPromesaPago } from '../controllers/pagos.controller';
import { authMiddleware, adminOnly, cobradorOrAdmin, softAuth } from '../middleware/auth.middleware';
import { tokenLimiter } from '../middleware/rateLimit.middleware';

export const pagosRouter = Router();

// Rutas públicas (softAuth registra quién escaneó si hay sesión activa).
// tokenLimiter previene enumeración de tokens de pago.
pagosRouter.get('/info/:token', tokenLimiter, getPagoByToken);
pagosRouter.post('/confirmar/:token', tokenLimiter, softAuth, confirmarPago);

// Rutas protegidas
pagosRouter.use(authMiddleware);
pagosRouter.post('/generar-qr/:inquilino_id', generarQr);
pagosRouter.get('/estados-actuales', cobradorOrAdmin, getEstadosPagosActuales);
pagosRouter.get('/estado/:inquilino_id', getEstadoPago);
pagosRouter.post('/comprobante/:inquilino_id', subirComprobante);
pagosRouter.post('/confirmar-admin/:pago_id', cobradorOrAdmin, confirmarPagoAdmin);
pagosRouter.post('/marcar-pagado/:inquilino_id', adminOnly, marcarPagadoAdmin);
pagosRouter.post('/rechazar-admin/:pago_id', adminOnly, rechazarPagoAdmin);
pagosRouter.get('/comprobantes-pendientes', cobradorOrAdmin, getComprobantesPendientes);
pagosRouter.get('/historial/:inquilino_id', getHistorialPagos);

// Abonos (pagos parciales con historial) y saldo/deuda acumulada
pagosRouter.post('/abono', cobradorOrAdmin, registrarAbono);
pagosRouter.get('/abonos/:pago_id', getAbonosPago);
pagosRouter.put('/abono/:abono_id', adminOnly, editarAbono);
pagosRouter.delete('/abono/:abono_id', adminOnly, eliminarAbono);
pagosRouter.get('/saldos/resumen', cobradorOrAdmin, getResumenDeuda);
pagosRouter.get('/saldos', cobradorOrAdmin, getSaldosInquilinos);
pagosRouter.get('/saldo/:inquilino_id', getSaldoInquilino);
pagosRouter.put('/:pago_id/promesa', adminOnly, setPromesaPago);
