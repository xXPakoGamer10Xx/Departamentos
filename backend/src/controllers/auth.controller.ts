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

    // Rol por defecto según el que viene en el body
    let userRol: 'admin' | 'inquilino' | 'cobrador' = rol === 'admin' ? 'admin' : 'inquilino';

    // Variables para saber qué se debe hacer post-registro
    let inquilinoIdToLink: string | null = null;
    let codigoInvitacionId: string | null = null;

    if (userRol !== 'admin') {
      if (!invite_code) {
        throw new AppError('Se requiere un código de invitación válido', 403);
      }

      // 1️⃣ Verificar código en la tabla codigos_invitacion (nuevo sistema)
      const codigoResult = await pool.query(
        `SELECT id, rol, expira_en FROM codigos_invitacion
         WHERE codigo = $1 AND usado = false
           AND (expira_en IS NULL OR expira_en > NOW())`,
        [invite_code]
      );

      if (codigoResult.rows.length > 0) {
        // Código del nuevo sistema → usar el rol que dice el código
        const codigoRec = codigoResult.rows[0];
        userRol = codigoRec.rol as 'inquilino' | 'cobrador';
        codigoInvitacionId = codigoRec.id;
      } else {
        // 2️⃣ Fallback: verificar en invitation_token de inquilinos (sistema anterior)
        const tokenResult = await pool.query(
          `SELECT id, email_invitacion FROM inquilinos WHERE invitation_token = $1 AND usuario_id IS NULL`,
          [invite_code]
        );
        if (tokenResult.rows.length === 0) {
          throw new AppError('Código de invitación inválido, expirado o ya utilizado', 403);
        }
        const inquilinoRec = tokenResult.rows[0];
        if (inquilinoRec.email_invitacion && inquilinoRec.email_invitacion.toLowerCase() !== email.toLowerCase().trim()) {
          throw new AppError('El correo debe coincidir con la invitación original', 403);
        }
        userRol = 'inquilino';
        inquilinoIdToLink = invite_code; // guardamos el token para el UPDATE posterior
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

    // Acciones post-creación según la fuente del código
    if (codigoInvitacionId) {
      // Marcar el código de invitación como usado
      await pool.query(
        `UPDATE codigos_invitacion SET usado = true, usado_en = NOW(), usado_por = $1 WHERE id = $2`,
        [user.id, codigoInvitacionId]
      );
    } else if (inquilinoIdToLink) {
      // Sistema anterior: ligar usuario al inquilino
      await pool.query(
        `UPDATE inquilinos SET usuario_id = $1, invitation_token = NULL WHERE invitation_token = $2`,
        [user.id, inquilinoIdToLink]
      );
    }

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
