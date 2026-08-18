import React from 'react';
import { View, Text } from 'react-native';

// Vista previa simplificada del HTML de la plantilla de contrato, para verse
// como documento real en el editor nativo (sin WebView). Entiende exactamente
// el mismo subconjunto de etiquetas que backend/src/services/PdfService.ts
// (parseMammothHtml/parseInline), para que lo que se ve aquí se parezca al PDF.

interface TextSegment { text: string; bold?: boolean; italic?: boolean }
interface ParsedBlock { level: 'p' | 'h1' | 'h2' | 'h3' | 'li'; segments: TextSegment[] }

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

export function parseHtmlBlocks(html: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const blockRe = /<(p|h1|h2|h3|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase() as ParsedBlock['level'];
    const segments = parseInline(m[2]);
    if (segments.length > 0) blocks.push({ level: tag, segments });
  }
  return blocks;
}

export function HtmlPreview({ html, textColor, mutedColor }: { html: string; textColor: string; mutedColor: string }) {
  const blocks = parseHtmlBlocks(html);

  if (blocks.length === 0) {
    return (
      <View style={{ padding: 14 }}>
        <Text style={{ color: mutedColor, fontStyle: 'italic', fontSize: 13 }}>
          Sin contenido reconocible aún — escribe usando párrafos, encabezados o negritas/cursivas arriba.
        </Text>
      </View>
    );
  }

  const sizeByLevel: Record<ParsedBlock['level'], number> = { h1: 20, h2: 17, h3: 15, p: 14, li: 14 };

  return (
    <View style={{ padding: 14, gap: 8 }}>
      {blocks.map((b, i) => (
        <Text
          key={i}
          style={{
            color: textColor,
            fontSize: sizeByLevel[b.level],
            fontWeight: b.level === 'h1' || b.level === 'h2' || b.level === 'h3' ? '800' : '400',
            lineHeight: sizeByLevel[b.level] * 1.4,
          }}
        >
          {b.level === 'li' && '•  '}
          {b.segments.map((s, j) => (
            <Text key={j} style={{ fontWeight: s.bold ? '800' : undefined, fontStyle: s.italic ? 'italic' : undefined }}>
              {s.text}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}
