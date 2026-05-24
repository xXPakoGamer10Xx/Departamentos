import { StyleSheet, View, Text, ScrollView, useColorScheme, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '../../components/ui/GlassCard';
import { QuickAction } from '../../components/ui/QuickAction';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import api from '../../services/api';

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState<any>(null);
  const [proximosPagos, setProximosPagos] = useState<any[]>([]);
  const [proximosVencer, setProximosVencer] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
            const diff = diaPago >= diaHoy ? diaPago - diaHoy : 31 - diaHoy + diaPago;
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
            return diff >= 0 && diff <= 60;
          })
          .sort((a, b) => new Date(a.fecha_termino).getTime() - new Date(b.fecha_termino).getTime())
          .slice(0, 3);
        setProximosVencer(vencer);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    if (hour < 12) return '¡Buen día!';
    if (hour < 18) return '¡Buenas tardes!';
    return '¡Buenas noches!';
  };

  const getFormattedDate = () => {
    return new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(new Date());
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const ocupados = Number(stats?.ocupados || 0);
  const total = Number(stats?.total || 0);
  const ingresos = Number(stats?.ingresos_mensuales || 0);
  const pctOcupacion = total > 0 ? Math.round((ocupados / total) * 100) : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#1a1a1a', '#000000'] : ['#F2F2F7', '#E5E5EA']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: isDesktop ? 0 : insets.top + 60,
          paddingBottom: isDesktop ? 32 : insets.bottom + 90,
          maxWidth: 1200,
          alignSelf: 'center',
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>{getFormattedDate()}</Text>
          <Text style={[styles.title, { color: theme.text }]}>{getGreeting()}</Text>
        </View>

        <View style={styles.quickActionsContainer}>
          <QuickAction
            icon="person-add"
            label="Nuevo Inquilino"
            onPress={() => router.push('/inquilinos/nuevo')}
          />
          <QuickAction
            icon="home"
            label="Nuevo Depto"
            onPress={() => router.push('/departamentos')}
          />
          <QuickAction
            icon="document-text"
            label="Contratos"
            onPress={() => router.push('/contratos')}
          />
          <QuickAction
            icon="settings"
            label="Configuración"
            onPress={() => router.push('/configuracion')}
          />
        </View>

        <View style={[styles.metricsContainer, isDesktop && styles.metricsGrid]}>
          <GlassCard style={[styles.metricCard, isDesktop && styles.metricCardDesktop]}>
            <View style={[styles.iconContainer, { backgroundColor: '#007AFF20' }]}>
              <Ionicons name="business" size={24} color="#007AFF" />
            </View>
            <View>
              <Text style={[styles.metricValue, { color: theme.text }]}>{pctOcupacion}%</Text>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Ocupación</Text>
              <Text style={[styles.metricSub, { color: theme.textSecondary }]}>{ocupados}/{total} deptos</Text>
            </View>
          </GlassCard>

          <GlassCard style={[styles.metricCard, isDesktop && styles.metricCardDesktop]}>
            <View style={[styles.iconContainer, { backgroundColor: '#34C75920' }]}>
              <Ionicons name="cash" size={24} color="#34C759" />
            </View>
            <View>
              <Text style={[styles.metricValue, { color: theme.text }]}>{formatMoney(ingresos)}</Text>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Ingresos/Mes</Text>
            </View>
          </GlassCard>

          <GlassCard style={[styles.metricCard, isDesktop && styles.metricCardDesktop]}>
            <View style={[styles.iconContainer, { backgroundColor: '#FF950020' }]}>
              <Ionicons name="document-text" size={24} color="#FF9500" />
            </View>
            <View>
              <Text style={[styles.metricValue, { color: theme.text }]}>{stats?.contratos_por_vencer ?? 0}</Text>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Por Vencer</Text>
              <Text style={[styles.metricSub, { color: theme.textSecondary }]}>próx. 30 días</Text>
            </View>
          </GlassCard>

          {isDesktop && (
            <GlassCard style={[styles.metricCard, styles.metricCardDesktop]}>
              <View style={[styles.iconContainer, { backgroundColor: '#8E8E9320' }]}>
                <Ionicons name="stats-chart" size={24} color="#8E8E93" />
              </View>
              <View>
                <Text style={[styles.metricValue, { color: theme.text }]}>98%</Text>
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Rendimiento</Text>
              </View>
            </GlassCard>
          )}
        </View>

        <View style={isDesktop ? styles.desktopGrid : null}>
          <View style={isDesktop ? styles.desktopMain : null}>
            {proximosPagos.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Próximos Pagos</Text>
                  {isDesktop && (
                    <TouchableOpacity>
                      <Text style={{ color: '#007AFF', fontWeight: '600' }}>Ver todos</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.sectionContent}>
                  {proximosPagos.map((inq, i) => (
                    <GlassCard key={inq.id} style={styles.listItem} borderRadius={Theme.borderRadius.lg}>
                      <View style={styles.listMain}>
                        <View style={[styles.avatar, { backgroundColor: '#007AFF20' }]}>
                          <Text style={[styles.avatarText, { color: '#007AFF' }]}>{getInitials(inq.nombre_completo)}</Text>
                        </View>
                        <View style={styles.listInfo}>
                          <Text style={[styles.listName, { color: theme.text }]}>{inq.nombre_completo}</Text>
                          <Text style={[styles.listSub, { color: theme.textSecondary }]}>Depto {inq.depto_numero}</Text>
                        </View>
                        <View style={styles.listRight}>
                          <Text style={[styles.listAmount, { color: theme.text }]}>${inq.renta}</Text>
                          <Text style={[styles.listDate, { color: '#FF9500' }]}>{getDiaPago(inq.fecha_pago)}</Text>
                        </View>
                      </View>
                    </GlassCard>
                  ))}
                </View>
              </>
            )}
          </View>

          {isDesktop && (
            <View style={styles.desktopSide}>
              {proximosVencer.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Contratos</Text>
                  </View>
                  <View style={styles.sectionContent}>
                    {proximosVencer.map(inq => {
                      const diasRestantes = Math.ceil((new Date(inq.fecha_termino).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      const urgente = diasRestantes <= 30;
                      return (
                        <GlassCard key={inq.id} style={styles.listItem} borderRadius={Theme.borderRadius.lg}>
                          <View style={styles.listMain}>
                            <View style={styles.listInfo}>
                              <Text style={[styles.listName, { color: theme.text }]}>{inq.nombre_completo}</Text>
                              <Text style={[styles.listSub, { color: theme.textSecondary }]}>Vence en {diasRestantes} días</Text>
                            </View>
                            <View style={[styles.tag, { backgroundColor: (urgente ? theme.danger : '#FF9500') + '20' }]}>
                              <Text style={[styles.tagText, { color: urgente ? theme.danger : '#FF9500' }]}>
                                {urgente ? 'Urgente' : 'Próximo'}
                              </Text>
                            </View>
                          </View>
                        </GlassCard>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        {!isDesktop && proximosVencer.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: 32 }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Contratos por Vencer</Text>
            </View>
            <View style={styles.sectionContent}>
              {proximosVencer.map(inq => {
                const diasRestantes = Math.ceil((new Date(inq.fecha_termino).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const urgente = diasRestantes <= 30;
                return (
                  <GlassCard key={inq.id} style={styles.listItem} borderRadius={Theme.borderRadius.lg}>
                    <View style={styles.listMain}>
                      <View style={[styles.avatar, { backgroundColor: (urgente ? theme.danger : '#FF9500') + '20' }]}>
                        <Text style={[styles.avatarText, { color: urgente ? theme.danger : '#FF9500' }]}>
                          {getInitials(inq.nombre_completo)}
                        </Text>
                      </View>
                      <View style={styles.listInfo}>
                        <Text style={[styles.listName, { color: theme.text }]}>{inq.nombre_completo}</Text>
                        <Text style={[styles.listSub, { color: theme.textSecondary }]}>Depto {inq.depto_numero}</Text>
                      </View>
                      <View style={styles.listRight}>
                        <View style={[styles.tag, { backgroundColor: (urgente ? theme.danger : '#FF9500') + '20' }]}>
                          <Text style={[styles.tagText, { color: urgente ? theme.danger : '#FF9500' }]}>
                            {diasRestantes}d
                          </Text>
                        </View>
                      </View>
                    </View>
                  </GlassCard>
                );
              })}
            </View>
          </>
        )}

        {proximosPagos.length === 0 && proximosVencer.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="leaf-outline" size={64} color={theme.textSecondary + '40'} />
            <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>Todo en orden por ahora</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary + '80' }]}>
              No hay pagos pendientes ni contratos por vencer en los próximos días.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  header: { marginBottom: 24, paddingHorizontal: 24 },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
    opacity: 0.7,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 32,
    justifyContent: 'space-between',
  },
  metricsContainer: {
    flexDirection: 'row', paddingHorizontal: 16, marginBottom: 40, gap: 12, flexWrap: 'wrap',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 0,
  },
  metricCard: { flex: 1, minWidth: 140, padding: 20 },
  metricCardDesktop: {
    minWidth: 220,
    padding: 32,
    gap: 12,
  },
  desktopGrid: {
    flexDirection: 'row',
    gap: 40,
  },
  desktopMain: {
    flex: 2,
  },
  desktopSide: {
    flex: 1.2,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  metricValue: { fontSize: 24, fontWeight: '800' },
  metricLabel: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  metricSub: { fontSize: 12, opacity: 0.6, marginTop: 4 },
  progressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    opacity: 0.9,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 250,
    lineHeight: 20,
  },
  sectionContent: { paddingHorizontal: 16, gap: 12 },
  listItem: { padding: 0 },
  listMain: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  avatar: {
    width: 40, height: 40, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { fontWeight: '700', fontSize: 14 },
  listInfo: { flex: 1 },
  listName: { fontWeight: '600', fontSize: 15, marginBottom: 2 },
  listSub: { fontSize: 13, opacity: 0.7 },
  listRight: { alignItems: 'flex-end', gap: 2 },
  listAmount: { fontWeight: '700', fontSize: 15 },
  listDate: { fontSize: 12, fontWeight: '500' },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12, fontWeight: '700' },
});
