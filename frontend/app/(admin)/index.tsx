import { StyleSheet, View, Text, ScrollView, useColorScheme, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '../../components/ui/GlassCard';
import { Badge } from '../../components/ui/Badge';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import api from '../../services/api';

interface QuickActionItem {
  icon: any;
  label: string;
  color: string;
  bgLight: string;
  bgDark: string;
  onPress: () => void;
}

function QuickActionBtn({ item, isDark }: { item: QuickActionItem; isDark: boolean }) {
  return (
    <TouchableOpacity style={styles.qaBtn} onPress={item.onPress} activeOpacity={0.75}>
      <View style={[styles.qaIcon, { backgroundColor: isDark ? item.bgDark : item.bgLight }]}>
        <Ionicons name={item.icon} size={22} color={item.color} />
      </View>
      <Text style={[styles.qaLabel, { color: isDark ? Colors.dark.textSecondary : Colors.light.textSecondary }]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
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
  const [proximosPagos, setProximosPagos] = useState<any[]>([]);
  const [proximosVencer, setProximosVencer] = useState<any[]>([]);
  const [contratosVencidos, setContratosVencidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getDepartamentosStats(),
      api.getInquilinos({ estado: 'activo' }),
    ])
      .then(([sRes, iRes]) => {
        setStats(sRes.data);
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
          .slice(0, 5);
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

  const formatMoney = (n: number | string) =>
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
    new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date());

  const quickActions: QuickActionItem[] = [
    { icon: 'person-add', label: 'Nuevo Inquilino', color: theme.primary, bgLight: Colors.light.primaryLight, bgDark: Colors.dark.primaryLight, onPress: () => router.push('/inquilinos/nuevo') },
    { icon: 'home-outline', label: 'Nuevo Depto', color: theme.success, bgLight: Colors.light.successLight, bgDark: Colors.dark.successLight, onPress: () => router.push('/departamentos') },
    { icon: 'document-text-outline', label: 'Contratos', color: theme.accent, bgLight: '#F3E8FF', bgDark: 'rgba(139,92,246,0.18)', onPress: () => router.push('/contratos') },
    { icon: 'card-outline', label: 'Pagos', color: theme.info, bgLight: Colors.light.infoLight, bgDark: Colors.dark.infoLight, onPress: () => router.push('/pagos') },
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>Cargando dashboard...</Text>
      </View>
    );
  }

  const ocupados = Number(stats?.ocupados || 0);
  const total = Number(stats?.total || 0);
  const ingresos = Number(stats?.ingresos_mensuales || 0);
  const pctOcupacion = total > 0 ? Math.round((ocupados / total) * 100) : 0;
  const contratosVencer = Number(stats?.contratos_por_vencer ?? 0);
  const contratosYaVencidos = Number(stats?.contratos_vencidos ?? 0);

  const paddingBottom = isDesktop ? 48 : insets.bottom + Theme.layout.dockHeight;
  const paddingTop = isDesktop ? 40 : insets.top + 24;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop, paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.dateText, { color: theme.primary }]}>{getFormattedDate()}</Text>
            <Text style={[styles.title, { color: theme.text }]}>{getGreeting()} 👋</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <GlassCard style={styles.qaCard} padding={Theme.spacing.lg}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Acciones rápidas</Text>
          <View style={styles.qaRow}>
            {quickActions.map((item, i) => (
              <QuickActionBtn key={i} item={item} isDark={isDark} />
            ))}
          </View>
        </GlassCard>

        {/* Métricas */}
        <View style={[styles.metricsRow, isDesktop && styles.metricsRowDesktop]}>
          {/* Ocupación */}
          <GlassCard style={styles.metricCard} padding={Theme.spacing.xl}>
            <View style={styles.metricTop}>
              <View style={[styles.metricIcon, { backgroundColor: theme.primaryLight }]}>
                <Ionicons name="business" size={20} color={theme.primary} />
              </View>
              <Badge label={`${pctOcupacion}%`} variant="primary" size="sm" />
            </View>
            <Text style={[styles.metricValue, { color: theme.text }]}>{ocupados}<Text style={[styles.metricTotal, { color: theme.textMuted }]}>/{total}</Text></Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Deptos ocupados</Text>
          </GlassCard>

          {/* Ingresos */}
          <GlassCard style={styles.metricCard} padding={Theme.spacing.xl}>
            <View style={styles.metricTop}>
              <View style={[styles.metricIcon, { backgroundColor: theme.successLight }]}>
                <Ionicons name="cash" size={20} color={theme.success} />
              </View>
            </View>
            <Text style={[styles.metricValue, { color: theme.text }]}>{formatMoney(ingresos)}</Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Ingresos mensuales</Text>
          </GlassCard>

          {/* Contratos */}
          <GlassCard style={styles.metricCard} padding={Theme.spacing.xl}>
            <View style={styles.metricTop}>
              <View style={[styles.metricIcon, { backgroundColor: contratosYaVencidos > 0 ? theme.dangerLight : contratosVencer > 0 ? theme.warningLight : theme.successLight }]}>
                <Ionicons name="document-text" size={20} color={contratosYaVencidos > 0 ? theme.danger : contratosVencer > 0 ? theme.warning : theme.success} />
              </View>
              {contratosYaVencidos > 0
                ? <Badge label="Vencidos" variant="danger" size="sm" />
                : contratosVencer > 0
                  ? <Badge label="Alerta" variant="warning" size="sm" />
                  : null
              }
            </View>
            <Text style={[styles.metricValue, { color: theme.text }]}>{contratosVencer}</Text>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Por vencer (30d)</Text>
            {contratosYaVencidos > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.danger }} />
                <Text style={{ fontSize: 12, color: theme.danger, fontWeight: '700' }}>
                  {contratosYaVencidos} ya vencido{contratosYaVencidos > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </GlassCard>
        </View>

        {/* Listas */}
        <View style={isDesktop ? styles.desktopGrid : undefined}>
          {/* Próximos Pagos */}
          <View style={isDesktop ? styles.desktopMain : undefined}>
            {proximosPagos.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Próximos Pagos</Text>
                  <View style={[styles.sectionBadge, { backgroundColor: theme.warningLight }]}>
                    <Text style={[styles.sectionBadgeText, { color: theme.warning }]}>{proximosPagos.length}</Text>
                  </View>
                </View>
                <View style={styles.listStack}>
                  {proximosPagos.map((inq) => (
                    <GlassCard key={inq.id} style={styles.listCard} borderRadius={Theme.borderRadius.lg} padding={0}>
                      <View style={styles.listRow}>
                        <View style={[styles.listAvatar, { backgroundColor: theme.primaryLight }]}>
                          <Text style={[styles.listAvatarText, { color: theme.primary }]}>{getInitials(inq.nombre_completo)}</Text>
                        </View>
                        <View style={styles.listInfo}>
                          <Text style={[styles.listName, { color: theme.text }]} numberOfLines={1}>{inq.nombre_completo}</Text>
                          <Text style={[styles.listSub, { color: theme.textSecondary }]}>Depto {inq.depto_numero}</Text>
                        </View>
                        <View style={styles.listRight}>
                          <Text style={[styles.listAmount, { color: theme.text }]}>${Number(inq.renta).toLocaleString()}</Text>
                          <Badge label={getDiaPago(inq.fecha_pago)} variant="warning" size="sm" />
                        </View>
                      </View>
                    </GlassCard>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Contratos por Vencer (próximos 30 días) */}
          {(proximosVencer.length > 0 || contratosVencidos.length > 0) && (
            <View style={[isDesktop ? styles.desktopSide : undefined, !isDesktop ? { marginTop: Theme.spacing.xxl } : undefined]}>
              {proximosVencer.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Por vencer (30d)</Text>
                    <View style={[styles.sectionBadge, { backgroundColor: theme.warningLight }]}>
                      <Text style={[styles.sectionBadgeText, { color: theme.warning }]}>{proximosVencer.length}</Text>
                    </View>
                  </View>
                  <View style={styles.listStack}>
                    {proximosVencer.map(inq => {
                      const diasRestantes = Math.ceil((new Date(inq.fecha_termino).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      const urgente = diasRestantes <= 7;
                      return (
                        <GlassCard key={inq.id} style={styles.listCard} borderRadius={Theme.borderRadius.lg} padding={0}>
                          <View style={styles.listRow}>
                            <View style={[styles.listAvatar, { backgroundColor: urgente ? theme.dangerLight : theme.warningLight }]}>
                              <Text style={[styles.listAvatarText, { color: urgente ? theme.danger : theme.warning }]}>
                                {getInitials(inq.nombre_completo)}
                              </Text>
                            </View>
                            <View style={styles.listInfo}>
                              <Text style={[styles.listName, { color: theme.text }]} numberOfLines={1}>{inq.nombre_completo}</Text>
                              <Text style={[styles.listSub, { color: theme.textSecondary }]}>Depto {inq.depto_numero}</Text>
                            </View>
                            <View style={styles.listRight}>
                              <Badge
                                label={urgente ? `¡${diasRestantes}d!` : `${diasRestantes}d`}
                                variant={urgente ? 'danger' : 'warning'}
                                size="sm"
                              />
                            </View>
                          </View>
                        </GlassCard>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Contratos ya vencidos */}
              {contratosVencidos.length > 0 && (
                <View style={[styles.section, proximosVencer.length > 0 && { marginTop: Theme.spacing.xl }]}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Contratos vencidos</Text>
                    <View style={[styles.sectionBadge, { backgroundColor: theme.dangerLight }]}>
                      <Text style={[styles.sectionBadgeText, { color: theme.danger }]}>{contratosVencidos.length}</Text>
                    </View>
                  </View>
                  <View style={styles.listStack}>
                    {contratosVencidos.map(inq => {
                      const diasVencido = Math.abs(Math.ceil((new Date(inq.fecha_termino).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                      return (
                        <GlassCard key={inq.id} style={styles.listCard} borderRadius={Theme.borderRadius.lg} padding={0}>
                          <View style={styles.listRow}>
                            <View style={[styles.listAvatar, { backgroundColor: theme.dangerLight }]}>
                              <Text style={[styles.listAvatarText, { color: theme.danger }]}>
                                {getInitials(inq.nombre_completo)}
                              </Text>
                            </View>
                            <View style={styles.listInfo}>
                              <Text style={[styles.listName, { color: theme.text }]} numberOfLines={1}>{inq.nombre_completo}</Text>
                              <Text style={[styles.listSub, { color: theme.textSecondary }]}>Depto {inq.depto_numero}</Text>
                            </View>
                            <View style={styles.listRight}>
                              <Badge label={`-${diasVencido}d`} variant="danger" size="sm" />
                            </View>
                          </View>
                        </GlassCard>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Empty state */}
        {proximosPagos.length === 0 && proximosVencer.length === 0 && contratosVencidos.length === 0 && (
          <GlassCard style={styles.emptyCard} padding={Theme.spacing.xxxl}>
            <View style={styles.emptyContent}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.successLight }]}>
                <Ionicons name="checkmark-circle" size={36} color={theme.success} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Todo en orden</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                No hay pagos pendientes ni contratos por vencer en los próximos días.
              </Text>
            </View>
          </GlassCard>
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
    gap: Theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  // Quick actions card
  qaCard: {},
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  qaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  qaBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  qaIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qaLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  // Metrics
  metricsRow: {
    flexDirection: 'column',
    gap: Theme.spacing.md,
  },
  metricsRowDesktop: {
    flexDirection: 'row',
    gap: Theme.spacing.xl,
  },
  metricCard: { flex: 1 },
  metricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  metricIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 4,
  },
  metricTotal: {
    fontSize: 18,
    fontWeight: '600',
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Lists
  desktopGrid: { flexDirection: 'row', gap: 32 },
  desktopMain: { flex: 2 },
  desktopSide: { flex: 1.2 },
  section: { gap: Theme.spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  listStack: { gap: 8 },
  listCard: {},
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    gap: 12,
  },
  listAvatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  listAvatarText: { fontWeight: '700', fontSize: 14 },
  listInfo: { flex: 1, minWidth: 0 },
  listName: { fontWeight: '600', fontSize: 14, marginBottom: 2 },
  listSub: { fontSize: 12, opacity: 0.8 },
  listRight: { alignItems: 'flex-end', gap: 5, flexShrink: 0 },
  listAmount: { fontWeight: '700', fontSize: 14 },
  // Empty
  emptyCard: {},
  emptyContent: { alignItems: 'center', gap: 12 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },
});
