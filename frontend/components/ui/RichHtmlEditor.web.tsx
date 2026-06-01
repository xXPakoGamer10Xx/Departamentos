import React, { useEffect, useRef } from 'react';
import { CONTRACT_VARS } from './contractVariables';

interface Props {
  html: string;
  onChange: (html: string) => void;
  isDark: boolean;
  theme: any;
}

/**
 * Editor enriquecido para web (contentEditable + execCommand).
 * Permite negritas/itálica/encabezados/listas e insertar variables {{...}}.
 * Edita y devuelve HTML compatible con el pipeline de PDF del backend.
 */
export default function RichHtmlEditor({ html, onChange, isDark, theme }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastHtml = useRef<string>('');

  // Sincroniza el HTML externo solo cuando cambia desde fuera (evita saltos de cursor).
  useEffect(() => {
    if (ref.current && html !== lastHtml.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = html || '';
      lastHtml.current = html || '';
    }
  }, [html]);

  const emit = () => {
    if (!ref.current) return;
    const value = ref.current.innerHTML;
    lastHtml.current = value;
    onChange(value);
  };

  const exec = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    emit();
  };

  const insertVar = (key: string) => {
    ref.current?.focus();
    document.execCommand('insertText', false, `{{${key}}}`);
    emit();
  };

  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  const toolBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const btnStyle: React.CSSProperties = {
    border: `1px solid ${border}`, background: toolBg, color: theme.text,
    borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  };

  return (
    <div>
      {/* Toolbar de formato */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        <button type="button" style={{ ...btnStyle, fontWeight: 800 }} onMouseDown={e => { e.preventDefault(); exec('bold'); }}>B</button>
        <button type="button" style={{ ...btnStyle, fontStyle: 'italic' }} onMouseDown={e => { e.preventDefault(); exec('italic'); }}>I</button>
        <button type="button" style={{ ...btnStyle, textDecoration: 'underline' }} onMouseDown={e => { e.preventDefault(); exec('underline'); }}>U</button>
        <button type="button" style={btnStyle} onMouseDown={e => { e.preventDefault(); exec('formatBlock', 'H2'); }}>Título</button>
        <button type="button" style={btnStyle} onMouseDown={e => { e.preventDefault(); exec('formatBlock', 'P'); }}>Párrafo</button>
        <button type="button" style={btnStyle} onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList'); }}>• Lista</button>
        <button type="button" style={btnStyle} onMouseDown={e => { e.preventDefault(); exec('justifyLeft'); }}>⯇</button>
        <button type="button" style={btnStyle} onMouseDown={e => { e.preventDefault(); exec('justifyFull'); }}>☰</button>
      </div>

      {/* Variables insertables */}
      <div style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>Insertar variable:</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {CONTRACT_VARS.map(v => (
          <button
            key={v.key}
            type="button"
            style={{ border: '1px solid #7C3AED40', background: '#7C3AED12', color: '#7C3AED', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
            onMouseDown={e => { e.preventDefault(); insertVar(v.key); }}
            title={`{{${v.key}}}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Área editable */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        style={{
          border: `1px solid ${border}`,
          borderRadius: 12,
          padding: 16,
          minHeight: 280,
          maxHeight: 420,
          overflowY: 'auto',
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
          color: isDark ? '#E5E7EB' : '#111',
          fontSize: 14,
          lineHeight: 1.6,
          outline: 'none',
        }}
      />
    </div>
  );
}
