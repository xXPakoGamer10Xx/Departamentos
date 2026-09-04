import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  useColorScheme, Platform, ActivityIndicator, Alert,
  Modal, KeyboardAvoidingView, useWindowDimensions, ScrollView, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import api from '../../../services/api';
import { SurfaceCard } from '../../../components/ui/SurfaceCard';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { LinearGradient } from 'expo-linear-gradient';

export default function DepartamentosScreen() {
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const router = useRouter();

  const [departamentos, setDepartamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({ disponibles: 0, ocupados: 0, mantenimiento: 0, total: 0 });
  const [filtroPiso, setFiltroPiso] = useState('Todos');
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
  const nuevoItemInvRef = useRef<TextInput>(null);

  const { width, height } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  const cargar = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const [dRes, sRes] = await Promise.all([
        api.getDepartamentos(),
        api.getDepartamentosStats(),
      ]);
      setDepartamentos(dRes.data || []);
      setStats(sRes.data || {});
    } catch (e: any) {
      if (showLoader) Alert.alert('Error', e.message || 'No se pudieron cargar los departamentos');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { cargar(); }, []));
  useEffect(() => {
    const interval = setInterval(() => cargar(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const agregarItemInv = () => {
    const item = nuevoItemInv.trim();
    if (!item) return;
    setNuevoInventario(prev => [...prev, item]);
    setNuevoItemInv('');
    setTimeout(() => nuevoItemInvRef.current?.focus(), 50);
  };
  const eliminarItemInv = (idx: number) => setNuevoInventario(prev => prev.filter((_, i) => i !== idx));

  const cerrarModal = () => {
    setModalVisible(false);
    setNuevoNumero(''); setNuevaDesc(''); setNuevoInventario([]); setNuevoItemInv(''); setModalError('');
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
      await api.createDepartamento({ numero: Number(numStr), descripcion: nuevaDesc.trim() || null, inventario_base: nuevoInventario });
      cerrarModal();
      cargar();
    } catch (e: any) {
      setModalError(e.message || 'No se pudo crear el departamento');
    } finally {
      setCreando(false);
    }
  };

  const pisoDe = (numero: number) => {
    const n = Number(numero);
    return Number.isFinite(n) && n >= 100 ? Math.floor(n / 100) : null;
  };

  const estadoCfg = (estado: string) => {
    switch (estado) {
      case 'disponible': return { label: 'Disponible', variant: 'success' as const, color: theme.success };
      case 'ocupado': return { label: 'Ocupado', variant: 'primary' as const, color: theme.primary };
      case 'mantenimiento': return { label: 'Mantenimiento', variant: 'warning' as const, color: theme.warning };
      default: return { label: estado, variant: 'default' as const, color: theme.textSecondary };
    }
  };

  const pisos = useMemo(() => {
    const set = new Set<number>();
    departamentos.forEach(d => { const p = pisoDe(d.numero); if (p != null) set.add(p); });
    return ['Todos', ...[...set].sort((a, b) => a - b).map(p => `Piso ${p}`)];
  }, [departamentos]);

  const total = stats.total ?? departamentos.length;
  const pctOcup = total > 0 ? Math.round(((stats.ocupados ?? 0) / total) * 100) : 0;

  const numColumns = isDesktop ? 4 : 2;
  const filteredRaw = departamentos.filter(d => {
    if (filtroPiso === 'Todos') return true;
    return `Piso ${pisoDe(d.numero)}` === filtroPiso;
  });
  const filtered = useMemo(() => {
    if (filteredRaw.length === 0) return filteredRaw;
    const rem = filteredRaw.length % numColumns;
    if (rem === 0) return filteredRaw;
    return [...filteredRaw, ...Array.from({ length: numColumns - rem }, (_, i) => ({ _spacer: true, numero: `s${i}` }))];
  }, [filteredRaw, numColumns]);

  const fmtRenta = (n: any) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });

  const paddingBottom = isDesktop ? 32 : insets.bottom + Theme.layout.dockHeight;

  if (loading && departamentos.length === 0) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient colors={isDark ? ['#0E1321', '#1A1F2E'] : ['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const listHeader = (
    <View style={[styles.header, isDesktop && styles.headerDesktop, !isDesktop && { paddingTop: insets.top + 20 }]}>
      <View style={styles.headerTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Departamentos</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Gestión de unidades y estado de ocupación</Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color="#fff" />
          {isDesktop && <Text style={styles.addButtonText}>Nuevo Departamento</Text>}
        </TouchableOpacity>
      </View>

      {/* Chips de resumen */}
      <View style={styles.chipsRow}>
        <View style={[styles.chip, { borderColor: theme.border }]}>
          <Text style={[styles.chipLabel, { color: theme.textMuted }]}>TOTAL</Text>
          <Text style={[styles.chipValue, { color: theme.text }]}>{total}</Text>
        </View>
        {[
          { label: 'OCUPADOS', val: `${stats.ocupados ?? 0} (${pctOcup}%)`, color: theme.primary },
          { label: 'DISPONIBLES', val: String(stats.disponibles ?? 0), color: theme.success },
          { label: 'MANTENIMIENTO', val: String(stats.mantenimiento ?? 0), color: theme.warning },
        ].map(c => (
          <View key={c.label} style={[styles.chip, { borderColor: theme.border, borderLeftColor: c.color, borderLeftWidth: 3 }]}>
            <View style={[styles.chipDot, { backgroundColor: c.color }]} />
            <Text style={[styles.chipLabel, { color: theme.textMuted }]}>{c.label}</Text>
            <Text style={[styles.chipValue, { color: c.color }]}>{c.val}</Text>
          </View>
        ))}
      </View>

      {/* Tabs de piso */}
      {pisos.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}
          style={{ borderBottomWidth: 1, borderBottomColor: theme.border }}>
          {pisos.map(tab => {
            const active = filtroPiso === tab;
            return (
              <TouchableOpacity key={tab} style={styles.tab} onPress={() => setFiltroPiso(tab)} activeOpacity={0.7}>
                <Text style={[styles.tabText, { color: active ? theme.primary : theme.textSecondary }]}>{tab}</Text>
                {active && <View style={[styles.tabUnderline, { backgroundColor: theme.primary }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  const renderCard = ({ item }: { item: any }) => {
    if (item._spacer) return <View style={{ flex: 1 }} />;
    const cfg = estadoCfg(item.estado);
    const piso = pisoDe(item.numero);
    const invCount = Array.isArray(item.inventario_base) ? item.inventario_base.length : 0;
    return (
      <SurfaceCard style={[styles.card, cfg.variant !== 'default' && { borderColor: cfg.color + '33' }]} padding={0}>
        <TouchableOpacity
          onPress={() => router.push(`/(admin)/departamentos/${item.numero}` as any)}
          activeOpacity={0.8}
          style={{ padding: 16, flex: 1 }}
        >
          <View style={styles.cardHead}>
            <View>
              <Text style={[styles.deptoNumber, { color: theme.text }]}>Depto {item.numero}</Text>
              {piso != null && <Text style={[styles.deptoPiso, { color: theme.textMuted }]}>PISO {piso}</Text>}
            </View>
            <Badge label={cfg.label} variant={cfg.variant} size="sm" />
          </View>

          <View style={styles.cardBody}>
            {item.estado === 'ocupado' ? (
              <>
                <Text style={[styles.bodyLabel, { color: theme.textMuted }]}>INQUILINO ACTUAL</Text>
                <View style={styles.inqRow}>
                  <Ionicons name="person" size={13} color={theme.textSecondary} />
                  <Text style={[styles.inqName, { color: theme.text }]} numberOfLines={1}>
                    {item.inquilino_actual?.nombre || 'Sin nombre'}
                  </Text>
                </View>
                {item.inquilino_actual?.renta != null && (
                  <Text style={[styles.rentaText, { color: theme.textSecondary }]}>{fmtRenta(item.inquilino_actual.renta)}/mes</Text>
                )}
              </>
            ) : item.estado === 'disponible' ? (
              <>
                <View style={styles.readyRow}>
                  <Ionicons name="flash" size={13} color={theme.primary} />
                  <Text style={[styles.bodyLabel, { color: theme.primary }]}>LISTO PARA HABITAR</Text>
                </View>
                <Text style={[styles.descText, { color: theme.textSecondary }]} numberOfLines={2}>
                  {item.descripcion || 'Unidad disponible para asignar a un nuevo inquilino.'}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.bodyLabel, { color: theme.warning }]}>EN MANTENIMIENTO</Text>
                <Text style={[styles.descText, { color: theme.textSecondary }]} numberOfLines={2}>
                  {item.descripcion || 'Unidad temporalmente fuera de servicio.'}
                </Text>
              </>
            )}
          </View>

          <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

          <View style={styles.cardFoot}>
            <View style={styles.invChip}>
              <Ionicons name="cube-outline" size={12} color={theme.textMuted} />
              <Text style={[styles.invText, { color: theme.textSecondary }]}>
                {invCount > 0 ? `${invCount} artículo${invCount !== 1 ? 's' : ''}` : 'Sin inventario'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                onPress={() => { setDeleteDeptoError(''); setConfirmDepto(item); setConfirmDeptoCanDelete(item.estado !== 'ocupado'); }}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={13} color={theme.textMuted} />
              </TouchableOpacity>
              <Text style={[styles.verFicha, { color: theme.primary }]}>Ver ficha →</Text>
            </View>
          </View>
        </TouchableOpacity>
      </SurfaceCard>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={isDark ? ['#0E1321', '#1A1F2E'] : ['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFill} />

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.numero)}
        numColumns={numColumns}
        key={isDesktop ? 'desktop' : 'mobile'}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.grid,
          isDesktop && { maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: 40 },
          { paddingBottom },
        ]}
        columnWrapperStyle={styles.rowGap}
        showsVerticalScrollIndicator={false}
        renderItem={renderCard}
        ListEmptyComponent={
          <SurfaceCard style={{ alignItems: 'center', paddingVertical: 44, marginHorizontal: 20 }}>
            <Ionicons name="business-outline" size={40} color={theme.textMuted} />
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 10 }}>
              {filtroPiso === 'Todos' ? 'Aún no hay departamentos' : `Sin departamentos en ${filtroPiso}`}
            </Text>
          </SurfaceCard>
        }
      />

      {/* Modal confirmación eliminar */}
      <Modal visible={!!confirmDepto} transparent animationType="fade" onRequestClose={() => setConfirmDepto(null)}>
        <View style={styles.confirmOverlay}>
          <SurfaceCard style={styles.confirmBox} borderRadius={Theme.borderRadius.xl}>
            <View style={[styles.confirmIcon, { backgroundColor: theme.dangerLight }]}>
              <Ionicons name="trash" size={28} color={theme.danger} />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>Eliminar Departamento</Text>
            <Text style={[styles.confirmMsg, { color: theme.textSecondary }]}>
              ¿Seguro que deseas eliminar el{'\n'}
              <Text style={{ color: theme.text, fontWeight: '700' }}>Departamento {confirmDepto?.numero}</Text>?
              {confirmDepto?.estado === 'ocupado' ? '\n\nEste departamento tiene un inquilino activo y no puede eliminarse.' : ''}
            </Text>
            {deleteDeptoError ? (
              <View style={[styles.deleteErrorBox, { backgroundColor: theme.dangerLight, borderColor: theme.danger + '40' }]}>
                <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
                <Text style={[styles.deleteErrorText, { color: theme.danger }]}>{deleteDeptoError}</Text>
              </View>
            ) : null}
            <View style={styles.confirmActions}>
              <Button title="Cancelar" variant="outline" onPress={() => { setConfirmDepto(null); setDeleteDeptoError(''); }} disabled={eliminandoDepto} style={{ flex: 1 }} />
              {confirmDeptoCanDelete && (
                <Button
                  title="Eliminar" variant="danger" loading={eliminandoDepto}
                  onPress={async () => {
                    setDeleteDeptoError(''); setEliminandoDepto(true);
                    try {
                      await api.deleteDepartamento(confirmDepto.numero);
                      setConfirmDepto(null); cargar();
                    } catch (e: any) { setDeleteDeptoError(e.message || 'No se pudo eliminar'); }
                    finally { setEliminandoDepto(false); }
                  }}
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </SurfaceCard>
        </View>
      </Modal>

      {/* Modal nuevo departamento */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={cerrarModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <SurfaceCard style={styles.modalBox} borderRadius={Theme.borderRadius.xl}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Nuevo Departamento</Text>
            <ScrollView style={{ maxHeight: height * 0.88 - 260 }} contentContainerStyle={{ paddingBottom: 4 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Input
                label="Número *" placeholder="Número de Departamento" value={nuevoNumero}
                onChangeText={(text) => { setModalError(''); setNuevoNumero(text.replace(/[^0-9]/g, '')); }}
                keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
              />
              <Input label="Descripción (opcional)" placeholder="Ej: Planta baja" value={nuevaDesc} onChangeText={setNuevaDesc} />
              <View style={{ marginBottom: Theme.spacing.md }}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Inventario del departamento</Text>
                <Text style={[styles.invHint, { color: theme.textSecondary }]}>Agrega los artículos que tiene este departamento (muebles, electrodomésticos, etc.)</Text>
              </View>
              {nuevoInventario.length > 0 && (
                <View style={[styles.invList, { borderColor: theme.border }]}>
                  {nuevoInventario.map((item, i) => (
                    <View key={i} style={[styles.invItem, i > 0 && { borderTopWidth: 0.5, borderTopColor: theme.border }]}>
                      <View style={{ flexDirection: 'column' }}>
                        <TouchableOpacity onPress={() => i > 0 && setNuevoInventario(prev => { const a = [...prev]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; })} hitSlop={{ top: 4, bottom: 2, left: 6, right: 6 }}>
                          <Ionicons name="chevron-up" size={14} color={i === 0 ? 'transparent' : theme.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => i < nuevoInventario.length - 1 && setNuevoInventario(prev => { const a = [...prev]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; })} hitSlop={{ top: 2, bottom: 4, left: 6, right: 6 }}>
                          <Ionicons name="chevron-down" size={14} color={i === nuevoInventario.length - 1 ? 'transparent' : theme.textSecondary} />
                        </TouchableOpacity>
                      </View>
                      <Ionicons name="checkmark-circle-outline" size={16} color={theme.success} />
                      <Text style={[styles.invItemText, { color: theme.text }]}>{item}</Text>
                      <TouchableOpacity onPress={() => eliminarItemInv(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.invAddRow}>
                <View style={{ flex: 1 }}>
                  <Input ref={nuevoItemInvRef} placeholder="Ej: Refrigerador, cama..." value={nuevoItemInv} onChangeText={setNuevoItemInv} onSubmitEditing={agregarItemInv} returnKeyType="next" blurOnSubmit={false} style={{ marginBottom: 0 }} />
                </View>
                <TouchableOpacity style={[styles.invAddBtn, { backgroundColor: theme.primary }]} onPress={agregarItemInv}>
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
              <Button title="Cancelar" variant="outline" onPress={cerrarModal} style={{ flex: 1 }} />
              <Button title="Crear" variant="primary" onPress={handleCrear} loading={creando} style={{ flex: 1 }} />
            </View>
          </SurfaceCard>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.md, gap: Theme.spacing.md },
  headerDesktop: { maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: 40, paddingTop: 24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 7, height: 40, paddingHorizontal: 14,
    borderRadius: Theme.borderRadius.md, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5 },
  chipValue: { fontSize: 12.5, fontWeight: '800', fontVariant: ['tabular-nums'] },

  tabRow: { gap: 4, alignItems: 'flex-end' },
  tab: { paddingHorizontal: 14, paddingVertical: 10, position: 'relative' },
  tabText: { fontSize: 13, fontWeight: '600' },
  tabUnderline: { position: 'absolute', left: 14, right: 14, bottom: -1, height: 2, borderRadius: 1 },

  grid: { paddingTop: 4, gap: 12 },
  rowGap: { gap: 12 },
  card: { flex: 1, overflow: 'hidden', minHeight: 168 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  deptoNumber: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  deptoPiso: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  cardBody: { flex: 1, gap: 5 },
  bodyLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  inqRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  inqName: { fontSize: 13, fontWeight: '600', flex: 1 },
  rentaText: { fontSize: 12, fontWeight: '600' },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  descText: { fontSize: 12, lineHeight: 16 },
  cardDivider: { height: 1, marginVertical: 12 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  invText: { fontSize: 10.5, fontWeight: '600' },
  verFicha: { fontSize: 11, fontWeight: '700' },
  deleteBtn: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 },
  modalBox: { width: '100%', maxWidth: 500, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: Theme.spacing.lg },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  invHint: { fontSize: 12, fontStyle: 'italic', marginBottom: 4 },
  invList: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  invItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  invItemText: { flex: 1, fontSize: 14 },
  invAddRow: { flexDirection: 'row', gap: 12, marginBottom: Theme.spacing.md, alignItems: 'flex-start' },
  invAddBtn: { width: 46, height: 46, borderRadius: Theme.borderRadius.md, justifyContent: 'center', alignItems: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: Theme.spacing.md },
  errorText: { flex: 1, fontSize: 13, fontWeight: '500' },
  confirmOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 },
  confirmBox: { width: '100%', maxWidth: 400, padding: 28, alignItems: 'center', gap: 16 },
  confirmIcon: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  confirmTitle: { fontSize: 19, fontWeight: '800' },
  confirmMsg: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 },
  deleteErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, width: '100%' },
  deleteErrorText: { flex: 1, fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16, paddingTop: 8 },
});
