import { Router } from 'express';
import { body } from 'express-validator';
import {
  getCuentasBancarias, createCuentaBancaria, updateCuentaBancaria,
  setCuentaDefault, deleteCuentaBancaria, asignarCuentaDepto,
} from '../controllers/cuentas-bancarias.controller';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

export const cuentasBancariasRouter = Router();

cuentasBancariasRouter.use(authMiddleware, adminOnly);

cuentasBancariasRouter.get('/', getCuentasBancarias);

cuentasBancariasRouter.post('/', validate([
  body('banco_clabe').isString().matches(/^\d{18}$/).withMessage('La CLABE debe tener 18 dígitos'),
  body('banco_nombre').optional().isString().trim().isLength({ max: 60 }),
  body('banco_titular').optional().isString().trim().isLength({ max: 120 }),
  body('alias').optional().isString().trim().isLength({ max: 60 }),
]), createCuentaBancaria);

cuentasBancariasRouter.put('/:id', updateCuentaBancaria);
cuentasBancariasRouter.patch('/:id/predeterminada', setCuentaDefault);
cuentasBancariasRouter.delete('/:id', deleteCuentaBancaria);

cuentasBancariasRouter.patch('/departamento/:numero', asignarCuentaDepto);
