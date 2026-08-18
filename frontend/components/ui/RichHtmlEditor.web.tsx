import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { CONTRACT_VARS } from './contractVariables';

interface Props {
  html: string;
  onChange: (html: string) => void;
  isDark: boolean;
  theme: any;
}

// Mismo subconjunto de etiquetas que entiende backend/src/services/PdfService.ts
// (parseMammothHtml/parseInline) — cualquier otra cosa que el navegador meta al
// escribir en contentEditable (span, div, style inline) se limpia antes de
// avisar al padre, para que el HTML guardado siempre sea compatible con el PDF.
const ALLOWED_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'LI', 'UL', 'OL', 'STRONG', 'B', 'EM', 'I', 'BR']);

function sanitizeNode(node: Node): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      node.removeChild(child);
      continue;
    }
    const el = child as HTMLElement;
    sanitizeNode(el);
    if (!ALLOWED_TAGS.has(el.tagName)) {
      while (el.firstChild) node.insertBefore(el.firstChild, el);
      node.removeChild(el);
    } else {
      Array.from(el.attributes).forEach(attr => el.removeAttribute(attr.name));
    }
  }
}

function sanitizeHtml(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  sanitizeNode(container);
  return container.innerHTML;
}

const TOOLBAR_ACTIONS: { label: string; command: string; value?: string }[] = [
  { label: 'B', command: 'bold' },
  { label: 'I', command: 'italic' },
  { label: 'H1', command: 'formatBlock', value: 'h1' },
  { label: 'H2', command: 'formatBlock', value: 'h2' },
  { label: 'H3', command: 'formatBlock', value: 'h3' },
  { label: 'Párrafo', command: 'formatBlock', value: 'p' },
  { label: '• Lista', command: 'insertUnorderedList' },
];

/**
 * Editor visual (WYSIWYG) para web — contentEditable real con barra de
 * herramientas. En nativo (APK) no hay equivalente sin WebView, por lo que
 * ese caso usa RichHtmlEditor.native.tsx (Expo resuelve el archivo correcto
 * automáticamente por plataforma).
 */
export default function RichHtmlEditor({ html, onChange, isDark, theme }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = html;
      initialized.current = true;
    }
  }, [html]);

  useEffect(() => {
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* no-op */ }
  }, []);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  }, []);

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    const clean = sanitizeHtml(editorRef.current.innerHTML);
    onChange(clean);
  }, [onChange]);

  const exec = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    emitChange();
  }, [restoreSelection, emitChange]);

  const insertVar = useCallback((key: string) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand('insertText', false, `{{${key}}}`);
    emitChange();
  }, [restoreSelection, emitChange]);

  return (
    <View>
      <Text style={[styles.label, { color: theme.textSecondary }]}>Insertar variable:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CONTRACT_VARS.map(v => (
          <TouchableOpacity key={v.key} style={styles.chip} onPress={() => insertVar(v.key)}>
            <Text style={styles.chipText}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[styles.label, { color: theme.textSecondary, marginTop: 10 }]}>Formato:</Text>
      <View style={styles.toolbar}>
        {TOOLBAR_ACTIONS.map(a => (
          <TouchableOpacity
            key={a.label}
            style={[styles.toolBtn, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }]}
            // @ts-ignore — onMouseDown existe en RN Web aunque no esté tipado en TouchableOpacityProps
            onMouseDown={(e: any) => e.preventDefault()}
            onPress={() => exec(a.command, a.value)}
          >
            <Text style={[styles.toolBtnText, { color: theme.text }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: theme.textSecondary, marginTop: 10 }]}>
        Contenido del contrato:
      </Text>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onBlur={saveSelection}
        style={{
          minHeight: 280,
          maxHeight: 480,
          overflowY: 'auto',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
          borderRadius: 12,
          padding: 14,
          fontSize: 14,
          lineHeight: 1.5,
          color: theme.text,
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          outline: 'none',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  chips: { gap: 6, paddingRight: 8 },
  chip: {
    borderWidth: 1, borderColor: '#7C3AED40', backgroundColor: '#7C3AED12',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  chipText: { color: '#7C3AED', fontSize: 11, fontWeight: '700' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  toolBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  toolBtnText: { fontSize: 12, fontWeight: '700' },
});
