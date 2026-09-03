import { Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PdfService, buildDocxVars } from '../services/PdfService';

// ────────────────────────────────────────────────────────────────────────────
// Datos de muestra para previsualizar el contrato
// ────────────────────────────────────────────────────────────────────────────
const DEMO_DATA = {
  nombre_completo:    'Juan Pérez García',
  depto_numero:       3,
  renta:              4500,
  renta_letra:        'cuatro mil quinientos',
  deposito:           4500,
  fecha_inicio:       '2025-01-01T12:00:00Z',
  fecha_termino:      '2025-12-31T12:00:00Z',
  fecha_pago:         '01 de cada mes',
  tel_arrendatario:   '5512345678',
  fiador_nombre:      'María García López',
  fiador_telefono:    '5587654321',
  arrendador_nombre:  'Roberto González',
  arrendador_direccion: 'Calle Principal 123, Col. Centro',
  metodo_pago:        'transferencia',
  observaciones:      'Sin observaciones adicionales',
  inventario_base:    ['Refrigerador', 'Estufa', 'Lavadora'],
};

// Sanitiza HTML de plantillas: elimina scripts, estilos y manejadores de eventos.
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/config
// ────────────────────────────────────────────────────────────────────────────
export async function getConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let adminId = req.user!.id;
    let deptoNumero: number | null = null;

    if (req.user!.rol === 'inquilino') {
      const inq = await pool.query(
        `SELECT admin_id, depto_numero FROM inquilinos WHERE usuario_id = $1 AND estado = 'activo' LIMIT 1`,
        [req.user!.id]
      );
      if (inq.rows[0]) {
        adminId = inq.rows[0].admin_id;
        deptoNumero = inq.rows[0].depto_numero;
      } else {
        res.json({ success: true, data: {} });
        return;
      }
    }

    const result = await pool.query(
      `SELECT clave, valor FROM configuracion WHERE admin_id = $1 ORDER BY clave`,
      [adminId]
    );
    const config: Record<string, string> = {};
    for (const row of result.rows) {
      // No devolver el base64 del DOCX al frontend (muy grande)
      if (row.clave === 'contrato_docx_template') {
        config[row.clave] = '__existe__';
      } else {
        config[row.clave] = row.valor;
      }
    }

    // Resolver la cuenta bancaria que aplica para el inquilino: la asignada a su
    // departamento; si no tiene, la predeterminada del admin. Sobreescribe los
    // campos banco_* para que la pantalla del inquilino los muestre sin cambios.
    if (req.user!.rol === 'inquilino') {
      const cuenta = await pool.query(
        `SELECT cb.banco_nombre, cb.banco_clabe, cb.banco_titular
         FROM cuentas_bancarias cb
         WHERE cb.admin_id = $1 AND cb.activo = TRUE
           AND (
             cb.id = (SELECT d.cuenta_bancaria_id FROM departamentos d
                      WHERE d.admin_id = $1 AND d.numero = $2)
             OR cb.es_predeterminada = TRUE
           )
         ORDER BY (cb.id = (SELECT d.cuenta_bancaria_id FROM departamentos d
                            WHERE d.admin_id = $1 AND d.numero = $2)) DESC
         LIMIT 1`,
        [adminId, deptoNumero]
      );
      if (cuenta.rows[0]) {
        config['banco_nombre']  = cuenta.rows[0].banco_nombre  ?? '';
        config['banco_clabe']   = cuenta.rows[0].banco_clabe   ?? '';
        config['banco_titular'] = cuenta.rows[0].banco_titular ?? '';
      }
    }

    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// PUT /api/config
