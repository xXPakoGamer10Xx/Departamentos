import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { CONTRACT_VARS } from './contractVariables';
import { HtmlPreview } from '../../utils/renderHtmlPreview';

interface Props {
  html: string;
  onChange: (html: string) => void;
  isDark: boolean;
  theme: any;
}

const WRAP_ACTIONS: { label: string; open: string; close: string }[] = [
  { label: 'B', open: '<strong>', close: '</strong>' },
  { label: 'I', open: '<em>', close: '</em>' },
  { label: 'H1', open: '<h1>', close: '</h1>' },
  { label: 'H2', open: '<h2>', close: '</h2>' },
  { label: 'H3', open: '<h3>', close: '</h3>' },
  { label: 'P', open: '<p>', close: '</p>' },
  { label: '• Ítem', open: '<li>', close: '</li>' },
];

/**
 * Editor para nativo (APK). El WYSIWYG real (contentEditable) solo existe en
 * web — en React Native no hay equivalente sin WebView. Aquí se edita el HTML
 * como texto, pero con botones que envuelven la selección actual en la
 * etiqueta correspondiente, más una vista previa que renderiza el resultado
 * como documento real, para que se sienta como editar un documento y no código.
 */
export default function RichHtmlEditor({ html, onChange, isDark, theme }: Props) {
  const selection = useRef<{ start: number; end: number }>({ start: html.length, end: html.length });
  const [value, setValue] = useState(html);
  const [showPreview, setShowPreview] = useState(false);

  const update = (next: string) => {
    setValue(next);
    onChange(next);
  };

  const insertVar = (key: string) => {
    const token = `{{${key}}}`;
    const { start, end } = selection.current;
    const next = value.slice(0, start) + token + value.slice(end);
    const pos = start + token.length;
    selection.current = { start: pos, end: pos };
    update(next);
  };

  const wrapSelection = (open: string, close: string) => {
    const { start, end } = selection.current;
    if (start === end) {
      // Sin texto seleccionado: insertar un bloque vacío en la posición del cursor
      const next = value.slice(0, start) + open + close + value.slice(end);
      const pos = start + open.length;
      selection.current = { start: pos, end: pos };
      update(next);
      return;
    }
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + open + selected + close + value.slice(end);
    selection.current = { start, end: start + open.length + selected.length + close.length };
    update(next);
  };

  return (
    <View>
      <Text style={[styles.label, { color: theme.textSecondary }]}>Insertar variable:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CONTRACT_VARS.map(v => (
          <TouchableOpacity
            key={v.key}
            style={styles.chip}
            onPress={() => insertVar(v.key)}
          >
            <Text style={styles.chipText}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[styles.label, { color: theme.textSecondary, marginTop: 10 }]}>
        Formato (selecciona texto y toca un botón):
      </Text>
      <View style={styles.toolbar}>
        {WRAP_ACTIONS.map(a => (
          <TouchableOpacity
            key={a.label}
            style={[styles.toolBtn, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }]}
            onPress={() => wrapSelection(a.open, a.close)}
          >
            <Text style={[styles.toolBtnText, { color: theme.text }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.toolBtn, { borderColor: theme.primary, backgroundColor: showPreview ? theme.primary : 'transparent' }]}
          onPress={() => setShowPreview(v => !v)}
        >
          <Text style={[styles.toolBtnText, { color: showPreview ? '#fff' : theme.primary }]}>
            {showPreview ? 'Ver código' : 'Ver vista previa'}
          </Text>
        </TouchableOpacity>
      </View>

      {showPreview ? (
        <View style={[styles.previewBox, {
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
        }]}>
          <HtmlPreview html={value} textColor={theme.text} mutedColor={theme.textSecondary} />
        </View>
      ) : (
        <>
          <Text style={[styles.label, { color: theme.textSecondary, marginTop: 10 }]}>
            Contenido del contrato (HTML):
          </Text>
          <TextInput
            style={[styles.input, {
              color: theme.text,
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            }]}
            value={value}
            onChangeText={update}
            onSelectionChange={e => { selection.current = e.nativeEvent.selection; }}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      )}
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
  previewBox: { borderWidth: 1, borderRadius: 12, minHeight: 240 },
  input: {
    borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 240,
    fontSize: 13, fontFamily: 'Courier', lineHeight: 18,
  },
});
