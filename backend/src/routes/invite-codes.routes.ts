import { Router } from 'express';
import { crearCodigo, listarCodigos, revocarCodigo } from '../controllers/invite-codes.controller';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware';

export const inviteCodesRouter = Router();

inviteCodesRouter.use(authMiddleware, adminOnly);

inviteCodesRouter.post('/', crearCodigo);
inviteCodesRouter.get('/', listarCodigos);
inviteCodesRouter.delete('/:id', revocarCodigo);