// ────────────────────────────────────────────────────────────────────────────
export async function updateConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.rol !== 'admin') throw new AppError('No autorizado', 403);

    const adminId = req.user!.id;
    const updates = req.body as Record<string, string>;
    const allowed = [
      'arrendador_nombre', 'arrendador_direccion',
      'banco_nombre', 'banco_clabe', 'banco_titular',
      'admin_invite_code', 'app_url',
      'contrato_docx_template', 'contrato_docx_nombre',
      'contrato_html_template', 'dias_gracia_retraso',
      'usa_qr_inquilinos',
    ];

    for (const [clave, rawValor] of Object.entries(updates)) {
      if (!allowed.includes(clave)) continue;
      if (clave === 'dias_gracia_retraso') {
        const dias = parseInt(rawValor, 10);
        if (!Number.isInteger(dias) || dias < 0 || dias > 90) {
          throw new AppError('Los días de gracia deben ser un número entre 0 y 90', 400);
        }
      }
      // Sanitiza el HTML del contrato: elimina <script>/<style> y atributos on*
      const valor = clave === 'contrato_html_template'
        ? sanitizeHtml(rawValor)
        : rawValor;
      await pool.query(
        `INSERT INTO configuracion (admin_id, clave, valor) VALUES ($1, $2, $3)
         ON CONFLICT (admin_id, clave) DO UPDATE SET valor = $3, updated_at = NOW()`,
        [adminId, clave, valor]
      );
    }
    res.json({ success: true, message: 'Configuración actualizada' });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// DELETE /api/config/contrato-template
// ────────────────────────────────────────────────────────────────────────────
export async function deleteContratoTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.rol !== 'admin') throw new AppError('No autorizado', 403);
    await pool.query(
      `DELETE FROM configuracion WHERE admin_id = $1
       AND clave IN ('contrato_docx_template','contrato_docx_nombre','contrato_html_template')`,
      [req.user!.id]
    );
    res.json({ success: true, message: 'Plantilla eliminada — se usará la plantilla por defecto' });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/config/contrato-procesar-ia
// Recibe DOCX base64 → extrae texto → Gemini inserta variables → devuelve HTML
// ────────────────────────────────────────────────────────────────────────────
export async function procesarContratoIA(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.rol !== 'admin') throw new AppError('No autorizado', 403);

    const { docxBase64 } = req.body as { docxBase64: string };
    if (!docxBase64) throw new AppError('docxBase64 es requerido', 400);

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new AppError('GOOGLE_AI_API_KEY no configurada', 500);

    // 1. DOCX → HTML con mammoth
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require('mammoth');
    const commaIdx  = docxBase64.indexOf(',');
    const base64puro = commaIdx > -1 ? docxBase64.slice(commaIdx + 1) : docxBase64;
    const docxBuffer = Buffer.from(base64puro, 'base64');
    const { value: htmlOriginal } = await mammoth.convertToHtml({ buffer: docxBuffer });

    if (!htmlOriginal || htmlOriginal.trim().length < 20) {
      throw new AppError('No se pudo extraer texto del documento. Asegúrate de que el archivo .docx tenga contenido.', 422);
    }

    // 2. Enviar HTML a Gemini para que inserte las variables
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const prompt = `Eres un experto en contratos de arrendamiento mexicanos.
Recibirás un contrato en HTML. Tu tarea es identificar todos los datos específicos del inquilino/propiedad (nombres, montos, fechas, teléfonos, direcciones) y REEMPLAZARLOS con las variables de plantilla correspondientes usando el formato {{variable}}.

VARIABLES DISPONIBLES (usa EXACTAMENTE estos nombres):
- {{nombre_completo}} — nombre completo del inquilino/arrendatario
- {{depto_numero}} — número del departamento
- {{renta}} — monto de renta mensual (ej: $3,500.00)
- {{renta_letra}} — renta en letra (ej: tres mil quinientos pesos)
- {{deposito}} — monto del depósito
- {{fecha_inicio}} — fecha de inicio del contrato
- {{fecha_termino}} — fecha de término/fin del contrato
- {{fecha_pago}} — día de pago mensual (ej: 01 de cada mes)
- {{tel_arrendatario}} — teléfono del inquilino
- {{fiador_nombre}} — nombre del fiador/aval
- {{fiador_telefono}} — teléfono del fiador
- {{arrendador_nombre}} — nombre del arrendador/propietario
- {{arrendador_direccion}} — dirección de la propiedad
- {{metodo_pago}} — forma de pago (efectivo/transferencia)
- {{observaciones}} — observaciones adicionales
- {{inventario}} — lista del inventario del departamento

REGLAS IMPORTANTES:
1. Reemplaza TODOS los datos específicos con las variables correspondientes
2. Conserva TODO el texto legal, cláusulas y estructura HTML exactamente como está
3. Si ves un nombre de persona en el rol de arrendatario → usa {{nombre_completo}}
4. Si ves cantidades de dinero para renta → usa {{renta}}
5. Si ves fechas de inicio/fin de contrato → usa las variables de fecha
6. NO inventes variables; usa solo las de la lista anterior
7. Devuelve ÚNICAMENTE el HTML modificado, sin explicaciones ni markdown

HTML del contrato:
${htmlOriginal}`;

    const result = await model.generateContent(prompt);
    let htmlConVariables = result.response.text().trim();

    // Limpiar posible markdown del modelo
    htmlConVariables = htmlConVariables
      .replace(/^```(?:html)?\s*/i, '')
      .replace(/\s*```$/,  '')
      .trim();

    console.log('[procesarContratoIA] variables encontradas:',
      (htmlConVariables.match(/\{\{[^}]+\}\}/g) || []).join(', '));

    res.json({ success: true, data: { htmlTemplate: htmlConVariables } });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/config/contrato-preview-pdf
