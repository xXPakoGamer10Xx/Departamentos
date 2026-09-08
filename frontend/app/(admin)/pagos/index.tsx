import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput,
  useColorScheme, ActivityIndicator, useWindowDimensions, Platform, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSSEEvent } from '../../../hooks/useSSE';
import { LinearGradient } from 'expo-linear-gradient';
import { SurfaceCard } from '../../../components/ui/SurfaceCard';
import { Badge } from '../../../components/ui/Badge';
import { confirmar } from '../../../utils/confirm';
import api from '../../../services/api';
import { usePermisoGuard } from '../../../hooks/usePermisoGuard';

type RowState = 'pagado' | 'revision' | 'atrasado' | 'pendiente';
type Tab = 'todos' | 'pagados' | 'revision' | 'pendientes' | 'atrasados';
type SortMode = 'depto' | 'dia_asc' | 'dia_desc' | 'monto_desc' | 'monto_asc' | 'nombre';

const SORT_OPTS: { key: SortMode; label: string }[] = [
  { key: 'depto', label: 'Número de departamento' },
  { key: 'dia_asc', label: 'Día de pago — del 1 al 31' },
  { key: 'dia_desc', label: 'Día de pago — del 31 al 1' },
  { key: 'monto_desc', label: 'Renta — de mayor a menor' },
  { key: 'monto_asc', label: 'Renta — de menor a mayor' },
  { key: 'nombre', label: 'Nombre del inquilino (A–Z)' },
];

