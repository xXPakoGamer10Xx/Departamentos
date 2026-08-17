import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { ContratoArrendamiento } from '../templates/ContratoArrendamiento';
import { ContratoPersonalizado, ParsedPara, TextSegment } from '../templates/ContratoPersonalizado';

// ---------------------------------------------------------------------------
// Helpers para parsear HTML de mammoth → estructura para react-pdf
// ---------------------------------------------------------------------------

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ''));
}

function parseInline(content: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Tokenize: <strong>, <em>, <b>, <i>, text nodes
  const regex = /<strong[^>]*>([\s\S]*?)<\/strong>|<b[^>]*>([\s\S]*?)<\/b>|<em[^>]*>([\s\S]*?)<\/em>|<i[^>]*>([\s\S]*?)<\/i>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    if (m[1] !== undefined || m[2] !== undefined) {
      const text = stripTags(m[1] ?? m[2]);
      if (text) segments.push({ text, bold: true });
    } else if (m[3] !== undefined || m[4] !== undefined) {
      const text = stripTags(m[3] ?? m[4]);
      if (text) segments.push({ text, italic: true });
    } else if (m[5]) {
      const text = decodeEntities(m[5]);
      if (text.trim()) segments.push({ text });
    }
  }
  return segments;
}

function parseMammothHtml(html: string): ParsedPara[] {
  const paragraphs: ParsedPara[] = [];
  // Match block-level tags
  const blockRe = /<(p|h1|h2|h3|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const tag  = m[1].toLowerCase();
    const body = m[2];
    const level: ParsedPara['level'] = tag.startsWith('h')
      ? (tag as 'h1' | 'h2' | 'h3')
      : 'p';
    const segments = parseInline(body);
    if (segments.length > 0) {
      paragraphs.push({ level, segments });
    }
  }
  return paragraphs;
}

// ---------------------------------------------------------------------------
// Variables disponibles para las plantillas DOCX
// ---------------------------------------------------------------------------

function formatMXDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '0.00';
  return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2 }).format(n);
}

export function buildDocxVars(data: Record<string, any>): Record<string, string> {
  return {
    nombre_completo:     data.nombre_completo    ?? '',
    depto_numero:        String(data.depto_numero ?? ''),
    renta:               formatCurrency(data.renta),
    renta_numero:        String(data.renta ?? ''),
    renta_letra:         data.renta_letra        ?? '',
    deposito:            formatCurrency(data.deposito),
    deposito_numero:     String(data.deposito ?? ''),
    deposito_tipo:       data.deposito_tipo ?? 'ninguno',
    deposito_fechas:     Array.isArray(data.deposito_fechas) && data.deposito_fechas.length
                           ? (data.deposito_fechas as string[]).map(formatMXDate).join(', ')
                           : '',
    fecha_inicio:        formatMXDate(data.fecha_inicio),
    fecha_termino:       formatMXDate(data.fecha_termino),
    fecha_pago:          data.fecha_pago         ?? '',
    tel_arrendatario:    data.tel_arrendatario   ?? '',
    fiador_nombre:       data.fiador_nombre      ?? '',
    fiador_telefono:     data.fiador_telefono    ?? '',
    observaciones:       data.observaciones      ?? '',
    arrendador_nombre:   data.arrendador_nombre  ?? '',
    arrendador_direccion:data.arrendador_direccion ?? '',
    metodo_pago:         data.metodo_pago        ?? 'efectivo',
    inventario:          Array.isArray(data.inventario_base)
                           ? (data.inventario_base as string[]).join(', ')
                           : '',
  };
}

// ---------------------------------------------------------------------------
// PdfService
// ---------------------------------------------------------------------------

export class PdfService {
  /**
   * Genera PDF con la plantilla hardcodeada (default).
   */
  static async generateContratoPdf(data: any): Promise<Buffer> {
    const element = React.createElement(ContratoArrendamiento, { data });
    // @ts-ignore
    return await renderToBuffer(element);
  }

  /**
   * Genera PDF a partir de un HTML template con {{variables}} (procesado por IA).
   * Reemplaza variables → parsea HTML → react-pdf
   */
  static async generateFromHtmlTemplate(htmlTemplate: string, contractData: any): Promise<Buffer> {
    const vars = buildDocxVars(contractData);

    // Reemplazar todas las {{variables}} en el HTML
    let html = htmlTemplate;
    for (const [key, value] of Object.entries(vars)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    const paragraphs = parseMammothHtml(html);

    const element = React.createElement(ContratoPersonalizado, {
      paragraphs,
      data: {
        nombre_completo:   contractData.nombre_completo  ?? '',
        arrendador_nombre: contractData.arrendador_nombre ?? '',
      },
    });
    // @ts-ignore
    return await renderToBuffer(element);
  }

  /**
   * Genera PDF a partir de una plantilla DOCX personalizada (base64).
   * Pipeline: docxtemplater → DOCX relleno → mammoth → HTML → react-pdf
   */
  static async generateFromDocxTemplate(docxBase64: string, contractData: any): Promise<Buffer> {
    // 1. Decodificar base64
    const docxBuffer = Buffer.from(docxBase64, 'base64');

    // 2. Rellenar variables con docxtemplater
    // require() dinámico para no romper el tipado TS en módulos CJS
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PizZip       = require('pizzip');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Docxtemplater = require('docxtemplater');

    const zip = new PizZip(docxBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks:    true,
      delimiters:    { start: '{{', end: '}}' },
    });

    const vars = buildDocxVars(contractData);
    doc.render(vars);
    const filledBuffer: Buffer = doc.getZip().generate({ type: 'nodebuffer' });

    // 3. Convertir DOCX → HTML con mammoth
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require('mammoth');
    const { value: html } = await mammoth.convertToHtml({ buffer: filledBuffer });

    // 4. Parsear HTML → estructura de párrafos
    const paragraphs = parseMammothHtml(html);

    // 5. Renderizar PDF con react-pdf
    const element = React.createElement(ContratoPersonalizado, {
      paragraphs,
      data: {
        nombre_completo:   contractData.nombre_completo  ?? '',
        arrendador_nombre: contractData.arrendador_nombre ?? '',
      },
    });
    // @ts-ignore
    return await renderToBuffer(element);
  }
}
