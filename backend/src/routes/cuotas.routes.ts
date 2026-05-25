import { Router } from 'express';
import { getCuotas, createCuota, deleteCuota } from '../controllers/cuotas.controller';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware';

export const cuotasRouter = Router();

cuotasRouter.use(authMiddleware);
cuotasRouter.use(adminOnly);

cuotasRouter.get('/', getCuotas);
cuotasRouter.post('/', createCuota);
cuotasRouter.delete('/:id', deleteCuota);
