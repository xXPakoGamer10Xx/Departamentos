import { Router } from 'express';
import { getTickets, createTicket, updateTicket, deleteTicket } from '../controllers/tickets.controller';
import { authMiddleware, requirePermiso, AuthRequest } from '../middleware/auth.middleware';
import { Response, NextFunction } from 'express';

export const ticketsRouter = Router();

ticketsRouter.use(authMiddleware);

// El inquilino siempre puede ver/crear/borrar sus propios tickets (autoservicio);
// admin/cobrador necesitan el permiso 'tickets' (admin lo tiene siempre).
const verOAtenderTickets = requirePermiso('tickets');
const ticketsGuard = (req: AuthRequest, res: Response, next: NextFunction) =>
  req.user?.rol === 'inquilino' ? next() : verOAtenderTickets(req, res, next);

ticketsRouter.get('/', ticketsGuard, getTickets);
ticketsRouter.post('/', createTicket);
ticketsRouter.patch('/:id', verOAtenderTickets, updateTicket);
ticketsRouter.delete('/:id', ticketsGuard, deleteTicket);
