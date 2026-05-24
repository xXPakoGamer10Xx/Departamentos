import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator, Alert, TextInput, Platform, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import api from '../../../services/api';

export default function DepartamentoDetailScreen() {
  const { numero } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [depto, setDepto] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inventario, setInventario] = useState<string[]>([]);
  const [nuevoItem, setNuevoItem] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.getDepartamentoByNumero(Number(numero))
      .then(r => {
        setDepto(r.data);
        const inv = r.data?.inventario_base;
        setInventario(Array.isArray(inv) ? inv : []);
      })
      .catch(e => Alert.alert('Error', e.message || 'No se pudo cargar el departamento'))
      .finally(() => setLoading(false));
  }, [numero]);

  const agregarItem = () => {
    const item = nuevoItem.trim();
    if (!item) return;
    setInventario(prev => [...prev, item]);
    setNuevoItem('');
  };

  const eliminarItem = (idx: number) => {
    setInventario(prev => prev.filter((_, i) => i !== idx));
  };

  const guardar = async () => {
    try {
      setGuardando(true);
      await api.updateDepartamento(Number(numero), { inventario_base: inventario });
      Alert.alert('Guardado', 'Inventario actualizado correctamente');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!depto) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Departamento no encontrado</Text>
      </View>
    );
  }

  const estadoColor: Record<string, string> = {
    disponible: theme.success,
    ocupado: theme.primary,
    mantenimiento: theme.warning,
  };

  const color = estadoColor[depto.estado] || theme.textSecondary;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={{ paddingBottom: isDesktop ? 32 : insets.bottom + 90 }}>
      <View style={[styles.headerRow, !isDesktop && { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Departamento {depto.numero}</Text>
        {depto.estado !== 'ocupado' && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => Alert.alert(
              'Eliminar Departamento',
              `¿Seguro que deseas eliminar el Departamento ${depto.numero}?`,
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Eliminar', style: 'destructive',
                  onPress: async () => {
                    try {
                      await api.deleteDepartamento(Number(numero));
                      router.back();
                    } catch (e: any) {
                      Alert.alert('Error', e.message || 'No se pudo eliminar');
                    }
                  },
                },
              ]
            )}
          >
            <Ionicons name="trash-outline" size={22} color={theme.danger} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.badge, { backgroundColor: color + '20' }]}>
          <Text style={[styles.badgeText, { color }]}>
            {depto.estado.charAt(0).toUpperCase() + depto.estado.slice(1)}
          </Text>
        </View>
        {depto.descripcion ? (
          <Text style={[styles.desc, { color: theme.textSecondary }]}>{depto.descripcion}</Text>
        ) : null}
        {depto.ubicacion ? (
          <Text style={[styles.desc, { color: theme.textSecondary }]}>{depto.ubicacion}</Text>
        ) : null}
      </View>

      {depto.inquilino_actual?.nombre ? (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>INQUILINO ACTUAL</Text>
          <Text style={[styles.nombre, { color: theme.text }]}>{depto.inquilino_actual.nombre}</Text>
          <Text style={[styles.desc, { color: theme.textSecondary }]}>Renta: ${depto.inquilino_actual.renta}</Text>
          {depto.inquilino_actual.tel ? (
            <Text style={[styles.desc, { color: theme.textSecondary }]}>Tel: {depto.inquilino_actual.tel}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>INVENTARIO BASE</Text>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Artículos incluidos al momento de arrendar este departamento.
        </Text>

        {inventario.map((item, i) => (
          <View key={i} style={styles.itemRow}>
            <Ionicons name="checkmark-circle-outline" size={18} color={theme.success} />
            <Text style={[styles.itemText, { color: theme.text }]}>{item}</Text>
            <TouchableOpacity onPress={() => eliminarItem(i)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color={theme.danger} />
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            placeholder="Agregar artículo..."
            placeholderTextColor={theme.textSecondary}
            value={nuevoItem}
            onChangeText={setNuevoItem}
            onSubmitEditing={agregarItem}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.primary }]}
            onPress={agregarItem}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: theme.success, opacity: guardando ? 0.7 : 1 }]}
          onPress={guardar}
          disabled={guardando}
        >
          {guardando ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Guardar Inventario</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {depto.historial_inquilinos?.length > 0 ? (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>HISTORIAL</Text>
          {depto.historial_inquilinos.map((h: any, i: number) => (
            <View key={i} style={styles.historialRow}>
              <Text style={[styles.historialNombre, { color: theme.text }]}>{h.nombre}</Text>
              <Text style={[styles.desc, { color: theme.textSecondary }]}>
                {h.fecha_inicio ? new Date(h.fecha_inicio).toLocaleDateString('es-MX') : '?'} —{' '}
                {h.fecha_termino ? new Date(h.fecha_termino).toLocaleDateString('es-MX') : '?'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, paddingTop: Platform.OS === 'web' ? 24 : 56, gap: 12,
  },
  backBtn: { padding: 4 },
  deleteBtn: { marginLeft: 'auto' as any, padding: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  card: { margin: 16, marginTop: 0, padding: 16, borderRadius: 16, borderWidth: 1, gap: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  desc: { fontSize: 14 },
  hint: { fontSize: 12, fontStyle: 'italic', marginBottom: 8 },
  nombre: { fontSize: 16, fontWeight: '600' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  itemText: { flex: 1, fontSize: 14 },
  deleteBtn: { padding: 4 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  addBtn: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 46, borderRadius: 12, gap: 8, marginTop: 12,
  },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  historialRow: { paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0' },
  historialNombre: { fontSize: 14, fontWeight: '500' },
});
