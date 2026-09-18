import { Router } from 'express';
import {
  getDepartamentos, getDepartamentoByNumero,
  updateDepartamento, getDepartamentosStats, createDepartamento, deleteDepartamento,
} from '../controllers/departamentos.controller';
import { authMiddleware, adminOnly, requirePermiso } from '../middleware/auth.middleware';

export const departamentosRouter = Router();

departamentosRouter.use(authMiddleware);

const verDeptos = requirePermiso('departamentos');
departamentosRouter.get('/stats', verDeptos, getDepartamentosStats);
departamentosRouter.get('/', verDeptos, getDepartamentos);
departamentosRouter.get('/:numero', verDeptos, getDepartamentoByNumero);
departamentosRouter.post('/', adminOnly, createDepartamento);
departamentosRouter.put('/:numero', adminOnly, updateDepartamento);
departamentosRouter.delete('/:numero', adminOnly, deleteDepartamento);
