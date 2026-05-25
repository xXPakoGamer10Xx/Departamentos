import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { runBackup } from '../config/backup';
import * as fs from 'fs';
import * as path from 'path';

// GET /api/backups
export async function getBackups(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT * FROM backups ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/backups/manual — Ejecutar backup manual
export async function createManualBackup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { archivo, tamano } = await runBackup();

    // Actualizar el tipo a 'manual'
    await pool.query(
      `UPDATE backups SET tipo = 'manual' WHERE archivo = $1`, [archivo]
    );

    res.json({
      success: true,
      message: 'Backup manual completado',
      data: { archivo, tamano_bytes: tamano },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/backups/:archivo/descargar — Descargar archivo de backup
export async function downloadBackup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { archivo } = req.params;
    // Sanitizar nombre de archivo para evitar path traversal
    const safeName = path.basename(archivo);
    const backupDir = process.env.BACKUP_DIR || './backups';
    const filepath = path.join(backupDir, safeName);

    if (!fs.existsSync(filepath)) {
      throw new AppError('Archivo de backup no encontrado', 404);
    }

    res.download(filepath, safeName);
  } catch (err) {
    next(err);
  }
}
