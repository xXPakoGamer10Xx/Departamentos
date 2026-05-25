import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('❌ Error:', err?.message || err);

  const statusCode = err?.statusCode || err?.status || 500;

  res.status(statusCode).json({
    success: false,
    message: err?.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err?.stack }),
  });
}

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}
