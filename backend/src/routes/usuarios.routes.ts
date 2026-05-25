import { Router } from 'express';
import { getUsuarios, createUsuario, toggleUsuario, updatePerfil } from '../controllers/usuarios.controller';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware';

export const usuariosRouter = Router();

usuariosRouter.use(authMiddleware);

usuariosRouter.get('/', adminOnly, getUsuarios);
usuariosRouter.post('/', adminOnly, createUsuario);
usuariosRouter.put('/:id/toggle', adminOnly, toggleUsuario);
usuariosRouter.patch('/perfil', updatePerfil);
