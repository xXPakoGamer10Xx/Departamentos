import { Router } from 'express';
import {
  getDepartamentos, getDepartamentoByNumero,
  updateDepartamento, getDepartamentosStats, createDepartamento, deleteDepartamento,
} from '../controllers/departamentos.controller';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware';

export const departamentosRouter = Router();

departamentosRouter.use(authMiddleware);

departamentosRouter.get('/stats', getDepartamentosStats);
departamentosRouter.get('/', getDepartamentos);
departamentosRouter.get('/:numero', getDepartamentoByNumero);
departamentosRouter.post('/', adminOnly, createDepartamento);
departamentosRouter.put('/:numero', adminOnly, updateDepartamento);
departamentosRouter.delete('/:numero', adminOnly, deleteDepartamento);
