import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { toTitleCase } from '../utils/formatters';

// GET /api/usuarios
export async function getUsuarios(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT id, email, nombre_completo, rol, avatar_url, activo, ultimo_acceso, created_at
       FROM usuarios ORDER BY created_at ASC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/usuarios
export async function createUsuario(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, nombre_completo, rol } = req.body;

    if (!email || !password || !nombre_completo) {
      throw new AppError('Email, contraseña y nombre son requeridos', 400);
    }
    if (password.length < 8) {
      throw new AppError('La contraseña debe tener al menos 8 caracteres', 400);
    }

    const existing = await pool.query(`SELECT id FROM usuarios WHERE email = $1`, [email.toLowerCase()]);
    if (existing.rows[0]) throw new AppError('Ya existe un usuario con ese email', 409);

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO usuarios (email, password_hash, nombre_completo, rol)
       VALUES ($1, $2, $3, $4) RETURNING id, email, nombre_completo, rol, activo, created_at`,
      [email.toLowerCase(), hash, toTitleCase(nombre_completo), rol || 'admin']
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/usuarios/:id/toggle — Activar/desactivar usuario
export async function toggleUsuario(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (id === req.user!.id) throw new AppError('No puedes desactivar tu propia cuenta', 400);

    const result = await pool.query(
      `UPDATE usuarios SET activo = NOT activo WHERE id = $1 RETURNING id, email, activo`,
      [id]
    );
    if (!result.rows[0]) throw new AppError('Usuario no encontrado', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/usuarios/perfil — Actualizar propio perfil
export async function updatePerfil(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre_completo, avatar_url } = req.body;
    const result = await pool.query(
      `UPDATE usuarios SET
        nombre_completo = COALESCE($1, nombre_completo),
        avatar_url = COALESCE($2, avatar_url)
       WHERE id = $3
       RETURNING id, email, nombre_completo, rol, avatar_url`,
      [nombre_completo ? toTitleCase(nombre_completo) : null, avatar_url || null, req.user!.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}
