import { Router } from 'express';
import { generarQr, confirmarPago, getEstadoPago, getEstadosPagosActuales, getPagoByToken, subirComprobante, confirmarPagoAdmin, rechazarPagoAdmin, getComprobantesPendientes, getHistorialPagos, marcarPagadoAdmin, cancelarPago, registrarAbono, getAbonosPago, editarAbono, eliminarAbono, getSaldoInquilino, getSaldosInquilinos, getResumenDeuda, setPromesaPago, setPromesaPagoInquilino, getPromesasHistorial, eliminarPromesaHistorial } from '../controllers/pagos.controller';
import { authMiddleware, cobradorOrAdmin, requirePermiso, softAuth } from '../middleware/auth.middleware';
import { tokenLimiter } from '../middleware/rateLimit.middleware';

export const pagosRouter = Router();

// Rutas públicas (softAuth registra quién escaneó si hay sesión activa).
// tokenLimiter previene enumeración de tokens de pago.
pagosRouter.get('/info/:token', tokenLimiter, getPagoByToken);
pagosRouter.post('/confirmar/:token', tokenLimiter, softAuth, confirmarPago);

// Rutas protegidas
pagosRouter.use(authMiddleware);

// Ver el apartado de pagos → permiso 'pagos'
const verPagos = requirePermiso('pagos');
// Modificar pagos (marcar pagado, abonos, cancelar, validar) → permiso 'pagos.marcar'
const editarPagos = requirePermiso('pagos.marcar');

pagosRouter.post('/generar-qr/:inquilino_id', generarQr);
pagosRouter.get('/estados-actuales', verPagos, getEstadosPagosActuales);
pagosRouter.get('/estado/:inquilino_id', getEstadoPago);
pagosRouter.post('/comprobante/:inquilino_id', subirComprobante);
pagosRouter.post('/confirmar-admin/:pago_id', editarPagos, confirmarPagoAdmin);
pagosRouter.post('/marcar-pagado/:inquilino_id', editarPagos, marcarPagadoAdmin);
pagosRouter.delete('/:pago_id/cancelar', editarPagos, cancelarPago);
pagosRouter.post('/rechazar-admin/:pago_id', editarPagos, rechazarPagoAdmin);
pagosRouter.get('/comprobantes-pendientes', verPagos, getComprobantesPendientes);
pagosRouter.get('/historial/:inquilino_id', getHistorialPagos);

// Abonos (pagos parciales con historial) y saldo/deuda acumulada
pagosRouter.post('/abono', editarPagos, registrarAbono);
pagosRouter.get('/abonos/:pago_id', getAbonosPago);
pagosRouter.put('/abono/:abono_id', editarPagos, editarAbono);
pagosRouter.delete('/abono/:abono_id', editarPagos, eliminarAbono);
// El resumen de deuda alimenta el Dashboard (visible para todo colaborador).
pagosRouter.get('/saldos/resumen', cobradorOrAdmin, getResumenDeuda);
pagosRouter.get('/saldos', cobradorOrAdmin, getSaldosInquilinos);
pagosRouter.get('/saldo/:inquilino_id', getSaldoInquilino);
pagosRouter.put('/promesa/inquilino/:inquilino_id', editarPagos, setPromesaPagoInquilino);
pagosRouter.put('/:pago_id/promesa', editarPagos, setPromesaPago);
pagosRouter.get('/promesas/:inquilino_id', getPromesasHistorial);
pagosRouter.delete('/promesas/:id', editarPagos, eliminarPromesaHistorial);
