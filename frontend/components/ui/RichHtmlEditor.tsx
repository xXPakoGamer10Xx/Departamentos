import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { CONTRACT_VARS } from './contractVariables';

interface Props {
  html: string;
  onChange: (html: string) => void;
  isDark: boolean;
  theme: any;
}

/**
 * Editor para nativo (APK). Edita el HTML de la plantilla como código y permite
 * insertar variables {{...}} en la posición del cursor. Compatible con el
 * pipeline de PDF del backend (mismo HTML que el editor web).
 */
export default function RichHtmlEditor({ html, onChange, isDark, theme }: Props) {
  const selection = useRef<{ start: number; end: number }>({ start: html.length, end: html.length });
  const [value, setValue] = useState(html);

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
  input: {
    borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 240,
    fontSize: 13, fontFamily: 'Courier', lineHeight: 18,
  },
});