export default function PagosScreen() {
  usePermisoGuard('pagos');
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  const [inquilinos, setInquilinos] = useState<any[]>([]);
  const [estados, setEstados] = useState<Record<string, any>>({});
  const [saldos, setSaldos] = useState<Record<string, { total: number; vencida: number }>>({});
  const [usaQr, setUsaQr] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('todos');
  const [sortMode, setSortMode] = useState<SortMode>('depto');
  const [showSort, setShowSort] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const cargar = useCallback((showLoader = false) => {
    if (showLoader) setLoading(true);
    Promise.all([
      api.getInquilinos({ estado: 'activo' }),
      api.getEstadosPagosActuales().catch(() => ({ data: [] as any[] })),
      api.getSaldosInquilinos().catch(() => ({ data: [] as any[] })),
      api.getConfig().catch(() => ({ data: {} as Record<string, string> })),
    ])
      .then(([inqRes, estRes, saldosRes, cfgRes]) => {
        setInquilinos(inqRes.data || []);
        const map: Record<string, any> = {};
        (estRes.data || []).forEach((e: any) => { map[e.inquilino_id] = e; });
        setEstados(map);
        const saldoMap: Record<string, { total: number; vencida: number }> = {};
        (saldosRes.data || []).forEach((s: any) => {
          saldoMap[s.inquilino_id] = {
            total: parseFloat(s.deuda_total ?? 0),
            vencida: parseFloat(s.deuda_vencida ?? s.deuda_total ?? 0),
          };
        });
        setSaldos(saldoMap);
        setUsaQr((cfgRes.data as any)?.usa_qr_inquilinos !== 'false');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { cargar(true); }, [cargar]));

  useEffect(() => {
    const interval = setInterval(() => cargar(), 10000);
    return () => clearInterval(interval);
  }, [cargar]);

  useSSEEvent('payment_confirmed', () => cargar());
  useSSEEvent('comprobante_subido', () => cargar());

  // Si se apaga el flujo de comprobantes, no dejar seleccionada la pestaña Revisión.
  useEffect(() => {
    if (!usaQr && (tab === 'revision')) setTab('todos');
  }, [usaQr, tab]);

  // Barra "Deshacer" temporal tras marcar un pago.
  const [undo, setUndo] = useState<{ pagoId: string; nombre: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUndo = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndo(null);
  }, []);

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const marcarPagado = useCallback(async (inquilinoId: string, nombre: string) => {
    setBusyId(inquilinoId);
    try {
      const res = await api.marcarPagadoAdmin(inquilinoId);
      const pagoId = res?.data?.id;
      cargar();
      if (pagoId) {
        if (undoTimer.current) clearTimeout(undoTimer.current);
        setUndo({ pagoId, nombre });
        undoTimer.current = setTimeout(() => setUndo(null), 5000);
      }
    }
    catch (e) { console.error(e); }
    finally { setBusyId(null); }
  }, [cargar]);

  const cancelarPago = useCallback(async (pagoId: string, opts?: { confirm?: boolean }) => {
    if (opts?.confirm) {
      const ok = await confirmar('Cancelar pago', 'El periodo volverá a quedar como pendiente de pago.', { confirmLabel: 'Cancelar pago', destructive: true });
      if (!ok) return;
    }
    clearUndo();
    try { await api.cancelarPago(pagoId); cargar(); }
    catch (e: any) {
      const msg = e?.message || 'No se pudo cancelar el pago';
      if (Platform.OS === 'web') window.alert(msg);
      else { const { Alert } = await import('react-native'); Alert.alert('Error', msg); }
    }
  }, [cargar, clearUndo]);

  const validar = useCallback(async (inquilinoId: string, pagoId?: string) => {
    if (!pagoId) return;
    setBusyId(inquilinoId);
    try { await api.confirmarPagoPorId(pagoId); cargar(); }
    catch (e) { console.error(e); }
    finally { setBusyId(null); }
  }, [cargar]);

  // `deuda.vencida` = meses cuya fecha de pago (+ gracia) ya pasó ⇒ atrasado.
  // `deuda.total` = todo lo pendiente del ciclo (incluye el mes en curso).
  const rowState = useCallback((item: any): RowState => {
    const e = estados[item.id];
    if (e?.confirmado) return 'pagado';
    if (e?.comprobante_url && !e?.rechazado) return 'revision';
    if ((saldos[item.id]?.vencida ?? 0) > 0.5 || e?.rechazado) return 'atrasado';
    return 'pendiente';
  }, [estados, saldos]);

  const rows = useMemo(() => inquilinos.map(i => ({ item: i, state: rowState(i) })), [inquilinos, rowState]);

  const counts = useMemo(() => ({
    todos: rows.length,
    pagados: rows.filter(r => r.state === 'pagado').length,
    revision: rows.filter(r => r.state === 'revision').length,
    pendientes: rows.filter(r => r.state === 'pendiente').length,
    atrasados: rows.filter(r => r.state === 'atrasado').length,
  }), [rows]);

  const kpi = useMemo(() => {
    const expected = inquilinos.reduce((a, i) => a + Number(i.renta || 0), 0);
    const recaudado = rows.filter(r => r.state === 'pagado').reduce((a, r) => a + Number(r.item.renta || 0), 0);
    const spei = inquilinos.filter(i => i.metodo_pago === 'transferencia' || i.metodo_pago === 'ambos').length;
    // Por recaudar = todo lo pendiente del ciclo + atrasos acumulados de meses anteriores.
    const porRecaudar = inquilinos.reduce((a, i) => a + (saldos[i.id]?.total ?? 0), 0);
    const vencido = inquilinos.reduce((a, i) => a + (saldos[i.id]?.vencida ?? 0), 0);
    return {
      expected, recaudado,
      porRecaudar,
      vencido,
      pct: expected > 0 ? Math.round((recaudado / expected) * 100) : 0,
      porValidar: counts.revision,
      speiPct: inquilinos.length > 0 ? Math.round((spei / inquilinos.length) * 100) : 0,
    };
  }, [inquilinos, rows, counts, saldos]);

  // ¿Este pago confirmado todavía se puede cancelar? (dentro de las 24 h)
  const puedeCancelar = (item: any): boolean => {
    const e = estados[item.id];
    if (!e?.pago_id || !e?.confirmado || !e?.confirmado_en) return false;
    return Date.now() - new Date(e.confirmado_en).getTime() < 24 * 3600 * 1000;
  };

  // Día pactado de pago, extraído del texto libre de `fecha_pago` ("10 de cada mes").
  const diaPago = (item: any): number | null => {
    const match = String(item?.fecha_pago ?? '').match(/\d{1,2}/);
    if (!match) return null;
    const d = parseInt(match[0], 10);
    return d >= 1 && d <= 31 ? d : null;
  };

  const filtered = rows.filter(({ item, state }) => {
    if (tab === 'pagados' && state !== 'pagado') return false;
    if (tab === 'revision' && state !== 'revision') return false;
    if (tab === 'pendientes' && state !== 'pendiente') return false;
    if (tab === 'atrasados' && state !== 'atrasado') return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return item.nombre_completo?.toLowerCase().includes(q) || String(item.depto_numero).includes(search);
  });

  const visible = [...filtered].sort((a, b) => {
    switch (sortMode) {
      case 'dia_asc':   return (diaPago(a.item) ?? 99) - (diaPago(b.item) ?? 99);
      case 'dia_desc':  return (diaPago(b.item) ?? -1) - (diaPago(a.item) ?? -1);
      case 'monto_desc': return Number(b.item.renta || 0) - Number(a.item.renta || 0);
      case 'monto_asc':  return Number(a.item.renta || 0) - Number(b.item.renta || 0);
      case 'nombre':    return String(a.item.nombre_completo || '').localeCompare(String(b.item.nombre_completo || ''));
      default:          return Number(a.item.depto_numero) - Number(b.item.depto_numero);
    }
  });

  const sortLabel = SORT_OPTS.find(o => o.key === sortMode)?.label ?? '';

  const fmt = (n: number) => '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 });
  const fmt0 = (n: number) => '$' + Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 });
  const initials = (n: string) => n?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '??';

  const mesActual = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date());

  const metodo = (m?: string) => {
    if (m === 'transferencia') return { icon: 'business-outline' as const, label: 'SPEI' };
    if (m === 'ambos') return { icon: 'swap-horizontal' as const, label: usaQr ? 'SPEI / QR' : 'SPEI / Efectivo' };
    return usaQr
      ? { icon: 'qr-code-outline' as const, label: 'Efectivo / QR' }
      : { icon: 'cash-outline' as const, label: 'Efectivo' };
  };

  const stateChip = (s: RowState) => {
    switch (s) {
      case 'pagado': return { label: 'PAGADO', variant: 'success' as const };
      case 'revision': return { label: 'EN REVISIÓN', variant: 'warning' as const };
      case 'atrasado': return { label: 'ATRASADO', variant: 'danger' as const };
      default: return { label: 'POR PAGAR', variant: 'default' as const };
    }
  };

  const TAB_META: { key: Tab; label: string; color?: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'pagados', label: 'Pagados' },
    // La pestaña de revisión de comprobantes solo aplica si se usa la app con inquilinos.
    ...(usaQr ? [{ key: 'revision' as Tab, label: 'Revisión', color: theme.warning }] : []),
    { key: 'pendientes', label: 'Por pagar' },
    { key: 'atrasados', label: 'Atrasados', color: theme.danger },
  ];

  /* ---------------- KPI cards ---------------- */
  const kpiRow = (
    <View style={[styles.kpiRow, isDesktop && styles.kpiRowDesktop]}>
      <SurfaceCard style={styles.kpi} padding={Theme.spacing.md}>
        <View style={styles.kpiHead}>
          <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>TOTAL RECAUDADO</Text>
          <Ionicons name="trending-up" size={15} color={theme.success} />
        </View>
        <Text style={[styles.kpiValue, { color: theme.text }]}>{fmt0(kpi.recaudado)} <Text style={styles.kpiUnit}>MXN</Text></Text>
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)' }]}>
            <View style={[styles.progressFill, { width: `${kpi.pct}%`, backgroundColor: theme.success }]} />
          </View>
          <Text style={[styles.kpiMini, { color: theme.success }]}>{kpi.pct}% cobrado</Text>
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.kpi} padding={Theme.spacing.md}>
        <View style={styles.kpiHead}>
          <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>POR RECAUDAR</Text>
          <Ionicons name="wallet-outline" size={15} color={theme.danger} />
        </View>
        <Text style={[styles.kpiValue, { color: theme.text }]}>{fmt0(kpi.porRecaudar)} <Text style={styles.kpiUnit}>MXN</Text></Text>
        <Text style={[styles.kpiMini, { color: kpi.vencido > 0 ? theme.danger : theme.textSecondary }]}>
          {kpi.vencido > 0
            ? `${fmt0(kpi.vencido)} vencido${counts.pendientes > 0 ? ` · ${counts.pendientes} por vencer` : ''}`
            : counts.pendientes > 0
              ? `${counts.pendientes} por pagar · al corriente`
              : 'Todo cobrado'}
        </Text>
      </SurfaceCard>

      {usaQr && (
      <SurfaceCard style={[styles.kpi, kpi.porValidar > 0 && { borderColor: theme.warning + '55' }]} padding={Theme.spacing.md}>
        <View style={styles.kpiHead}>
          <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>POR VALIDAR</Text>
          <Ionicons name="notifications-outline" size={15} color={theme.warning} />
        </View>
        <Text style={[styles.kpiValue, { color: theme.text }]}>
          {kpi.porValidar} <Text style={styles.kpiUnit}>{kpi.porValidar === 1 ? 'comprobante' : 'comprobantes'}</Text>
        </Text>
        <Text style={[styles.kpiMini, { color: kpi.porValidar > 0 ? theme.warning : theme.textSecondary }]}>
          {kpi.porValidar > 0 ? 'pendiente de aprobación' : 'todo revisado'}
        </Text>
      </SurfaceCard>
      )}

      {usaQr && (
      <SurfaceCard style={styles.kpi} padding={Theme.spacing.md}>
        <View style={styles.kpiHead}>
          <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>MÉTODO PREFERIDO</Text>
          <Ionicons name="pie-chart-outline" size={15} color={theme.textMuted} />
        </View>
        <View style={{ gap: 6, marginTop: 4 }}>
          <View style={styles.metodoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View style={[styles.dot, { backgroundColor: theme.primary }]} />
              <Text style={[styles.metodoText, { color: theme.text }]}>Transferencia SPEI</Text>
            </View>
            <Text style={[styles.metodoPct, { color: theme.text }]}>{kpi.speiPct}%</Text>
          </View>
          <View style={styles.metodoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <View style={[styles.dot, { backgroundColor: theme.textMuted }]} />
              <Text style={[styles.metodoText, { color: theme.textSecondary }]}>Efectivo / QR</Text>
            </View>
            <Text style={[styles.metodoPct, { color: theme.textSecondary }]}>{100 - kpi.speiPct}%</Text>
          </View>
        </View>
      </SurfaceCard>
      )}
    </View>
  );

  /* ---------------- Toolbar ---------------- */
  const toolbar = (
    <View style={[
      styles.toolbar,
      { borderBottomColor: theme.border },
      !isDesktop && { flexDirection: 'column', alignItems: 'stretch' },
    ]}>
      <View style={[
        styles.searchBox,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: theme.border },
        !isDesktop && { maxWidth: undefined, width: '100%' },
      ]}>
        <Ionicons name="search" size={15} color={theme.textMuted} />
        <TextInput
          placeholder="Buscar por inquilino o unidad..."
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
        style={!isDesktop ? { width: '100%', flexGrow: 0 } : undefined}
      >
        {TAB_META.map(t => {
          const active = tab === t.key;
          const c = t.color || theme.text;
          return (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tab,
                { borderColor: active ? (t.color ? t.color + '40' : theme.border) : 'transparent' },
                active && { backgroundColor: t.color ? t.color + '18' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)') },
              ]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
            >
              {t.color && <View style={[styles.dot, { backgroundColor: t.color }]} />}
              <Text style={[styles.tabText, { color: active ? c : theme.textSecondary }]}>
                {t.label} ({counts[t.key]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.sortBtn, { borderColor: theme.border }, !isDesktop && { alignSelf: 'flex-start' }]}
        onPress={() => setShowSort(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="swap-vertical" size={14} color={theme.textSecondary} />
        <Text style={[styles.sortBtnText, { color: theme.textSecondary }]} numberOfLines={1}>
          Ordenar: {sortLabel}
        </Text>
        <Ionicons name="chevron-down" size={13} color={theme.textMuted} />
      </TouchableOpacity>
    </View>
  );

  /* ---------------- Modal de orden ---------------- */
  const sortModal = (
    <Modal visible={showSort} transparent animationType="fade" onRequestClose={() => setShowSort(false)}>
      <TouchableOpacity style={styles.sortOverlay} activeOpacity={1} onPress={() => setShowSort(false)}>
        <View style={[styles.sortSheet, { backgroundColor: theme.surface ?? (isDark ? '#161B29' : '#fff'), borderColor: theme.border }]}>
          <Text style={[styles.sortTitle, { color: theme.text }]}>Ordenar lista por</Text>
          {SORT_OPTS.map(o => {
            const on = sortMode === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                style={[styles.sortOpt, on && { backgroundColor: theme.primary + '14' }]}
                onPress={() => { setSortMode(o.key); setShowSort(false); }}
              >
                <Text style={[styles.sortOptText, { color: on ? theme.primary : theme.text, fontWeight: on ? '700' : '500' }]}>
                  {o.label}
                </Text>
                {on && <Ionicons name="checkmark" size={17} color={theme.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  /* ---------------- Fila tabla (desktop) ---------------- */
  const tableRow = ({ item, state }: { item: any; state: RowState }, i: number) => {
    const e = estados[item.id];
    const m = metodo(item.metodo_pago);
    const chip = stateChip(state);
    const busy = busyId === item.id;
    const atrasado = state === 'atrasado';
    return (
      <View key={item.id} style={[styles.tr, { borderColor: theme.border }, i === visible.length - 1 && { borderBottomWidth: 0 }, atrasado && { backgroundColor: theme.danger + '08' }]}>
        <TouchableOpacity style={[styles.tdInq, { flex: 4 }]} onPress={() => router.push(`/(admin)/pagos/${item.id}`)} activeOpacity={0.7}>
          <View style={[styles.deptoBox, { borderColor: atrasado ? theme.danger + '40' : theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)' }]}>
            <Text style={[styles.deptoBoxTop, { color: atrasado ? theme.danger : theme.textMuted }]}>Dpto</Text>
            <Text style={[styles.deptoBoxNum, { color: atrasado ? theme.danger : theme.text }]}>{item.depto_numero}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{item.nombre_completo}</Text>
            <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={1}>
              Renta mensual · {mesLabel()}
            </Text>
            {diaPago(item) != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="calendar-outline" size={12} color={atrasado ? theme.danger : theme.textMuted} />
                <Text style={[styles.rowMeta, { fontSize: 11, color: atrasado ? theme.danger : theme.textMuted }]}>
                  {atrasado ? `Venció el ${diaPago(item)}` : `Paga el día ${diaPago(item)} de cada mes`}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={{ flex: 2 }}>
          <Text style={[styles.rowMonto, { color: theme.text }]}>{fmt(item.renta)}</Text>
          {atrasado && (saldos[item.id]?.total ?? 0) > Number(item.renta) + 0.5 && (
            <Text style={[styles.rowMora, { color: theme.danger }]}>Debe {fmt0(saldos[item.id]?.total ?? 0)} en total</Text>
          )}
        </View>

        <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={m.icon} size={15} color={theme.textSecondary} />
          <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>{m.label}</Text>
        </View>

        <View style={{ flex: 2, alignItems: 'flex-start', gap: 4 }}>
          <Badge label={chip.label} variant={chip.variant} size="sm" />
          {state === 'revision' && (
            <View style={[styles.compTag, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)' }]}>
              <Ionicons name="image-outline" size={11} color={theme.textMuted} />
              <Text style={[styles.compTagText, { color: theme.textSecondary }]}>comprobante</Text>
            </View>
          )}
        </View>

        <View style={[styles.tdActions, { width: 110 }]}>
          {state === 'revision' ? (
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: theme.primary }]}
              onPress={() => validar(item.id, e?.pago_id)}
              disabled={busy}
            >
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.smallBtnText}>Validar</Text>}
            </TouchableOpacity>
          ) : state === 'pagado' ? (
            puedeCancelar(item) ? (
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.danger + '60' }]}
                onPress={() => cancelarPago(e.pago_id, { confirm: true })}
              >
                <Text style={[styles.smallBtnText, { color: theme.danger }]}>Cancelar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.iconBtn} onPress={() => router.push(`/(admin)/pagos/${item.id}`)}>
                <Ionicons name="receipt-outline" size={17} color={theme.textSecondary} />
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: theme.success }]}
              onPress={() => marcarPagado(item.id, item.nombre_completo)}
              disabled={busy}
            >
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.smallBtnText}>Pagar</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  function mesLabel() { return mesActual.charAt(0).toUpperCase() + mesActual.slice(1); }

  /* ---------------- Card móvil ---------------- */
  const mobileCard = ({ item, state }: { item: any; state: RowState }) => {
    const e = estados[item.id];
    const m = metodo(item.metodo_pago);
    const chip = stateChip(state);
    const busy = busyId === item.id;
    const atrasado = state === 'atrasado';
    return (
      <SurfaceCard key={item.id} style={styles.mCard} padding={0}>
        <TouchableOpacity style={styles.mBody} onPress={() => router.push(`/(admin)/pagos/${item.id}`)} activeOpacity={0.75}>
          <View style={[styles.deptoBox, { borderColor: atrasado ? theme.danger + '40' : theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)' }]}>
            <Text style={[styles.deptoBoxTop, { color: atrasado ? theme.danger : theme.textMuted }]}>Dpto</Text>
            <Text style={[styles.deptoBoxNum, { color: atrasado ? theme.danger : theme.text }]}>{item.depto_numero}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
            <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{item.nombre_completo}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.rowMonto, { color: theme.text }]}>{fmt(item.renta)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name={m.icon} size={13} color={theme.textSecondary} />
                <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>{m.label}</Text>
              </View>
            </View>
            {diaPago(item) != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="calendar-outline" size={12} color={atrasado ? theme.danger : theme.textMuted} />
                <Text style={[styles.rowMeta, { fontSize: 11, color: atrasado ? theme.danger : theme.textMuted }]}>
                  {atrasado ? `Venció el ${diaPago(item)}` : `Paga el día ${diaPago(item)}`}
                </Text>
              </View>
            )}
            {atrasado && (saldos[item.id]?.total ?? 0) > Number(item.renta) + 0.5 && (
              <Text style={[styles.rowMeta, { fontSize: 11, fontWeight: '700', color: theme.danger }]}>
                Debe {fmt0(saldos[item.id]?.total ?? 0)} en total
              </Text>
            )}
            <Badge label={chip.label} variant={chip.variant} size="sm" />
          </View>
        </TouchableOpacity>
        <View style={[styles.mActions, { borderTopColor: theme.border }]}>
          {state === 'revision' ? (
            <TouchableOpacity style={styles.mActionBtn} onPress={() => validar(item.id, e?.pago_id)} disabled={busy}>
              {busy ? <ActivityIndicator size="small" color={theme.primary} /> : (<>
                <Ionicons name="checkmark-done-outline" size={15} color={theme.primary} />
                <Text style={[styles.mActionText, { color: theme.primary }]}>Validar comprobante</Text>
              </>)}
            </TouchableOpacity>
          ) : state === 'pagado' ? (
            <>
              <TouchableOpacity style={styles.mActionBtn} onPress={() => router.push(`/(admin)/pagos/${item.id}`)}>
                <Ionicons name="receipt-outline" size={15} color={theme.textSecondary} />
                <Text style={[styles.mActionText, { color: theme.textSecondary }]}>Ver recibo</Text>
              </TouchableOpacity>
              {puedeCancelar(item) && (
                <TouchableOpacity
                  style={[styles.mActionBtn, { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.border }]}
                  onPress={() => cancelarPago(e.pago_id, { confirm: true })}
                >
                  <Ionicons name="close-circle-outline" size={15} color={theme.danger} />
                  <Text style={[styles.mActionText, { color: theme.danger }]}>Cancelar pago</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity style={styles.mActionBtn} onPress={() => marcarPagado(item.id, item.nombre_completo)} disabled={busy}>
              {busy ? <ActivityIndicator size="small" color={theme.success} /> : (<>
                <Ionicons name="checkmark-circle-outline" size={15} color={theme.success} />
                <Text style={[styles.mActionText, { color: theme.success }]}>Marcar pagado</Text>
              </>)}
            </TouchableOpacity>
          )}
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
        <View style={[styles.header, !isDesktop && { paddingTop: insets.top + 20 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Pagos y Cobranza</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {inquilinos.length} inquilino{inquilinos.length !== 1 ? 's' : ''} activo{inquilinos.length !== 1 ? 's' : ''} · {mesLabel()}
            </Text>
          </View>
        </View>

        {loading && inquilinos.length === 0 ? (
          <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
        ) : (
          <>
            {kpiRow}

            <SurfaceCard style={{ overflow: 'hidden' }} padding={0}>
              {toolbar}

              {isDesktop && visible.length > 0 && (
                <View style={[styles.thead, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)' }]}>
                  <Text style={[styles.th, { flex: 4, color: theme.textMuted }]}>UNIDAD / INQUILINO</Text>
                  <Text style={[styles.th, { flex: 2, color: theme.textMuted }]}>MONTO</Text>
                  <Text style={[styles.th, { flex: 2, color: theme.textMuted }]}>MÉTODO</Text>
                  <Text style={[styles.th, { flex: 2, color: theme.textMuted }]}>ESTADO</Text>
                  <Text style={[styles.th, { width: 110, textAlign: 'right', color: theme.textMuted }]}>ACCIONES</Text>
                </View>
              )}

              {visible.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="card-outline" size={40} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    {search ? `Sin resultados para "${search}"` : 'Sin pagos en esta categoría'}
                  </Text>
                </View>
              ) : isDesktop ? (
                visible.map((r, i) => tableRow(r, i))
              ) : (
                <View style={{ padding: 12, gap: 10 }}>
                  {visible.map(r => mobileCard(r))}
                </View>
              )}
            </SurfaceCard>
          </>
        )}
      </ScrollView>
      {sortModal}

      {undo && (
        <View
          style={[styles.undoWrap, { bottom: isDesktop ? 24 : insets.bottom + Theme.layout.dockHeight + 12 }]}
          pointerEvents="box-none"
        >
          <View style={styles.undoBar}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.undoText} numberOfLines={1}>{undo.nombre} — pago registrado</Text>
            <TouchableOpacity onPress={() => cancelarPago(undo.pagoId)} style={styles.undoBtn}>
              <Text style={styles.undoBtnText}>Deshacer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearUndo} hitSlop={8}>
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { paddingVertical: 80, alignItems: 'center' },
  content: { paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.md, gap: Theme.spacing.lg },
  contentDesktop: { maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: 40, paddingTop: 28 },

  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, marginTop: 2 },

  kpiRow: { gap: 12, flexDirection: 'row', flexWrap: 'wrap' },
  kpiRowDesktop: { flexWrap: 'nowrap' },
  kpi: { flex: 1, minWidth: 150, minHeight: 116, justifyContent: 'space-between' },
  kpiHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  kpiLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  kpiValue: { fontSize: 21, fontWeight: '800', letterSpacing: -0.6 },
  kpiUnit: { fontSize: 12, fontWeight: '600' },
  kpiMini: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  progressWrap: { marginTop: 8, gap: 5 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  metodoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metodoText: { fontSize: 12, fontWeight: '500' },
  metodoPct: { fontSize: 12, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4 },

  toolbar: { padding: 12, gap: 10, borderBottomWidth: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, maxWidth: 320, height: 36, paddingHorizontal: 10, borderRadius: Theme.borderRadius.sm, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 13, height: '100%' },
  tabRow: { gap: 6, alignItems: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Theme.borderRadius.sm, borderWidth: 1 },
  tabText: { fontSize: 12.5, fontWeight: '600' },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: 10, paddingVertical: 6, maxWidth: 320,
  },
  sortBtnText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  sortOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sortSheet: { width: '100%', maxWidth: 380, borderRadius: 18, borderWidth: 1, padding: 10 },
  sortTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, textTransform: 'uppercase' },
  sortOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12, paddingVertical: 13, borderRadius: 12 },
  sortOptText: { fontSize: 14 },
  undoWrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  undoBar: {
    width: '100%', maxWidth: 460, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1E293B', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  undoText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  undoBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  undoBtnText: { color: '#38BDF8', fontWeight: '800', fontSize: 13 },

  thead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  th: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },

  tr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  tdInq: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deptoBox: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  deptoBoxTop: { fontSize: 8, fontWeight: '600', letterSpacing: 0.3 },
  deptoBoxNum: { fontSize: 13, fontWeight: '800', lineHeight: 15 },
  rowName: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  rowMeta: { fontSize: 11.5, marginTop: 2 },
  rowMonto: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rowMora: { fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  compTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  compTagText: { fontSize: 9.5, fontWeight: '600' },
  tdActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  smallBtn: { paddingHorizontal: 14, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minWidth: 66 },
  smallBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  mCard: { overflow: 'hidden' },
  mBody: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  mActions: { borderTopWidth: 1, flexDirection: 'row' },
  mActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  mActionText: { fontSize: 12.5, fontWeight: '700' },

  empty: { alignItems: 'center', gap: 10, paddingVertical: 48 },
  emptyText: { fontSize: 13 },
});
