import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  useColorScheme, useWindowDimensions, ActivityIndicator, Modal, TextInput, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SurfaceCard } from '../../../components/ui/SurfaceCard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../services/api';

interface Inquilino {
  id: number | string;
  nombre_completo: string;
  depto_numero: string | number;
  renta: number | string;
  estado: 'activo' | 'inactivo' | string;
  [key: string]: any;
}

export default function InquilinosListScreen() {
  const [search, setSearch] = useState('');
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<'activo' | 'inactivo'>('activo');
  const filtroRef = useRef(filtroEstado);
  const [confirmItem, setConfirmItem] = useState<Inquilino | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  const cargar = async (estado: 'activo' | 'inactivo' = filtroRef.current) => {
    try {
      setLoading(true);
      const res = await api.getInquilinos({ estado });
      setInquilinos(res.data || []);
    } catch {
      // error ya manejado por el API service
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { cargar(filtroRef.current); }, []));

  useEffect(() => {
    filtroRef.current = filtroEstado;
    cargar(filtroEstado);
  }, [filtroEstado]);

  const confirmarDarDeBaja = async () => {
    if (!confirmItem) return;
    setDeleteError('');
    setEliminando(true);
    try {
      await api.deleteInquilino(String(confirmItem.id));
      setConfirmItem(null);
      cargar(filtroRef.current);
    } catch (e: any) {
      setDeleteError(e.message || 'No se pudo dar de baja al inquilino');
    } finally {
      setEliminando(false);
    }
  };

  const filtered = inquilinos.filter(i =>
    i.nombre_completo?.toLowerCase().includes(search.toLowerCase()) ||
    String(i.depto_numero).includes(search) ||
    (i.tel_arrendatario || i.telefono || '').includes(search)
  );

  const metrics = useMemo(() => {
    const n = inquilinos.length;
    const avg = n > 0 ? inquilinos.reduce((a, c) => a + Number(c.renta || 0), 0) / n : 0;
    const porVencer = inquilinos.filter(i => {
      if (!i.fecha_termino) return false;
      const d = (new Date(i.fecha_termino).getTime() - Date.now()) / 86400000;
      return d >= 0 && d <= 30;
    }).length;
    return { n, avg, porVencer };
  }, [inquilinos]);

  const fmtMoney = (v: number | string) =>
    '$' + Number(v).toLocaleString('es-MX', { maximumFractionDigits: 0 });

  const initials = (nombre: string) =>
    nombre?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '??';

  const piso = (num: string | number) => {
    const n = Number(num);
    return Number.isFinite(n) && n >= 100 ? `Piso ${Math.floor(n / 100)}` : '';
  };

  const vencimiento = (fecha?: string) => {
    if (!fecha) return null;
    const dias = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
    if (dias < 0) return { label: 'Contrato vencido', variant: 'danger' as const, muted: 'Contrato vencido', expired: true };
    if (dias <= 30) return { label: `Vence en ${dias}d`, variant: 'warning' as const, muted: `Vence en ${dias} días`, expired: false };
    const meses = Math.round(dias / 30);
    return { label: null, variant: 'success' as const, muted: `Vence en ${meses} mes${meses !== 1 ? 'es' : ''}`, expired: false };
  };

  const estadoChip = (item: Inquilino, venc: ReturnType<typeof vencimiento>) => {
    if (item.estado !== 'activo') return { label: 'Archivado', variant: 'danger' as const };
    if (venc?.expired) return { label: 'Contrato vencido', variant: 'danger' as const };
    return { label: 'Al corriente', variant: 'success' as const };
  };

  const paddingBottom = isDesktop ? 40 : insets.bottom + Theme.layout.dockHeight;

  /* ---------------- Header (métricas + filtros) ---------------- */
  const listHeader = (
    <View style={[styles.header, isDesktop && styles.headerDesktop]}>
      {isDesktop && (
        <View style={styles.breadcrumb}>
          <Text style={[styles.crumb, { color: theme.textSecondary }]}>Dashboard</Text>
          <Ionicons name="chevron-forward" size={13} color={theme.textMuted} />
          <Text style={[styles.crumb, { color: theme.text }]}>Inquilinos</Text>
        </View>
      )}

      <View style={[styles.headerTop, !isDesktop && { paddingTop: insets.top + 20 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Inquilinos</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {metrics.n} {filtroEstado === 'activo' ? (metrics.n === 1 ? 'activo' : 'activos') : (metrics.n === 1 ? 'archivado' : 'archivados')}
            {filtroEstado === 'activo' && metrics.porVencer > 0 ? ` · ${metrics.porVencer} por vencer` : ''}
          </Text>
        </View>
        {filtroEstado === 'activo' && (
          <TouchableOpacity
            style={[styles.newBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
            onPress={() => router.push('/(admin)/inquilinos/nuevo')}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color="#fff" />
            {isDesktop && <Text style={styles.newBtnText}>Nuevo Inquilino</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Métricas */}
      <View style={styles.metricsRow}>
        <SurfaceCard style={styles.metricCard} padding={Theme.spacing.md}>
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
            {filtroEstado === 'activo' ? 'INQUILINOS ACTIVOS' : 'ARCHIVADOS'}
          </Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>{metrics.n}</Text>
        </SurfaceCard>
        <SurfaceCard style={styles.metricCard} padding={Theme.spacing.md}>
          <Text style={[styles.metricLabel, { color: theme.textMuted }]}>PROMEDIO DE RENTA</Text>
          <Text style={[styles.metricValue, { color: theme.text }]}>{fmtMoney(metrics.avg)} <Text style={styles.metricUnit}>MXN</Text></Text>
        </SurfaceCard>
        {isDesktop && (
          <SurfaceCard style={styles.metricCard} padding={Theme.spacing.md}>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>CONTRATOS POR VENCER</Text>
            <Text style={[styles.metricValue, { color: metrics.porVencer > 0 ? theme.warning : theme.text }]}>{metrics.porVencer}</Text>
          </SurfaceCard>
        )}
      </View>

      {/* Filtros + búsqueda */}
      <SurfaceCard style={styles.filterBar} padding={6}>
        <View style={styles.tabRow}>
          {(['activo', 'inactivo'] as const).map(t => {
            const active = filtroEstado === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.tab, active && { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}
                onPress={() => setFiltroEstado(t)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, { color: active ? theme.text : theme.textSecondary }]}>
                  {t === 'activo' ? 'Activos' : 'Archivados'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={[styles.searchBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: theme.border }]}>
          <Ionicons name="search" size={15} color={theme.textMuted} />
          <TextInput
            placeholder="Buscar por nombre, teléfono o depto..."
            placeholderTextColor={theme.textMuted}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: theme.text }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={15} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </SurfaceCard>

      {/* Cabecera de tabla (solo desktop) */}
      {isDesktop && filtered.length > 0 && (
        <View style={[styles.tableHead, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)' }]}>
          <Text style={[styles.th, { flex: 4, color: theme.textMuted }]}>INQUILINO</Text>
          <Text style={[styles.th, { flex: 2, color: theme.textMuted }]}>UNIDAD</Text>
          <Text style={[styles.th, { flex: 2, color: theme.textMuted }]}>RENTA</Text>
          <Text style={[styles.th, { flex: 3, color: theme.textMuted }]}>ESTADO</Text>
          <Text style={[styles.th, { width: 96, textAlign: 'right', color: theme.textMuted }]}>ACCIONES</Text>
        </View>
      )}
    </View>
  );

  if (loading && inquilinos.length === 0) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient colors={isDark ? ['#0E1321', '#1A1F2E'] : ['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>Cargando inquilinos...</Text>
      </View>
    );
  }

  /* ---------------- Fila desktop (tabla) ---------------- */
  const renderTableRow = (item: Inquilino, index: number) => {
    const venc = vencimiento(item.fecha_termino);
    const activo = item.estado === 'activo';
    return (
      <View
        key={String(item.id)}
        style={[styles.tr, { borderColor: theme.border }, index === filtered.length - 1 && { borderBottomWidth: 0 }]}
      >
        <TouchableOpacity
          style={[styles.tdInquilino, { flex: 4 }]}
          onPress={() => router.push(`/(admin)/inquilinos/${item.id}` as any)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '40' }]}>
              <Text style={[styles.avatarText, { color: theme.primary }]}>{initials(item.nombre_completo)}</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: activo ? theme.success : theme.textMuted, borderColor: theme.card }]} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{item.nombre_completo}</Text>
            {(item.tel_arrendatario || item.telefono) ? (
              <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={1}>{item.tel_arrendatario || item.telefono}</Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={{ flex: 2 }}>
          <Text style={[styles.rowUnidad, { color: theme.text }]}>Depto {item.depto_numero}</Text>
          {piso(item.depto_numero) ? <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>{piso(item.depto_numero)}</Text> : null}
        </View>

        <View style={{ flex: 2 }}>
          <Text style={[styles.rowRenta, { color: theme.text }]}>{fmtMoney(item.renta)} <Text style={styles.rowMetaInline}>MXN</Text></Text>
          {item.fecha_pago ? (
            <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>Día {String(item.fecha_pago).match(/(\d+)/)?.[1] || item.fecha_pago}</Text>
          ) : null}
        </View>

        <View style={{ flex: 3, gap: 4, alignItems: 'flex-start' }}>
          {(() => { const c = estadoChip(item, venc); return <Badge label={c.label} variant={c.variant} size="sm" />; })()}
          {venc && !venc.expired && <Text style={[styles.rowMeta, { color: venc.variant === 'warning' ? theme.warning : theme.textSecondary }]}>{venc.muted}</Text>}
        </View>

        <View style={[styles.tdActions, { width: 96 }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push(`/(admin)/inquilinos/${item.id}` as any)}>
            <Ionicons name="eye-outline" size={17} color={theme.textSecondary} />
          </TouchableOpacity>
          {activo ? (
            <>
              <TouchableOpacity style={styles.iconBtn} onPress={() => router.push({ pathname: '/(admin)/inquilinos/nuevo', params: { editId: item.id } } as any)}>
                <Ionicons name="pencil-outline" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => { setDeleteError(''); setConfirmItem(item); }}>
                <Ionicons name="person-remove-outline" size={16} color={theme.danger} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push({ pathname: '/(admin)/inquilinos/nuevo', params: { fromId: item.id } } as any)}>
              <Ionicons name="add-circle-outline" size={17} color={theme.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  /* ---------------- Card móvil ---------------- */
  const renderMobileCard = (item: Inquilino) => {
    const venc = vencimiento(item.fecha_termino);
    const activo = item.estado === 'activo';
    return (
      <SurfaceCard key={String(item.id)} style={styles.mCard} padding={0}>
        <TouchableOpacity style={styles.mCardBody} onPress={() => router.push(`/(admin)/inquilinos/${item.id}` as any)} activeOpacity={0.75}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, { backgroundColor: theme.primaryLight, borderColor: theme.primary + '40' }]}>
              <Text style={[styles.avatarText, { color: theme.primary }]}>{initials(item.nombre_completo)}</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: activo ? theme.success : theme.textMuted, borderColor: theme.card }]} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
            <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{item.nombre_completo}</Text>
            <View style={styles.mBadges}>
              <Badge label={`Depto ${item.depto_numero}`} variant="primary" size="sm" />
              <Text style={[styles.rowRenta, { color: theme.text }]}>{fmtMoney(item.renta)} MXN</Text>
            </View>
            <View style={styles.mBadges}>
              {(() => { const c = estadoChip(item, venc); return <Badge label={c.label} variant={c.variant} size="sm" />; })()}
              {venc?.label && !venc.expired && <Badge label={venc.label} variant={venc.variant} size="sm" />}
            </View>
          </View>
        </TouchableOpacity>
        <View style={[styles.mActions, { borderTopColor: theme.border }]}>
          {activo ? (
            <>
              <TouchableOpacity style={styles.mActionBtn} onPress={() => router.push({ pathname: '/(admin)/inquilinos/nuevo', params: { editId: item.id } } as any)}>
                <Ionicons name="pencil-outline" size={15} color={theme.textSecondary} />
                <Text style={[styles.mActionText, { color: theme.textSecondary }]}>Editar</Text>
              </TouchableOpacity>
              <View style={[styles.mActionDivider, { backgroundColor: theme.border }]} />
              <TouchableOpacity style={styles.mActionBtn} onPress={() => { setDeleteError(''); setConfirmItem(item); }}>
                <Ionicons name="person-remove-outline" size={15} color={theme.danger} />
                <Text style={[styles.mActionText, { color: theme.danger }]}>Dar de baja</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.mActionBtn} onPress={() => router.push({ pathname: '/(admin)/inquilinos/nuevo', params: { fromId: item.id } } as any)}>
              <Ionicons name="add-circle-outline" size={15} color={theme.primary} />
              <Text style={[styles.mActionText, { color: theme.primary }]}>Nuevo contrato</Text>
            </TouchableOpacity>
          )}
        </View>
      </SurfaceCard>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={isDark ? ['#0E1321', '#1A1F2E'] : ['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFill} />

      <FlatList
        data={isDesktop ? [] : filtered}
        keyExtractor={item => String(item.id)}
        ListHeaderComponent={
          <>
            {listHeader}
            {isDesktop && (
              <View style={[styles.tableWrap, styles.headerDesktop]}>
                <SurfaceCard style={{ overflow: 'hidden' }} padding={0}>
                  {filtered.length === 0
                    ? <EmptyState theme={theme} search={search} filtroEstado={filtroEstado} />
                    : filtered.map((item, i) => renderTableRow(item, i))}
                </SurfaceCard>
              </View>
            )}
          </>
        }
        renderItem={isDesktop ? undefined : ({ item }) => renderMobileCard(item)}
        contentContainerStyle={[styles.listContent, { paddingBottom }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={isDesktop ? null : <EmptyState theme={theme} search={search} filtroEstado={filtroEstado} />}
      />

      {/* Modal dar de baja */}
      <Modal visible={!!confirmItem} transparent animationType="fade" onRequestClose={() => setConfirmItem(null)}>
        <View style={styles.modalOverlay}>
          <SurfaceCard style={styles.confirmBox} borderRadius={Theme.borderRadius.xxl}>
            <View style={[styles.confirmIconWrap, { backgroundColor: theme.dangerLight }]}>
              <Ionicons name="person-remove" size={26} color={theme.danger} />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>Dar de Baja</Text>
            <Text style={[styles.confirmMsg, { color: theme.textSecondary }]}>
              ¿Dar de baja a{'\n'}
              <Text style={{ color: theme.text, fontWeight: '700' }}>{confirmItem?.nombre_completo}</Text>?{'\n'}
              El Depto {confirmItem?.depto_numero} quedará disponible.
            </Text>
            <Text style={[styles.confirmNote, { color: theme.textSecondary }]}>
              Sus datos se guardarán en el historial y podrás generar un nuevo contrato en el futuro.
            </Text>

            {deleteError ? (
              <View style={[styles.errorBox, { backgroundColor: theme.dangerLight, borderColor: theme.danger + '50' }]}>
                <Ionicons name="alert-circle-outline" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>{deleteError}</Text>
              </View>
            ) : null}

            <View style={styles.confirmActions}>
              <Button title="Cancelar" variant="outline" onPress={() => { setConfirmItem(null); setDeleteError(''); }} disabled={eliminando} style={{ flex: 1 }} />
              <Button title="Dar de baja" variant="danger" loading={eliminando} onPress={confirmarDarDeBaja} style={{ flex: 1 }} />
            </View>
          </SurfaceCard>
        </View>
      </Modal>
    </View>
  );
}

function EmptyState({ theme, search, filtroEstado }: { theme: any; search: string; filtroEstado: string }) {
  return (
    <View style={styles.emptyContent}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.surface }]}>
        <Ionicons name="people-outline" size={30} color={theme.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        {search ? 'Sin resultados' : filtroEstado === 'inactivo' ? 'Sin archivados' : 'No hay inquilinos'}
      </Text>
      <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
        {search ? `No se encontró "${search}"` : filtroEstado === 'inactivo' ? 'Aquí aparecerán los inquilinos dados de baja' : 'Agrega el primer inquilino con el botón +'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '500' },

  listContent: { paddingBottom: 40 },
  header: { paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.md, gap: Theme.spacing.md },
  headerDesktop: { maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: 40 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24 },
  crumb: { fontSize: 12, fontWeight: '600' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 40, paddingHorizontal: 14, borderRadius: Theme.borderRadius.md,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  metricsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metricCard: { flex: 1, minWidth: 140, justifyContent: 'space-between', minHeight: 84 },
  metricLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  metricValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.8 },
  metricUnit: { fontSize: 13, fontWeight: '600' },

  filterBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  tabRow: { flexDirection: 'row', gap: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Theme.borderRadius.sm },
  tabText: { fontSize: 13, fontWeight: '600' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, maxWidth: 340,
    height: 36, paddingHorizontal: 10, borderRadius: Theme.borderRadius.sm, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 13, height: '100%' },

  tableWrap: { paddingHorizontal: Theme.spacing.lg, marginTop: 4 },
  tableHead: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderBottomWidth: 0,
    borderTopLeftRadius: Theme.borderRadius.lg, borderTopRightRadius: Theme.borderRadius.lg,
  },
  th: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },

  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  tdInquilino: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  avatarText: { fontWeight: '800', fontSize: 13 },
  statusDot: { position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  rowName: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  rowMeta: { fontSize: 11.5, marginTop: 2 },
  rowMetaInline: { fontSize: 11, fontWeight: '500' },
  rowUnidad: { fontSize: 13, fontWeight: '600' },
  rowRenta: { fontSize: 13, fontWeight: '700' },
  tdActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 2 },
  iconBtn: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  mCard: { overflow: 'hidden', marginHorizontal: Theme.spacing.lg, marginTop: Theme.spacing.md },
  mCardBody: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  mBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  mActions: { flexDirection: 'row', borderTopWidth: 1 },
  mActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  mActionText: { fontSize: 12, fontWeight: '600' },
  mActionDivider: { width: 1 },

  emptyContent: { alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)', padding: 24 },
  confirmBox: { width: '100%', maxWidth: 400, padding: 28, alignItems: 'center', gap: 14 },
  confirmIconWrap: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  confirmTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  confirmMsg: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  confirmNote: { fontSize: 12, textAlign: 'center', lineHeight: 18, opacity: 0.7, marginTop: -6 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, width: '100%' },
  errorText: { flex: 1, fontSize: 13, fontWeight: '600' },
});
