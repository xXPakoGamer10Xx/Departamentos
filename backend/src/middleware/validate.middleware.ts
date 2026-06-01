import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

/**
 * Ejecuta una lista de reglas de express-validator y devuelve 400 con los
 * errores si alguna falla. Uso:
 *   router.post('/', validate([ body('email').isEmail() ]), handler)
 */
export function validate(rules: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    for (const rule of rules) {
      await rule.run(req);
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: errors.array().map(e => ({ campo: (e as any).path, msg: e.msg })),
      });
      return;
    }
    next();
  };
}
