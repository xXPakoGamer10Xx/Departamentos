import { Response } from 'express';

const userClients = new Map<string, Set<Response>>();
const adminUserIds = new Set<string>();

export function addSSEClient(userId: string, rol: string, res: Response): void {
  if (!userClients.has(userId)) userClients.set(userId, new Set());
  userClients.get(userId)!.add(res);
  if (rol === 'admin') adminUserIds.add(userId);
}

export function removeSSEClient(userId: string, res: Response): void {
  const set = userClients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    userClients.delete(userId);
    adminUserIds.delete(userId);
  }
}

function writeEvent(res: Response, event: string, data: object): boolean {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

export function emitToUser(userId: string, event: string, data: object): void {
  const set = userClients.get(userId);
  if (!set) return;
  for (const res of [...set]) {
    if (!writeEvent(res, event, data)) set.delete(res);
  }
}

export function emitToAdmins(event: string, data: object): void {
  for (const adminId of [...adminUserIds]) {
    emitToUser(adminId, event, data);
  }
}
