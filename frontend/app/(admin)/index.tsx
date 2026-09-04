import { StyleSheet, View, Text, ScrollView, useColorScheme, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../components/ui/Badge';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useCallback, type ReactNode } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import api from '../../services/api';

/** Card sólida estilo "bento" (superficie opaca + borde hairline). */
function Card({ children, style, padding = Theme.spacing.lg, borderRadius = Theme.borderRadius.lg }: {
  children: ReactNode;
  style?: any;
  padding?: number;
  borderRadius?: number;
}) {
  const t = useColorScheme() === 'dark' ? Colors.dark : Colors.light;
  return (
    <View style={[{ backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius, padding }, style]}>
      {children}
    </View>
  );
}

interface QuickAction {
  icon: any;
  label: string;
  onPress: () => void;
  primary?: boolean;
}

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState<any>(null);
  const [deudaTotal, setDeudaTotal] = useState(0);
  const [deudores, setDeudores] = useState(0);
  const [departamentos, setDepartamentos] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [proximosPagos, setProximosPagos] = useState<any[]>([]);
  const [proximosVencer, setProximosVencer] = useState<any[]>([]);
  const [contratosVencidos, setContratosVencidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getDepartamentosStats(),
      api.getInquilinos({ estado: 'activo' }),
      api.getResumenDeuda(),
      api.getDepartamentos().catch(() => ({ data: [] })),
      api.getTickets({ estado: 'abierto' }).catch(() => ({ data: [] })),
    ])
      .then(([sRes, iRes, deudaRes, dRes, tRes]) => {
        setStats(sRes.data);
        setDeudaTotal(deudaRes.data?.total_general || 0);
        setDeudores((deudaRes.data?.por_departamento || []).filter((d: any) => Number(d.deuda_total) > 0).length);
        setDepartamentos(dRes.data || []);
        setTickets(tRes.data || []);
        const inquilinos: any[] = iRes.data || [];
        const hoy = new Date();
        const diaHoy = hoy.getDate();

        const pagos = inquilinos
          .filter(inq => {
            const match = inq.fecha_pago?.match(/(\d+)/);
            if (!match) return false;
            const diaPago = parseInt(match[1], 10);
            const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
            const diff = diaPago >= diaHoy ? diaPago - diaHoy : diasMes - diaHoy + diaPago;
            return diff <= 5;
          })
          .sort((a, b) => {
            const da = parseInt(a.fecha_pago?.match(/(\d+)/)?.[1] || '0', 10);
            const db = parseInt(b.fecha_pago?.match(/(\d+)/)?.[1] || '0', 10);
            return da - db;
          })
          .slice(0, 6);
        setProximosPagos(pagos);

        const vencer = inquilinos
          .filter(inq => {
            if (!inq.fecha_termino) return false;
            const diff = (new Date(inq.fecha_termino).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 30;
          })
          .sort((a, b) => new Date(a.fecha_termino).getTime() - new Date(b.fecha_termino).getTime())
          .slice(0, 5);
        setProximosVencer(vencer);

        const vencidos = inquilinos
          .filter(inq => {
            if (!inq.fecha_termino) return false;
            return new Date(inq.fecha_termino).getTime() < hoy.getTime();
          })
          .sort((a, b) => new Date(b.fecha_termino).getTime() - new Date(a.fecha_termino).getTime())
          .slice(0, 5);
        setContratosVencidos(vencidos);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []));

  const fmtMoney = (n: number | string) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n));

  const getInitials = (nombre: string) =>
    nombre?.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || 'NA';

  const getDiaPago = (fechaPago: string) => {
    const match = fechaPago?.match(/(\d+)/);
    return match ? `Día ${match[1]}` : fechaPago;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const getFormattedDate = () =>
    new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const quickActions: QuickAction[] = [
    { icon: 'add', label: 'Registrar Pago', primary: true, onPress: () => router.push('/pagos') },
    { icon: 'person-add-outline', label: 'Nuevo Inquilino', onPress: () => router.push('/inquilinos/nuevo') },
    { icon: 'document-text-outline', label: 'Generar Contrato', onPress: () => router.push('/contratos') },
    { icon: 'qr-code-outline', label: 'Escanear QR', onPress: () => router.push('/scan') },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient colors={isDark ? ['#0E1321', '#1A1F2E'] : ['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>Cargando dashboard...</Text>
      </View>
    );
  }

  const ocupados = Number(stats?.ocupados || 0);
  const total = Number(stats?.total || 0);
  const disponibles = Number(stats?.disponibles || 0);
  const ingresos = Number(stats?.ingresos_mensuales || 0);
  const pctOcupacion = total > 0 ? Math.round((ocupados / total) * 100) : 0;
  const contratosVencer = Number(stats?.contratos_por_vencer ?? proximosVencer.length);
  const contratosYaVencidos = Number(stats?.contratos_vencidos ?? contratosVencidos.length);

  const paddingBottom = isDesktop ? 40 : insets.bottom + Theme.layout.dockHeight;
  const paddingTop = isDesktop ? 28 : insets.top + 20;

  const estadoColor = (estado: string) =>
    estado === 'ocupado' ? theme.primary : estado === 'mantenimiento' ? theme.warning : theme.success;

  /* ---------------- Cards resumen (móvil) ---------------- */
  const revenueCard = (
    <Card style={{}} padding={Theme.spacing.lg} borderRadius={Theme.borderRadius.lg}>
      <View style={styles.kpiHead}>
        <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>INGRESO MENSUAL</Text>
        <View style={[styles.kpiChip, { backgroundColor: theme.successLight }]}>
          <Text style={[styles.kpiChipText, { color: theme.success }]}>Ocupación {pctOcupacion}%</Text>
        </View>
      </View>
      <Text style={[styles.kpiValue, { color: theme.text, fontSize: 28 }]}>{fmtMoney(ingresos)}</Text>
      <Text style={[styles.kpiSub, { color: theme.textSecondary, marginBottom: 12 }]}>{ocupados} de {total} deptos generando renta</Text>
      <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)' }]}>
        <View style={[styles.progressFill, { width: `${pctOcupacion}%`, backgroundColor: theme.primary }]} />
      </View>
    </Card>
  );

  const attentionCard = (deudaTotal > 0 || contratosVencer > 0 || contratosYaVencidos > 0) && (
    <Card style={{ borderLeftWidth: 3, borderLeftColor: theme.danger }} padding={Theme.spacing.lg} borderRadius={Theme.borderRadius.lg}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <Ionicons name="warning" size={16} color={theme.danger} />
        <Text style={[styles.kpiLabel, { color: theme.danger }]}>ATENCIÓN REQUERIDA</Text>
      </View>
      {deudaTotal > 0 && (
        <TouchableOpacity style={[styles.attnRow, { borderBottomColor: theme.border }]} onPress={() => router.push('/pagos')} activeOpacity={0.7}>
          <View>
            <Text style={[styles.attnLabel, { color: theme.text }]}>Renta por cobrar</Text>
            <Text style={[styles.attnSub, { color: theme.textSecondary }]}>{deudores} inquilino{deudores > 1 ? 's' : ''} con saldo</Text>
          </View>
          <Text style={[styles.attnValue, { color: theme.danger }]}>{fmtMoney(deudaTotal)}</Text>
        </TouchableOpacity>
      )}
      {(contratosVencer > 0 || contratosYaVencidos > 0) && (
        <TouchableOpacity style={[styles.attnRow, { borderBottomWidth: 0 }]} onPress={() => router.push('/contratos')} activeOpacity={0.7}>
          <View>
            <Text style={[styles.attnLabel, { color: theme.text }]}>Contratos por renovar</Text>
            <Text style={[styles.attnSub, { color: theme.textSecondary }]}>
              {contratosYaVencidos > 0 ? `${contratosYaVencidos} vencido${contratosYaVencidos > 1 ? 's' : ''} · ` : ''}en 30 días
            </Text>
          </View>
          <View style={[styles.countPill, { backgroundColor: theme.warningLight }]}>
            <Text style={[styles.countPillText, { color: theme.warning }]}>{contratosVencer}</Text>
          </View>
        </TouchableOpacity>
      )}
    </Card>
  );

  /* ---------------- KPI cards ---------------- */
  const kpiOcupacion = (
    <Card style={styles.kpi} padding={Theme.spacing.lg} borderRadius={Theme.borderRadius.lg}>
      <View style={styles.kpiHead}>
        <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>OCUPACIÓN TOTAL</Text>
      </View>
      <View style={styles.kpiBodyRow}>
        <View>
          <Text style={[styles.kpiValue, { color: theme.text }]}>{pctOcupacion}%</Text>
          <Text style={[styles.kpiSub, { color: theme.textSecondary }]}>{ocupados}/{total} deptos</Text>
        </View>
        <ProgressRing
          size={54}
          strokeWidth={4}
          progress={pctOcupacion}
          color={theme.primary}
          trackColor={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.09)'}
          fillColor={theme.card}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textSecondary }}>{ocupados}</Text>
        </ProgressRing>
      </View>
    </Card>
  );

  const kpiIngresos = (
    <Card style={styles.kpi} padding={Theme.spacing.lg} borderRadius={Theme.borderRadius.lg}>
      <View style={styles.kpiHead}>
        <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>INGRESO MENSUAL</Text>
        <View style={[styles.kpiChip, { backgroundColor: theme.successLight }]}>
          <Ionicons name="trending-up" size={11} color={theme.success} />
          <Text style={[styles.kpiChipText, { color: theme.success }]}>{ocupados} rentas</Text>
        </View>
      </View>
      <View style={styles.kpiBodyRow}>
        <View>
          <Text style={[styles.kpiValue, { color: theme.text }]}>{fmtMoney(ingresos)}</Text>
          <Text style={[styles.kpiSub, { color: theme.textSecondary }]}>MXN / mes</Text>
        </View>
      </View>
    </Card>
  );

  const kpiDeuda = (
    <Card
      style={[styles.kpi, deudaTotal > 0 && { borderLeftWidth: 3, borderLeftColor: theme.warning }]}
      padding={Theme.spacing.lg}
      borderRadius={Theme.borderRadius.lg}
    >
      <View style={styles.kpiHead}>
        <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>CUENTAS POR COBRAR</Text>
        {deudaTotal > 0 && <Ionicons name="warning" size={16} color={theme.warning} />}
      </View>
      <View style={styles.kpiBodyRow}>
        <View>
          <Text style={[styles.kpiValue, { color: deudaTotal > 0 ? theme.warning : theme.text }]}>{fmtMoney(deudaTotal)}</Text>
          <Text style={[styles.kpiSub, { color: theme.textSecondary }]}>
            {deudores > 0 ? `${deudores} inquilino${deudores > 1 ? 's' : ''} con saldo` : 'Sin adeudos'}
          </Text>
        </View>
      </View>
    </Card>
  );

  const kpiContratos = (
    <Card style={styles.kpi} padding={Theme.spacing.lg} borderRadius={Theme.borderRadius.lg}>
      <View style={styles.kpiHead}>
        <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>CONTRATOS POR VENCER</Text>
        <Ionicons name="calendar-outline" size={15} color={theme.textMuted} />
      </View>
      <View style={styles.kpiBodyRow}>
        <View>
          <Text style={[styles.kpiValue, { color: theme.text }]}>{contratosVencer}</Text>
          <Text style={[styles.kpiSub, { color: theme.textSecondary }]}>en 30 días</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          {proximosVencer.slice(0, 2).map(inq => {
            const dias = Math.ceil((new Date(inq.fecha_termino).getTime() - Date.now()) / 86400000);
            return (
              <Text key={inq.id} style={[styles.kpiMini, { color: theme.warning }]}>
                Depto {inq.depto_numero}: {dias}d
              </Text>
            );
          })}
          {contratosYaVencidos > 0 && (
            <Text style={[styles.kpiMini, { color: theme.danger }]}>{contratosYaVencidos} vencido{contratosYaVencidos > 1 ? 's' : ''}</Text>
          )}
        </View>
      </View>
    </Card>
  );

  /* ---------------- Listas ---------------- */
  const pagosCard = (
    <Card style={styles.panel} padding={0} borderRadius={Theme.borderRadius.lg}>
      <View style={[styles.panelHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.panelTitle, { color: theme.text }]}>Próximos Pagos de Renta</Text>
        <TouchableOpacity onPress={() => router.push('/pagos')}>
          <Text style={[styles.panelAction, { color: theme.primary }]}>Ver todos</Text>
        </TouchableOpacity>
      </View>
      {proximosPagos.length === 0 ? (
        <View style={styles.panelEmpty}>
          <Ionicons name="checkmark-circle-outline" size={28} color={theme.success} />
          <Text style={[styles.panelEmptyText, { color: theme.textSecondary }]}>Sin pagos en los próximos días</Text>
        </View>
      ) : (
        proximosPagos.map((inq, i) => (
          <TouchableOpacity
            key={inq.id}
            style={[styles.payRow, i < proximosPagos.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
            onPress={() => router.push(`/inquilinos/${inq.id}` as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
              <Text style={[styles.avatarText, { color: theme.primary }]}>{getInitials(inq.nombre_completo)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.payName, { color: theme.text }]} numberOfLines={1}>{inq.nombre_completo}</Text>
              <View style={styles.payMetaRow}>
                <View style={[styles.deptoTag, { backgroundColor: theme.primary }]}>
                  <Text style={styles.deptoTagText}>Depto {inq.depto_numero}</Text>
                </View>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[styles.payAmount, { color: theme.text }]}>{fmtMoney(inq.renta)}</Text>
              <Badge label={getDiaPago(inq.fecha_pago)} variant="warning" size="sm" />
            </View>
          </TouchableOpacity>
        ))
      )}
    </Card>
  );

  const vencerCard = (proximosVencer.length > 0 || contratosVencidos.length > 0) && (
    <Card style={styles.panel} padding={0} borderRadius={Theme.borderRadius.lg}>
      <View style={[styles.panelHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.panelTitle, { color: theme.text }]}>Contratos</Text>
        <View style={[styles.countPill, { backgroundColor: theme.warningLight }]}>
          <Text style={[styles.countPillText, { color: theme.warning }]}>{proximosVencer.length + contratosVencidos.length}</Text>
        </View>
      </View>
      {[...contratosVencidos.map(i => ({ ...i, _vencido: true })), ...proximosVencer.map(i => ({ ...i, _vencido: false }))].map((inq, i, arr) => {
        const dias = Math.ceil((new Date(inq.fecha_termino).getTime() - Date.now()) / 86400000);
        const urgente = !inq._vencido && dias <= 7;
        return (
          <TouchableOpacity
            key={inq.id}
            style={[styles.miniRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
            onPress={() => router.push(`/contratos/generar/${inq.id}` as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.miniAvatar, { backgroundColor: inq._vencido ? theme.dangerLight : urgente ? theme.dangerLight : theme.warningLight }]}>
              <Text style={[styles.avatarText, { color: inq._vencido || urgente ? theme.danger : theme.warning, fontSize: 12 }]}>{getInitials(inq.nombre_completo)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.payName, { color: theme.text, fontSize: 13 }]} numberOfLines={1}>{inq.nombre_completo}</Text>
              <Text style={[styles.miniSub, { color: theme.textSecondary }]}>Depto {inq.depto_numero}</Text>
            </View>
            <Badge
              label={inq._vencido ? `vencido ${Math.abs(dias)}d` : urgente ? `¡${dias}d!` : `${dias}d`}
              variant={inq._vencido || urgente ? 'danger' : 'warning'}
              size="sm"
            />
          </TouchableOpacity>
        );
      })}
    </Card>
  );

  const ticketsCard = tickets.length > 0 && (
    <Card style={styles.panel} padding={0} borderRadius={Theme.borderRadius.lg}>
      <View style={[styles.panelHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.panelTitle, { color: theme.text }]}>Tickets de Mantenimiento</Text>
        <View style={[styles.countPill, { backgroundColor: theme.dangerLight }]}>
          <Text style={[styles.countPillText, { color: theme.danger }]}>{tickets.length}</Text>
        </View>
      </View>
      {tickets.slice(0, 4).map((t, i) => (
        <TouchableOpacity
          key={t.id}
          style={[styles.miniRow, i < Math.min(tickets.length, 4) - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
          onPress={() => router.push('/tickets')}
          activeOpacity={0.7}
        >
          <View style={[styles.miniAvatar, { backgroundColor: theme.warningLight }]}>
            <Ionicons name="build-outline" size={15} color={theme.warning} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.payName, { color: theme.text, fontSize: 13 }]} numberOfLines={1}>{t.titulo || t.asunto || 'Ticket'}</Text>
            <Text style={[styles.miniSub, { color: theme.textSecondary }]} numberOfLines={1}>
              {t.depto_numero ? `Depto ${t.depto_numero}` : t.nombre_completo || 'Sin depto'}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </Card>
  );

  const depCount = { ocupado: 0, disponible: 0, mantenimiento: 0 } as Record<string, number>;
  departamentos.forEach(d => { depCount[d.estado] = (depCount[d.estado] || 0) + 1; });
  const nTot = departamentos.length;
  const nOcup = depCount.ocupado || 0;
  const nDisp = depCount.disponible || 0;
  const nMant = depCount.mantenimiento || 0;
  const pctFloor = nTot > 0 ? Math.round((nOcup / nTot) * 100) : 0;
  const rentaActiva = departamentos.reduce(
    (s, d) => s + (d.estado === 'ocupado' ? Number(d?.inquilino_actual?.renta ?? d?.renta ?? 0) : 0),
    0,
  );

  const floorStat = (color: string, label: string, value: number) => (
    <View style={styles.floorStatRow}>
      <View style={styles.floorStatLeft}>
        <View style={[styles.legendDot, { backgroundColor: color }]} />
        <Text style={[styles.floorStatLabel, { color: theme.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.floorStatValue, { color: theme.text }]}>{value}</Text>
    </View>
  );

  const floorCard = departamentos.length > 0 && (
    <Card style={styles.panel} padding={0} borderRadius={Theme.borderRadius.lg}>
      <View style={[styles.panelHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.panelTitle, { color: theme.text }]}>Ocupación</Text>
        <TouchableOpacity onPress={() => router.push('/departamentos')}>
          <Text style={[styles.panelAction, { color: theme.primary }]}>Detalle</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.floorBody}>
        <View style={styles.floorTopRow}>
          <View>
            <Text style={[styles.floorPct, { color: theme.text }]}>{pctFloor}%</Text>
            <Text style={[styles.floorPctSub, { color: theme.textSecondary }]}>
              {nOcup} de {nTot} {nTot === 1 ? 'unidad ocupada' : 'unidades ocupadas'}
            </Text>
          </View>
          {rentaActiva > 0 && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.floorRenta, { color: theme.success }]}>{fmtMoney(rentaActiva)}</Text>
              <Text style={[styles.floorRentaSub, { color: theme.textMuted }]}>renta activa / mes</Text>
            </View>
          )}
        </View>

        <View style={[styles.floorBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}>
          {nOcup > 0 && <View style={{ flex: nOcup, backgroundColor: theme.primary }} />}
          {nMant > 0 && <View style={{ flex: nMant, backgroundColor: theme.warning }} />}
          {nDisp > 0 && <View style={{ flex: nDisp, backgroundColor: theme.success }} />}
        </View>

        <View style={{ gap: 8 }}>
          {floorStat(theme.primary, 'Ocupados', nOcup)}
          {floorStat(theme.success, 'Disponibles', nDisp)}
          {nMant > 0 && floorStat(theme.warning, 'En mantenimiento', nMant)}
        </View>
      </View>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={isDark ? ['#0E1321', '#1A1F2E'] : ['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFill} />

      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop, paddingBottom }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.dateText, { color: theme.primary }]}>{getFormattedDate()}</Text>
            <Text style={[styles.title, { color: theme.text }]}>{getGreeting()} 👋</Text>
          </View>
        </View>

        {/* Quick actions */}
        {isDesktop ? (
          <View style={styles.pillRow}>
            {quickActions.map((a) => (
              <TouchableOpacity
                key={a.label}
                style={[
                  styles.pill,
                  a.primary
                    ? { backgroundColor: theme.primary }
                    : { borderWidth: 1, borderColor: theme.border, backgroundColor: 'transparent' },
                ]}
                onPress={a.onPress}
                activeOpacity={0.85}
              >
                <Ionicons name={a.icon} size={16} color={a.primary ? '#fff' : theme.text} />
                <Text style={[styles.pillText, { color: a.primary ? '#fff' : theme.text }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.qaGrid}>
            {quickActions.map((a) => (
              <TouchableOpacity key={a.label} style={[styles.qaTile, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={a.onPress} activeOpacity={0.8}>
                <View style={[styles.qaTileIcon, { backgroundColor: a.primary ? theme.primary : theme.primaryLight }]}>
                  <Ionicons name={a.icon} size={20} color={a.primary ? '#fff' : theme.primary} />
                </View>
                <Text style={[styles.qaTileText, { color: theme.text }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* KPIs — bento en desktop, resumen compacto en móvil */}
        {isDesktop ? (
          <View style={[styles.kpiGrid, styles.kpiGridDesktop]}>
            {kpiOcupacion}
            {kpiIngresos}
            {kpiDeuda}
            {kpiContratos}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {revenueCard}
            {attentionCard}
          </View>
        )}

        {/* Contenido principal */}
        {isDesktop ? (
          <View style={styles.mainGrid}>
            <View style={styles.mainCol}>{pagosCard}</View>
            <View style={styles.sideCol}>
              {vencerCard}
              {ticketsCard}
              {floorCard}
            </View>
          </View>
        ) : (
          <View style={{ gap: Theme.spacing.lg }}>
            {pagosCard}
            {vencerCard}
            {ticketsCard}
            {floorCard}
          </View>
        )}

        {/* Empty global */}
        {proximosPagos.length === 0 && proximosVencer.length === 0 && contratosVencidos.length === 0 && tickets.length === 0 && (
          <Card style={{}} padding={Theme.spacing.xxxl} borderRadius={Theme.borderRadius.lg}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.successLight }]}>
                <Ionicons name="checkmark-circle" size={34} color={theme.success} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Todo en orden</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>No hay pagos, contratos ni tickets que requieran tu atención.</Text>
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '500' },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Theme.spacing.lg,
    maxWidth: Theme.layout.maxWidth,
    alignSelf: 'center',
    width: '100%',
    gap: Theme.spacing.lg,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dateText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },

  /* pills desktop */
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Theme.borderRadius.md },
  pillText: { fontSize: 13, fontWeight: '600' },

  /* quick action grid mobile */
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  qaTile: {
    width: '48%',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
  },
  qaTileIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  qaTileText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  /* KPI */
  kpiGrid: { gap: 12 },
  kpiGridDesktop: { flexDirection: 'row' },
  kpi: { flex: 1, minHeight: 116, justifyContent: 'space-between' },
  kpiHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  kpiLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6 },
  kpiChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  kpiChipText: { fontSize: 10, fontWeight: '700' },
  kpiBodyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  kpiValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.8, marginBottom: 2 },
  kpiSub: { fontSize: 12, fontWeight: '500' },
  kpiMini: { fontSize: 11, fontWeight: '600' },

  /* panels */
  mainGrid: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  mainCol: { flex: 2, minWidth: 0 },
  sideCol: { flex: 1, minWidth: 0, gap: 12 },
  panel: { overflow: 'hidden' },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  panelTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  panelAction: { fontSize: 12, fontWeight: '600' },
  panelEmpty: { alignItems: 'center', gap: 8, padding: 28 },
  panelEmptyText: { fontSize: 13 },
  countPill: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  countPillText: { fontSize: 11, fontWeight: '800' },

  payRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { fontWeight: '800', fontSize: 13 },
  payName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  payMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deptoTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  deptoTagText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  payAmount: { fontSize: 14, fontWeight: '800' },

  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  miniAvatar: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  miniSub: { fontSize: 11, marginTop: 1 },

  legendDot: { width: 8, height: 8, borderRadius: 4 },
  floorBody: { padding: 16, gap: 14 },
  floorTopRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  floorPct: { fontSize: 30, fontWeight: '800', lineHeight: 34, letterSpacing: -0.5 },
  floorPctSub: { fontSize: 12, marginTop: 2 },
  floorRenta: { fontSize: 15, fontWeight: '700' },
  floorRentaSub: { fontSize: 10.5, marginTop: 1 },
  floorBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  floorStatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  floorStatLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  floorStatLabel: { fontSize: 12.5, fontWeight: '600' },
  floorStatValue: { fontSize: 13, fontWeight: '800' },

  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  attnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  attnLabel: { fontSize: 13, fontWeight: '600' },
  attnSub: { fontSize: 11, marginTop: 2 },
  attnValue: { fontSize: 15, fontWeight: '800' },

  emptyIconWrap: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
});
