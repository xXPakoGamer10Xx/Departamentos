import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  useColorScheme, Platform, ActivityIndicator, Alert,
  Modal, TextInput, KeyboardAvoidingView, useWindowDimensions, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import api from '../../../services/api';
import { GlassCard } from '../../../components/ui/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';

export default function DepartamentosScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const router = useRouter();

  const [departamentos, setDepartamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({ disponibles: 0, ocupados: 0, mantenimiento: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [nuevoNumero, setNuevoNumero] = useState('');
  const [nuevaDesc, setNuevaDesc] = useState('');
  const [nuevoInventario, setNuevoInventario] = useState<string[]>([]);
  const [nuevoItemInv, setNuevoItemInv] = useState('');
  const [creando, setCreando] = useState(false);
  const [modalError, setModalError] = useState('');
  const [confirmDepto, setConfirmDepto] = useState<any>(null);
  const [confirmDeptoCanDelete, setConfirmDeptoCanDelete] = useState(false);
  const [eliminandoDepto, setEliminandoDepto] = useState(false);
  const [deleteDeptoError, setDeleteDeptoError] = useState('');

  const cargar = async () => {
    try {
      setLoading(true);
      const [dRes, sRes] = await Promise.all([
        api.getDepartamentos(),
        api.getDepartamentosStats(),
      ]);
      setDepartamentos(dRes.data || []);
      setStats(sRes.data || {});
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudieron cargar los departamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const agregarItemInv = () => {
    const item = nuevoItemInv.trim();
    if (!item) return;
    setNuevoInventario(prev => [...prev, item]);
    setNuevoItemInv('');
  };

  const eliminarItemInv = (idx: number) => {
    setNuevoInventario(prev => prev.filter((_, i) => i !== idx));
  };

  const cerrarModal = () => {
    setModalVisible(false);
    setNuevoNumero('');
    setNuevaDesc('');
    setNuevoInventario([]);
    setNuevoItemInv('');
    setModalError('');
  };

  const handleCrear = async () => {
    const numStr = nuevoNumero.trim();
    if (!numStr || isNaN(Number(numStr)) || Number(numStr) <= 0) {
      setModalError('El número de departamento es requerido y debe ser mayor a 0');
      return;
    }
    setModalError('');
    try {
      setCreando(true);
      await api.createDepartamento({
        numero: Number(numStr),
        descripcion: nuevaDesc.trim() || null,
        inventario_base: nuevoInventario,
      });
      cerrarModal();
      cargar();
    } catch (e: any) {
      setModalError(e.message || 'No se pudo crear el departamento');
    } finally {
      setCreando(false);
    }
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'disponible': return theme.success;
      case 'ocupado': return theme.primary;
      case 'mantenimiento': return theme.warning;
      default: return theme.textSecondary;
    }
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case 'disponible': return 'checkmark-circle';
      case 'ocupado': return 'person';
      case 'mantenimiento': return 'build';
      default: return 'help-circle';
    }
  };

  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#1a1a1a', '#000000'] : ['#F2F2F7', '#E5E5EA']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, isDesktop && styles.headerDesktop, !isDesktop && { paddingTop: insets.top + 20 }]}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Departamentos</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Gestión de espacios y ocupación</Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: '#007AFF' }]}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.statsWrapper, isDesktop && styles.desktopStats]}>
        {isDesktop ? (
          <View style={styles.kpiContainer}>
            <GlassCard style={styles.kpiCard} borderRadius={Theme.borderRadius.xl} padding={24}>
              <View style={[styles.kpiIcon, { backgroundColor: theme.success + '15' }]}>
                <Ionicons name="checkmark-circle" size={24} color={theme.success} />
              </View>
              <View>
                <Text style={[styles.kpiValue, { color: theme.text }]}>{stats.disponibles ?? 0}</Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Disponibles</Text>
              </View>
            </GlassCard>
            
            <GlassCard style={styles.kpiCard} borderRadius={Theme.borderRadius.xl} padding={24}>
              <View style={[styles.kpiIcon, { backgroundColor: theme.primary + '15' }]}>
                <Ionicons name="business" size={24} color={theme.primary} />
              </View>
              <View>
                <Text style={[styles.kpiValue, { color: theme.text }]}>{stats.ocupados ?? 0}</Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Ocupados</Text>
              </View>
            </GlassCard>

            <GlassCard style={styles.kpiCard} borderRadius={Theme.borderRadius.xl} padding={24}>
              <View style={[styles.kpiIcon, { backgroundColor: theme.warning + '15' }]}>
                <Ionicons name="construct" size={24} color={theme.warning} />
              </View>
              <View>
                <Text style={[styles.kpiValue, { color: theme.text }]}>{stats.mantenimiento ?? 0}</Text>
                <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Mantenimiento</Text>
              </View>
            </GlassCard>
          </View>
        ) : (
          <GlassCard style={styles.statsRow} borderRadius={Theme.borderRadius.lg}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: theme.success }]}>{stats.disponibles ?? 0}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Libres</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{stats.ocupados ?? 0}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Ocupados</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: theme.warning }]}>{stats.mantenimiento ?? 0}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Mtto.</Text>
            </View>
          </GlassCard>
        )}
      </View>

      <FlatList
        data={departamentos}
        keyExtractor={item => String(item.numero)}
        numColumns={isDesktop ? 4 : 2}
        key={isDesktop ? 'desktop' : 'mobile'}
        contentContainerStyle={[
          styles.grid,
          isDesktop && { maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: 40 },
          { paddingBottom: isDesktop ? 32 : insets.bottom + 90 }
        ]}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const statusColor = getStatusColor(item.estado);
          return (
            <GlassCard
              style={styles.card}
              borderRadius={Theme.borderRadius.lg}
              padding={isDesktop ? 24 : 16}
            >
              <TouchableOpacity
                onPress={() => router.push(`/(admin)/departamentos/${item.numero}` as any)}
                style={styles.cardTouchable}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.deptoNumber, { color: theme.text }]}>Depto {item.numero}</Text>
                  <Ionicons name={getStatusIcon(item.estado) as any} size={20} color={statusColor} />
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {item.estado.toUpperCase()}
                  </Text>
                </View>
                {item.inquilino_actual?.nombre ? (
                  <Text style={[styles.inquilinoText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.inquilino_actual.nombre}
                  </Text>
                ) : (
                  <Text style={[styles.inquilinoText, { color: theme.textSecondary, fontStyle: 'italic' }]}>
                    Sin asignar
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteCardBtn}
                onPress={() => { setDeleteDeptoError(''); setConfirmDepto(item); setConfirmDeptoCanDelete(item.estado !== 'ocupado'); }}
              >
                <Ionicons name="trash-outline" size={14} color={theme.danger} />
              </TouchableOpacity>
            </GlassCard>
          );
        }}
      />

      {/* Modal confirmación eliminar departamento */}
      <Modal visible={!!confirmDepto} transparent animationType="fade" onRequestClose={() => setConfirmDepto(null)}>
        <View style={styles.confirmOverlay}>
          <GlassCard style={styles.confirmBox} borderRadius={Theme.borderRadius.xl}>
            <View style={[styles.confirmIcon, { backgroundColor: theme.danger + '15' }]}>
              <Ionicons name="trash" size={28} color={theme.danger} />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>Eliminar Departamento</Text>
            <Text style={[styles.confirmMsg, { color: theme.textSecondary }]}>
              ¿Seguro que deseas eliminar el{'\n'}
              <Text style={{ color: theme.text, fontWeight: '700' }}>Departamento {confirmDepto?.numero}</Text>?
              {confirmDepto?.estado === 'ocupado'
                ? '\n\nEste departamento tiene un inquilino activo y no puede eliminarse.'
                : ''}
            </Text>

            {deleteDeptoError ? (
              <View style={[styles.deleteErrorBox, { backgroundColor: theme.danger + '15', borderColor: theme.danger + '40' }]}>
                <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
                <Text style={[styles.deleteErrorText, { color: theme.danger }]}>{deleteDeptoError}</Text>
              </View>
            ) : null}

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, { borderWidth: 1, borderColor: theme.border }]}
                onPress={() => { setConfirmDepto(null); setDeleteDeptoError(''); }}
                disabled={eliminandoDepto}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              {confirmDeptoCanDelete && (
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: theme.danger, opacity: eliminandoDepto ? 0.7 : 1 }]}
                  disabled={eliminandoDepto}
                  onPress={async () => {
                    setDeleteDeptoError('');
                    setEliminandoDepto(true);
                    try {
                      await api.deleteDepartamento(confirmDepto.numero);
                      setConfirmDepto(null);
                      cargar();
                    } catch (e: any) {
                      setDeleteDeptoError(e.message || 'No se pudo eliminar');
                    } finally {
                      setEliminandoDepto(false);
                    }
                  }}
                >
                  {eliminandoDepto
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '700' }}>Sí, eliminar</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={cerrarModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <GlassCard style={styles.modalBox} borderRadius={Theme.borderRadius.xl}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Nuevo Departamento</Text>

            <Text style={[styles.label, { color: theme.textSecondary }]}>Número *</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: modalError && !nuevoNumero ? theme.danger : theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
              placeholder="Número de Departamento"
              placeholderTextColor={theme.textSecondary}
              value={nuevoNumero}
              onChangeText={(text) => {
                setModalError('');
                setNuevoNumero(text.replace(/[^0-9]/g, ''));
              }}
              keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>Descripción (opcional)</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
              placeholder="Ej: Planta baja"
              placeholderTextColor={theme.textSecondary}
              value={nuevaDesc}
              onChangeText={setNuevaDesc}
            />

            <Text style={[styles.label, { color: theme.textSecondary }]}>Inventario del departamento</Text>
            <Text style={[styles.invHint, { color: theme.textSecondary }]}>
              Agrega los artículos que tiene este departamento (muebles, electrodomésticos, etc.)
            </Text>

            {nuevoInventario.length > 0 && (
              <View style={[styles.invList, { borderColor: theme.border }]}>
                {nuevoInventario.map((item, i) => (
                  <View key={i} style={[styles.invItem, i > 0 && { borderTopWidth: 0.5, borderTopColor: theme.border }]}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={theme.success} />
                    <Text style={[styles.invItemText, { color: theme.text }]}>{item}</Text>
                    <TouchableOpacity onPress={() => eliminarItemInv(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.invAddRow}>
              <TextInput
                style={[styles.invInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
                placeholder="Ej: Refrigerador, cama, estufa..."
                placeholderTextColor={theme.textSecondary}
                value={nuevoItemInv}
                onChangeText={setNuevoItemInv}
                onSubmitEditing={agregarItemInv}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.invAddBtn, { backgroundColor: theme.primary }]}
                onPress={agregarItemInv}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {modalError ? (
              <View style={[styles.errorBox, { backgroundColor: theme.danger + '15', borderColor: theme.danger + '40' }]}>
                <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>{modalError}</Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderWidth: 1, borderColor: theme.border }]}
                onPress={cerrarModal}
              >
                <Text style={{ color: theme.text }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.primary, opacity: creando ? 0.7 : 1 }]}
                onPress={handleCrear}
                disabled={creando}
              >
                {creando ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>Crear</Text>}
              </TouchableOpacity>
            </View>
          </GlassCard>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
  },
  headerDesktop: {
    paddingTop: 40,
    paddingHorizontal: 40,
    maxWidth: Theme.layout.maxWidth,
    alignSelf: 'center',
    width: '100%',
  },
  statsWrapper: {
    width: '100%',
  },
  desktopStats: {
    maxWidth: Theme.layout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  title: { fontSize: Theme.typography.display.fontSize, fontWeight: Theme.typography.display.fontWeight },
  subtitle: { fontSize: 13, marginTop: 2, opacity: 0.8 },
  addButton: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    justifyContent: 'space-around',
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  kpiCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  kpiIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.7,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: '600' },
  statDivider: { width: 1, height: '60%', alignSelf: 'center' },
  grid: { 
    paddingHorizontal: 20, 
    paddingTop: 0, 
    paddingBottom: 40,
    gap: 20 
  },
  row: { gap: 20 },
  card: { 
    flex: 1, 
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  deptoNumber: { fontSize: 18, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 16 },
  statusText: { fontSize: 11, fontWeight: '800' },
  inquilinoText: { fontSize: 14, opacity: 0.8 },
  cardTouchable: {
    flex: 1,
  },
  deleteCardBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 500,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 4 },
  invHint: { fontSize: 12, fontStyle: 'italic', marginBottom: 4 },
  invList: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 4 },
  invItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  invItemText: { flex: 1, fontSize: 14 },
  invAddRow: { flexDirection: 'row', gap: 8 },
  invInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14 },
  invAddBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13, fontWeight: '500' },
  confirmOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)', padding: 24,
  },
  confirmBox: { width: '100%', maxWidth: 400, padding: 28, alignItems: 'center', gap: 16 },
  confirmIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  confirmTitle: { fontSize: 20, fontWeight: '700' },
  confirmMsg: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 4 },
  confirmBtn: { flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  deleteErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, width: '100%' },
  deleteErrorText: { flex: 1, fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalBtn: { flex: 1, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
});

