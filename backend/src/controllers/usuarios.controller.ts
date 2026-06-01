import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { toTitleCase } from '../utils/formatters';

// GET /api/usuarios — Solo devuelve el propio admin + los que invitó
export async function getUsuarios(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.user!.id;
    const result = await pool.query(
      `SELECT u.id, u.email, u.nombre_completo, u.rol, u.avatar_url, u.activo, u.ultimo_acceso, u.created_at
       FROM usuarios u
       WHERE u.id = $1
          OR u.id IN (
            SELECT usado_por FROM codigos_invitacion WHERE admin_id = $1 AND usado_por IS NOT NULL
          )
       ORDER BY u.created_at ASC`,
      [adminId]
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
    const adminId = req.user!.id;
    if (id === adminId) throw new AppError('No puedes desactivar tu propia cuenta', 400);

    // Verificar que el usuario pertenece al scope del admin
    const scopeCheck = await pool.query(
      `SELECT 1 FROM codigos_invitacion WHERE admin_id = $1 AND usado_por = $2`,
      [adminId, id]
    );
    if (!scopeCheck.rows[0]) throw new AppError('No tienes permiso para modificar este usuario', 403);

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

// PATCH /api/usuarios/:id/rol — Admin cambia el rol de un usuario
export async function cambiarRol(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { rol } = req.body;

    if (!['admin', 'cobrador', 'inquilino'].includes(rol)) {
      throw new AppError('Rol inválido. Usa "admin", "cobrador" o "inquilino"', 400);
    }
    if (id === req.user!.id) {
      throw new AppError('No puedes cambiar tu propio rol', 400);
    }

    const result = await pool.query(
      `UPDATE usuarios SET rol = $1 WHERE id = $2
       RETURNING id, email, nombre_completo, rol, activo`,
      [rol, id]
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

// DELETE /api/usuarios/:id — Eliminar usuario
export async function deleteUsuario(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;

    if (id === adminId) {
      throw new AppError('No puedes eliminar tu propia cuenta', 400);
    }

    // Verificar que el usuario pertenece al scope del admin
    const scopeCheck = await pool.query(
      `SELECT 1 FROM codigos_invitacion WHERE admin_id = $1 AND usado_por = $2`,
      [adminId, id]
    );
    if (!scopeCheck.rows[0]) throw new AppError('No tienes permiso para eliminar este usuario', 403);

    const result = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) throw new AppError('Usuario no encontrado', 404);

    res.json({ success: true, message: 'Usuario eliminado exitosamente' });
  } catch (err) {
    next(err);
  }
}
