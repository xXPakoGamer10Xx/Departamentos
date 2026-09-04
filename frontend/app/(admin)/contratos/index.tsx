import { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput,
  useColorScheme, Platform, useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SurfaceCard } from '../../../components/ui/SurfaceCard';
import { Badge } from '../../../components/ui/Badge';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../services/api';

type Estado = 'vigente' | 'porVencer' | 'vencido';
type Filtro = 'todos' | 'vigentes' | 'porVencer' | 'vencidos';

export default function ContratosScreen() {
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [inquilinos, setInquilinos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  const cargar = async () => {
    try {
      setLoading(true);
      const res = await api.getInquilinos({ estado: 'activo' });
      setInquilinos(res.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { cargar(); }, []));

  const abrirContrato = async (item: any) => {
    if (Platform.OS === 'web') {
      setOpeningId(String(item.id));
      try {
        const url = api.getContratoPdfUrl(String(item.id));
        const tokenRes = await api.generarTokenPdf(String(item.id));
        const token = tokenRes.data?.token;
        window.open(`${url}?token=${encodeURIComponent(token || '')}`, '_blank');
      } finally { setOpeningId(null); }
      return;
    }
    router.push(`/(admin)/contratos/generar/${item.id}` as any);
  };

  const editarContrato = (item: any) => router.push(`/(admin)/contratos/generar/${item.id}` as any);

  const estadoDe = (item: any): { estado: Estado; dias: number | null } => {
    if (!item.fecha_termino) return { estado: 'vigente', dias: null };
    const dias = Math.ceil((new Date(item.fecha_termino).getTime() - Date.now()) / 86400000);
    if (dias < 0) return { estado: 'vencido', dias };
    if (dias <= 30) return { estado: 'porVencer', dias };
    return { estado: 'vigente', dias };
  };

  const enriched = useMemo(() => inquilinos.map(i => ({ item: i, ...estadoDe(i) })), [inquilinos]);

  const stats = useMemo(() => {
    const total = enriched.length;
    const vigentes = enriched.filter(e => e.estado === 'vigente').length;
    const porVencer = enriched.filter(e => e.estado === 'porVencer').length;
    const vencidos = enriched.filter(e => e.estado === 'vencido').length;
    const depositos = inquilinos.reduce((a, i) => a + Number(i.deposito || 0), 0);
    const conAmbasFechas = inquilinos.filter(i => i.fecha_inicio && i.fecha_termino);
    const vigenciaProm = conAmbasFechas.length
      ? Math.round(conAmbasFechas.reduce((a, i) =>
          a + (new Date(i.fecha_termino).getTime() - new Date(i.fecha_inicio).getTime()) / (86400000 * 30.4), 0) / conAmbasFechas.length)
      : 0;
    return { total, vigentes, porVencer, vencidos, depositos, vigenciaProm, pctVigencia: total ? Math.round((vigentes / total) * 100) : 0 };
  }, [enriched, inquilinos]);

  const filtered = enriched.filter(({ item, estado }) => {
    if (filtro === 'vigentes' && estado !== 'vigente') return false;
    if (filtro === 'porVencer' && estado !== 'porVencer') return false;
    if (filtro === 'vencidos' && estado !== 'vencido') return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return item.nombre_completo?.toLowerCase().includes(q) || String(item.depto_numero).includes(search);
  });

  const fmt0 = (n: number) => '$' + Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 });
  const fmtFecha = (s?: string) =>
    s ? new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const initials = (n: string) => n?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '??';

  const FILTERS: { key: Filtro; label: string; color?: string; count: number }[] = [
    { key: 'todos', label: 'Todos', count: stats.total },
    { key: 'vigentes', label: 'Vigentes', color: theme.success, count: stats.vigentes },
    { key: 'porVencer', label: 'Próximos a vencer', color: theme.warning, count: stats.porVencer },
    { key: 'vencidos', label: 'Vencidos', color: theme.danger, count: stats.vencidos },
  ];

  const chipFor = (estado: Estado, dias: number | null) => {
    if (estado === 'vencido') return { label: `VENCIDO ${Math.abs(dias || 0)}D`, variant: 'danger' as const };
    if (estado === 'porVencer') return { label: `VENCE EN ${dias}D`, variant: 'warning' as const };
    return { label: 'VIGENTE', variant: 'success' as const };
  };

  if (loading && inquilinos.length === 0) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient colors={isDark ? ['#0E1321', '#1A1F2E'] : ['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  /* ---------------- Fila de contrato ---------------- */
  const contratoRow = ({ item, estado, dias }: { item: any; estado: Estado; dias: number | null }) => {
    const chip = chipFor(estado, dias);
    const accent = estado === 'vencido' ? theme.danger : estado === 'porVencer' ? theme.warning : null;
    const opening = openingId === String(item.id);
    return (
      <SurfaceCard
        key={item.id}
        style={[styles.row, accent && { borderColor: accent + '40' }]}
        padding={0}
      >
        {accent && <View style={[styles.stripe, { backgroundColor: accent }]} />}
        <View style={[styles.rowInner, !isDesktop && styles.rowInnerMobile]}>
          {/* Identidad */}
          <View style={[styles.identity, isDesktop && { width: '32%' }]}>
            <View style={[styles.iconBox, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)' }]}>
              <Ionicons name="document-text-outline" size={22} color={accent || theme.textSecondary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{item.nombre_completo}</Text>
              <View style={styles.metaRow}>
                <View style={[styles.deptoTag, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)' }]}>
                  <Text style={[styles.deptoTagText, { color: theme.textSecondary }]}>Depto {item.depto_numero}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Datos */}
          <View style={[styles.data, !isDesktop && { paddingLeft: 60 }]}>
            <View style={styles.dataCol}>
              <Text style={[styles.dataLabel, { color: theme.textMuted }]}>PERÍODO</Text>
              <Text style={[styles.dataValue, { color: theme.text }]}>{fmtFecha(item.fecha_inicio)} – {fmtFecha(item.fecha_termino)}</Text>
            </View>
            <View style={styles.dataCol}>
              <Text style={[styles.dataLabel, { color: theme.textMuted }]}>RENTA MENSUAL</Text>
              <Text style={[styles.dataValue, { color: theme.text }]}>{fmt0(item.renta)} MXN</Text>
            </View>
          </View>

          {/* Estado + acciones */}
          <View style={[styles.tail, !isDesktop && styles.tailMobile]}>
            <Badge label={chip.label} variant={chip.variant} size="sm" />
            <View style={styles.actions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => abrirContrato(item)} disabled={opening}>
                {opening ? <ActivityIndicator size="small" color={theme.textSecondary} /> : <Ionicons name="document-outline" size={18} color={theme.textSecondary} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editBtn, { borderColor: theme.border }]}
                onPress={() => editarContrato(item)}
              >
                <Ionicons name={item.contrato_html ? 'create' : 'create-outline'} size={14} color={theme.primary} />
                <Text style={[styles.editBtnText, { color: theme.primary }]}>Editar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SurfaceCard>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={isDark ? ['#0E1321', '#1A1F2E'] : ['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop, { paddingBottom: isDesktop ? 40 : insets.bottom + Theme.layout.dockHeight }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, !isDesktop && { paddingTop: insets.top + 20 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Contratos de Arrendamiento</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {stats.vigentes} vigente{stats.vigentes !== 1 ? 's' : ''}
              {stats.porVencer > 0 ? ` · ${stats.porVencer} por renovar` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.tplBtn, { borderColor: theme.border }]}
            onPress={() => router.push('/(admin)/configuracion')}
            activeOpacity={0.8}
          >
            <Ionicons name="reader-outline" size={15} color={theme.text} />
            {isDesktop && <Text style={[styles.tplBtnText, { color: theme.text }]}>Plantilla base</Text>}
          </TouchableOpacity>
        </View>

        {/* KPIs */}
        <View style={[styles.kpiRow, isDesktop && styles.kpiRowDesktop]}>
          <SurfaceCard style={styles.kpi} padding={Theme.spacing.md}>
            <View style={styles.kpiHead}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>CONTRATOS ACTIVOS</Text>
              <Ionicons name="document-text-outline" size={15} color={theme.primary} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{stats.total}</Text>
            <Text style={[styles.kpiMini, { color: theme.success }]}>{stats.pctVigencia}% vigencia</Text>
          </SurfaceCard>

          <SurfaceCard style={[styles.kpi, stats.porVencer > 0 && { borderColor: theme.warning + '55' }]} padding={Theme.spacing.md}>
            <View style={styles.kpiHead}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>POR VENCER (30 DÍAS)</Text>
              <Ionicons name="warning-outline" size={15} color={theme.warning} />
            </View>
            <Text style={[styles.kpiValue, { color: stats.porVencer > 0 ? theme.warning : theme.text }]}>{stats.porVencer}</Text>
            <Text style={[styles.kpiMini, { color: stats.porVencer > 0 ? theme.warning : theme.textSecondary }]}>
              {stats.porVencer > 0 ? 'acción requerida' : 'todo al día'}
            </Text>
          </SurfaceCard>

          <SurfaceCard style={styles.kpi} padding={Theme.spacing.md}>
            <View style={styles.kpiHead}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>VIGENCIA PROMEDIO</Text>
              <Ionicons name="calendar-outline" size={15} color={theme.textMuted} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{stats.vigenciaProm} <Text style={styles.kpiUnit}>meses</Text></Text>
            <Text style={[styles.kpiMini, { color: theme.textSecondary }]}>duración típica</Text>
          </SurfaceCard>

          <SurfaceCard style={styles.kpi} padding={Theme.spacing.md}>
            <View style={styles.kpiHead}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>DEPÓSITOS EN CUSTODIA</Text>
              <Ionicons name="wallet-outline" size={15} color={theme.textMuted} />
            </View>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{fmt0(stats.depositos)} <Text style={styles.kpiUnit}>MXN</Text></Text>
            <Text style={[styles.kpiMini, { color: theme.textSecondary }]}>fondos en garantía</Text>
          </SurfaceCard>
        </View>

        {/* Búsqueda + filtros */}
        <View style={styles.filterBar}>
          <View style={[styles.searchBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: theme.border }]}>
            <Ionicons name="search" size={15} color={theme.textMuted} />
            <TextInput
              placeholder="Buscar por inquilino o departamento..."
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTERS.map(f => {
              const active = filtro === f.key;
              const c = f.color || theme.text;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.chip,
                    { borderColor: active ? (f.color ? f.color + '50' : theme.borderStrong) : theme.border },
                    active && { backgroundColor: f.color ? f.color + '18' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)') },
                  ]}
                  onPress={() => setFiltro(f.key)}
                  activeOpacity={0.8}
                >
                  {f.color && <View style={[styles.dot, { backgroundColor: f.color }]} />}
                  <Text style={[styles.chipText, { color: active ? c : theme.textSecondary }]}>{f.label} ({f.count})</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Lista */}
        <View style={{ gap: 10 }}>
          {filtered.length === 0 ? (
            <SurfaceCard style={{ alignItems: 'center', paddingVertical: 44 }}>
              <Ionicons name="document-text-outline" size={40} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {search ? `Sin resultados para "${search}"` : 'Sin contratos en esta categoría'}
              </Text>
            </SurfaceCard>
          ) : (
            filtered.map(e => contratoRow(e))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.md, gap: Theme.spacing.lg },
  contentDesktop: { maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: 40, paddingTop: 28 },

  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, marginTop: 2 },
  tplBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, paddingHorizontal: 14, borderRadius: Theme.borderRadius.md, borderWidth: 1 },
  tplBtnText: { fontSize: 12.5, fontWeight: '600' },

  kpiRow: { gap: 12, flexDirection: 'row', flexWrap: 'wrap' },
  kpiRowDesktop: { flexWrap: 'nowrap' },
  kpi: { flex: 1, minWidth: 150, minHeight: 104, justifyContent: 'space-between' },
  kpiHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  kpiLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  kpiValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  kpiUnit: { fontSize: 12, fontWeight: '600' },
  kpiMini: { fontSize: 11, fontWeight: '600', marginTop: 4 },

  filterBar: { gap: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 10, borderRadius: Theme.borderRadius.sm, borderWidth: 1, maxWidth: 380 },
  searchInput: { flex: 1, fontSize: 13, height: '100%' },
  chips: { gap: 8, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '600' },
  dot: { width: 7, height: 7, borderRadius: 4 },

  row: { overflow: 'hidden' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  rowInnerMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  deptoTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  deptoTagText: { fontSize: 10.5, fontWeight: '700' },

  data: { flex: 1, flexDirection: 'row', gap: 20 },
  dataCol: { gap: 3 },
  dataLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5 },
  dataValue: { fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] },

  tail: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 },
  tailMobile: { justifyContent: 'space-between', paddingLeft: 60 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 32, borderRadius: 8, borderWidth: 1 },
  editBtnText: { fontSize: 12, fontWeight: '700' },

  emptyText: { fontSize: 13, marginTop: 10 },
});
