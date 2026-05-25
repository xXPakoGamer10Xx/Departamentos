import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { toTitleCase } from '../utils/formatters';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email y contraseña son requeridos', 400);
    }

    const result = await pool.query(
      `SELECT id, email, password_hash, nombre_completo, rol, avatar_url, activo
       FROM usuarios WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];
    if (!user || !user.activo) {
      throw new AppError('Credenciales inválidas', 401);
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      throw new AppError('Credenciales inválidas', 401);
    }

    // Actualizar último acceso
    await pool.query(
      `UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1`,
      [user.id]
    );

    const payload = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      nombre_completo: user.nombre_completo,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    } as any);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          nombre_completo: user.nombre_completo,
          rol: user.rol,
          avatar_url: user.avatar_url,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT id, email, nombre_completo, rol, avatar_url, ultimo_acceso, created_at
       FROM usuarios WHERE id = $1`,
      [req.user!.id]
    );

    if (!result.rows[0]) throw new AppError('Usuario no encontrado', 404);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, nombre_completo, rol, invite_code } = req.body;

    if (!email || !password || !nombre_completo) {
      throw new AppError('Email, contraseña y nombre son requeridos', 400);
    }
    if (password.length < 8) {
      throw new AppError('La contraseña debe tener al menos 8 caracteres', 400);
    }

    const userRol: 'admin' | 'inquilino' = rol === 'admin' ? 'admin' : 'inquilino';

    if (userRol === 'admin') {
      if (!invite_code) {
        throw new AppError('Se requiere un código de invitación para crear una cuenta de administrador', 403);
      }
      const cfgResult = await pool.query(
        `SELECT valor FROM configuracion WHERE clave = 'admin_invite_code'`
      );
      const storedCode = cfgResult.rows[0]?.valor;
      if (!storedCode || invite_code !== storedCode) {
        throw new AppError('Código de invitación inválido', 403);
      }
    }

    const existing = await pool.query(
      `SELECT id FROM usuarios WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    if (existing.rows[0]) {
      throw new AppError('Ya existe una cuenta con ese correo electrónico', 409);
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO usuarios (email, password_hash, nombre_completo, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, nombre_completo, rol, avatar_url`,
      [email.toLowerCase().trim(), hash, toTitleCase(nombre_completo), userRol]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol, nombre_completo: user.nombre_completo },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any
    );

    res.status(201).json({ success: true, data: { token, user } });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { passwordActual, passwordNueva } = req.body;

    if (!passwordActual || !passwordNueva) {
      throw new AppError('Contraseña actual y nueva son requeridas', 400);
    }
    if (passwordNueva.length < 8) {
      throw new AppError('La contraseña nueva debe tener al menos 8 caracteres', 400);
    }

    const result = await pool.query(
      `SELECT password_hash FROM usuarios WHERE id = $1`,
      [req.user!.id]
    );

    const valid = await bcrypt.compare(passwordActual, result.rows[0].password_hash);
    if (!valid) throw new AppError('Contraseña actual incorrecta', 400);

    const newHash = await bcrypt.hash(passwordNueva, 12);
    await pool.query(
      `UPDATE usuarios SET password_hash = $1 WHERE id = $2`,
      [newHash, req.user!.id]
    );

    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    next(err);
  }
}
