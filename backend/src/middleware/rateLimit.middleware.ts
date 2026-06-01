import rateLimit from 'express-rate-limit';

// Limitador general suave para toda la API (evita abuso / scraping masivo).
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 1000,                // 1000 req / IP / ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes, intenta más tarde' },
});

// Limitador estricto para autenticación (anti fuerza bruta en login/registro).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,                  // 20 intentos / IP / ventana
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // los logins exitosos no cuentan
  message: { success: false, message: 'Demasiados intentos de acceso, espera unos minutos' },
});

// Limitador para endpoints sensibles por token público (QR de pago, invite-codes):
// previene enumeración de tokens/códigos.
export const tokenLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 min
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes, intenta más tarde' },
});
