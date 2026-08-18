import { Router } from 'express';
import {
  getSaldoDeposito, getAbonosDeposito, registrarAbonoDeposito, editarAbonoDeposito, eliminarAbonoDeposito,
} from '../controllers/depositos.controller';
import { authMiddleware, adminOnly, cobradorOrAdmin } from '../middleware/auth.middleware';

export const depositosRouter = Router();

depositosRouter.use(authMiddleware);

depositosRouter.post('/abono', cobradorOrAdmin, registrarAbonoDeposito);
depositosRouter.put('/abono/:abono_id', adminOnly, editarAbonoDeposito);
depositosRouter.delete('/abono/:abono_id', adminOnly, eliminarAbonoDeposito);
depositosRouter.get('/:inquilino_id/saldo', getSaldoDeposito);
depositosRouter.get('/:inquilino_id/abonos', getAbonosDeposito);
