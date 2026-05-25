import { Router } from 'express';
import { getTickets, createTicket, updateTicket, deleteTicket } from '../controllers/tickets.controller';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware';

export const ticketsRouter = Router();

ticketsRouter.use(authMiddleware);

ticketsRouter.get('/', getTickets);
ticketsRouter.post('/', createTicket);
ticketsRouter.patch('/:id', adminOnly, updateTicket);
ticketsRouter.delete('/:id', deleteTicket);