// Genera PDF de muestra con el HTML template + datos dummy
// ────────────────────────────────────────────────────────────────────────────
export async function previewContratoPdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.rol !== 'admin') throw new AppError('No autorizado', 403);

    const { htmlTemplate } = req.body as { htmlTemplate: string };
    if (!htmlTemplate) throw new AppError('htmlTemplate es requerido', 400);

    // Obtener config del admin para los datos del arrendador en el preview
    const configRes = await pool.query(
      `SELECT clave, valor FROM configuracion WHERE admin_id = $1
       AND clave IN ('arrendador_nombre','arrendador_direccion')`,
      [req.user!.id]
    );
    const cfg: Record<string, string> = {};
    for (const row of configRes.rows) cfg[row.clave] = row.valor;

    const demoData = {
      ...DEMO_DATA,
      arrendador_nombre:    cfg['arrendador_nombre']    || DEMO_DATA.arrendador_nombre,
      arrendador_direccion: cfg['arrendador_direccion'] || DEMO_DATA.arrendador_direccion,
    };

    const pdfBuffer = await PdfService.generateFromHtmlTemplate(htmlTemplate, demoData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview_contrato.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/config/contrato-descargar-docx
// Convierte el HTML template a DOCX para que el admin lo edite en Word
// ────────────────────────────────────────────────────────────────────────────
export async function descargarContratoDocx(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.rol !== 'admin') throw new AppError('No autorizado', 403);

    const { htmlTemplate } = req.body as { htmlTemplate: string };
    if (!htmlTemplate) throw new AppError('htmlTemplate es requerido', 400);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const HTMLtoDOCX = require('html-to-docx');

    // Envolver en HTML completo con estilos básicos
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
  p    { margin-bottom: 8pt; text-align: justify; }
  h1   { font-size: 14pt; text-align: center; text-transform: uppercase; }
  h2   { font-size: 12pt; text-decoration: underline; }
  strong { font-weight: bold; }
</style>
</head><body>${htmlTemplate}</body></html>`;

    const docxBuffer: Buffer = await HTMLtoDOCX(fullHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_con_variables.docx"');
    res.setHeader('Content-Length', docxBuffer.length);
    res.end(docxBuffer);
  } catch (err) {
    next(err);
  }
}
