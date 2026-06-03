import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  useColorScheme, Platform, ActivityIndicator, Alert,
  Modal, KeyboardAvoidingView, useWindowDimensions, ScrollView,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import api from '../../../services/api';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
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

  useFocusEffect(useCallback(() => { cargar(); }, []));

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

  const getStatusVariant = (estado: string) => {
    switch (estado) {
      case 'disponible': return 'success';
      case 'ocupado': return 'primary';
      case 'mantenimiento': return 'warning';
      default: return 'default';
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

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'disponible': return theme.success;
      case 'ocupado': return theme.primary;
      case 'mantenimiento': return theme.warning;
      default: return theme.textSecondary;
    }
  };

  const { width, height } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, isDesktop && styles.headerDesktop, !isDesktop && { paddingTop: insets.top + 24 }]}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Departamentos</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Gestión de espacios y ocupación</Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.statsWrapper, isDesktop && styles.desktopStats]}>
        {isDesktop ? (
          <View style={styles.kpiContainer}>
            <GlassCard borderRadius={Theme.borderRadius.xl} padding={0}>
              <View style={[styles.kpiCard, { padding: 24 }]}>
                <View style={[styles.kpiIcon, { backgroundColor: theme.successLight }]}>
                  <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                </View>
                <View>
                  <Text style={[styles.kpiValue, { color: theme.text }]}>{stats.disponibles ?? 0}</Text>
                  <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Disponibles</Text>
                </View>
              </View>
            </GlassCard>
            
            <GlassCard borderRadius={Theme.borderRadius.xl} padding={0}>
              <View style={[styles.kpiCard, { padding: 24 }]}>
                <View style={[styles.kpiIcon, { backgroundColor: theme.primaryLight }]}>
                  <Ionicons name="business" size={24} color={theme.primary} />
                </View>
                <View>
                  <Text style={[styles.kpiValue, { color: theme.text }]}>{stats.ocupados ?? 0}</Text>
                  <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Ocupados</Text>
                </View>
              </View>
            </GlassCard>

            <GlassCard borderRadius={Theme.borderRadius.xl} padding={0}>
              <View style={[styles.kpiCard, { padding: 24 }]}>
                <View style={[styles.kpiIcon, { backgroundColor: theme.warningLight }]}>
                  <Ionicons name="construct" size={24} color={theme.warning} />
                </View>
                <View>
                  <Text style={[styles.kpiValue, { color: theme.text }]}>{stats.mantenimiento ?? 0}</Text>
                  <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Mantenimiento</Text>
                </View>
              </View>
            </GlassCard>
          </View>
        ) : (
          <GlassCard borderRadius={Theme.borderRadius.lg} padding={0}>
            <View style={styles.statsRow}>
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
          { paddingBottom: isDesktop ? 32 : insets.bottom + Theme.layout.dockHeight }
        ]}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const statusVariant = getStatusVariant(item.estado) as 'primary' | 'success' | 'warning' | 'danger' | 'default';
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
                  <Ionicons name={getStatusIcon(item.estado) as any} size={20} color={getStatusColor(item.estado)} />
                </View>
                
                <View style={{ marginBottom: Theme.spacing.md, alignSelf: 'flex-start' }}>
                  <Badge label={item.estado.toUpperCase()} variant={statusVariant} size="sm" />
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
            <View style={[styles.confirmIcon, { backgroundColor: theme.dangerLight }]}>
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
              <View style={[styles.deleteErrorBox, { backgroundColor: theme.dangerLight, borderColor: theme.danger + '40' }]}>
                <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
                <Text style={[styles.deleteErrorText, { color: theme.danger }]}>{deleteDeptoError}</Text>
              </View>
            ) : null}

            <View style={styles.confirmActions}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() => { setConfirmDepto(null); setDeleteDeptoError(''); }}
                disabled={eliminandoDepto}
                style={{ flex: 1 }}
              />
              {confirmDeptoCanDelete && (
                <Button
                  title="Eliminar"
                  variant="danger"
                  loading={eliminandoDepto}
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
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </GlassCard>
        </View>
      </Modal>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={cerrarModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <GlassCard style={styles.modalBox} borderRadius={Theme.borderRadius.xl}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Nuevo Departamento</Text>

            {/* maxHeight en píxeles explícitos — sin depender de flex dentro de GlassCard */}
            <ScrollView
              style={{ maxHeight: height * 0.88 - 260 }}
              contentContainerStyle={{ paddingBottom: 4 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Input
                label="Número *"
                placeholder="Número de Departamento"
                value={nuevoNumero}
                onChangeText={(text) => {
                  setModalError('');
                  setNuevoNumero(text.replace(/[^0-9]/g, ''));
                }}
                keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
              />

              <Input
                label="Descripción (opcional)"
                placeholder="Ej: Planta baja"
                value={nuevaDesc}
                onChangeText={setNuevaDesc}
              />

              <View style={{ marginBottom: Theme.spacing.md }}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Inventario del departamento</Text>
                <Text style={[styles.invHint, { color: theme.textSecondary }]}>
                  Agrega los artículos que tiene este departamento (muebles, electrodomésticos, etc.)
                </Text>
              </View>

              {nuevoInventario.length > 0 && (
                <GestureHandlerRootView style={[styles.invList, { borderColor: theme.border }]}>
                  <DraggableFlatList
                    data={nuevoInventario}
                    keyExtractor={(_, i) => String(i)}
                    scrollEnabled={false}
                    onDragEnd={({ data }) => setNuevoInventario(data)}
                    renderItem={({ item, getIndex, drag, isActive }: RenderItemParams<string>) => {
                      const i = getIndex() ?? 0;
                      return (
                        <ScaleDecorator>
                          <View style={[styles.invItem, i > 0 && { borderTopWidth: 0.5, borderTopColor: theme.border }, isActive && { opacity: 0.85 }]}>
                            <TouchableOpacity onLongPress={drag} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Ionicons name="reorder-three-outline" size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                            <Ionicons name="checkmark-circle-outline" size={16} color={theme.success} />
                            <Text style={[styles.invItemText, { color: theme.text }]}>{item}</Text>
                            <TouchableOpacity onPress={() => eliminarItemInv(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                          </View>
                        </ScaleDecorator>
                      );
                    }}
                  />
                </GestureHandlerRootView>
              )}

              <View style={styles.invAddRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    placeholder="Ej: Refrigerador, cama..."
                    value={nuevoItemInv}
                    onChangeText={setNuevoItemInv}
                    onSubmitEditing={agregarItemInv}
                    returnKeyType="done"
                    style={{ marginBottom: 0 }}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.invAddBtn, { backgroundColor: theme.primary }]}
                  onPress={agregarItemInv}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              {modalError ? (
                <View style={[styles.errorBox, { backgroundColor: theme.dangerLight, borderColor: theme.danger + '40' }]}>
                  <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
                  <Text style={[styles.errorText, { color: theme.danger }]}>{modalError}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={cerrarModal}
                style={{ flex: 1 }}
              />
              <Button
                title="Crear"
                variant="primary"
                onPress={handleCrear}
                loading={creando}
                style={{ flex: 1 }}
              />
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
    padding: Theme.spacing.lg,
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
  title: { fontSize: Theme.typography.display.fontSize - 4, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: Theme.typography.body.fontSize, marginTop: 2, opacity: 0.8 },
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  deptoNumber: { fontSize: 18, fontWeight: '700' },
  inquilinoText: { fontSize: 14, opacity: 0.8 },
  cardTouchable: {
    flex: 1,
  },
  deleteCardBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 500,
    padding: 24,
  },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: Theme.spacing.lg },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  invHint: { fontSize: 12, fontStyle: 'italic', marginBottom: 4 },
  invList: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  invItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  invItemText: { flex: 1, fontSize: 14 },
  invAddRow: { flexDirection: 'row', gap: 12, marginBottom: Theme.spacing.md, alignItems: 'flex-start' },
  invAddBtn: { width: 46, height: 46, borderRadius: Theme.borderRadius.md, justifyContent: 'center', alignItems: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: Theme.spacing.md },
  errorText: { flex: 1, fontSize: 13, fontWeight: '500' },
  confirmOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 24,
  },
  confirmBox: { width: '100%', maxWidth: 400, padding: 28, alignItems: 'center', gap: 16 },
  confirmIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  confirmTitle: { fontSize: 20, fontWeight: '700' },
  confirmMsg: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 },
  deleteErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, width: '100%' },
  deleteErrorText: { flex: 1, fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16, paddingTop: 8 },
});
