import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '../../../components/ui/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import api from '../../../services/api';

export default function ReportesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  const anioActual = new Date().getFullYear();
  const [year, setYear] = useState(anioActual);
  const [reporte, setReporte] = useState<{ renta_total: number; extra_total: number; deposito_total: number; total_general: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback((y: number) => {
    setLoading(true);
    api.getReporteAnual(y)
      .then(r => setReporte(r.data || null))
      .catch(() => setReporte(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(year); }, [year, cargar]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n || 0));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, isDesktop && styles.headerDesktop, !isDesktop && { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Corte anual</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Ingresos por renta, cuotas extra y depósitos</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop, { paddingBottom: isDesktop ? 32 : insets.bottom + Theme.layout.dockHeight }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Selector de año */}
        <View style={styles.yearRow}>
          <TouchableOpacity style={[styles.yearBtn, { borderColor: theme.border }]} onPress={() => setYear(y => y - 1)}>
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.yearLabel, { color: theme.text }]}>{year}</Text>
          <TouchableOpacity
            style={[styles.yearBtn, { borderColor: theme.border, opacity: year >= anioActual ? 0.4 : 1 }]}
            onPress={() => year < anioActual && setYear(y => y + 1)}
            disabled={year >= anioActual}
          >
            <Ionicons name="chevron-forward" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <>
            <View style={[styles.statsGrid, isDesktop && styles.statsGridDesktop]}>
              <GlassCard style={styles.statCard} padding={Theme.spacing.xl}>
                <View style={[styles.statIcon, { backgroundColor: theme.successLight }]}>
                  <Ionicons name="home" size={20} color={theme.success} />
                </View>
                <Text style={[styles.statValue, { color: theme.text }]}>{fmt(reporte?.renta_total || 0)}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Renta cobrada</Text>
              </GlassCard>

              <GlassCard style={styles.statCard} padding={Theme.spacing.xl}>
                <View style={[styles.statIcon, { backgroundColor: theme.warningLight }]}>
                  <Ionicons name="receipt" size={20} color={theme.warning} />
                </View>
                <Text style={[styles.statValue, { color: theme.text }]}>{fmt(reporte?.extra_total || 0)}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Cuotas extra</Text>
              </GlassCard>

              <GlassCard style={styles.statCard} padding={Theme.spacing.xl}>
                <View style={[styles.statIcon, { backgroundColor: theme.primaryLight }]}>
                  <Ionicons name="lock-closed" size={20} color={theme.primary} />
                </View>
                <Text style={[styles.statValue, { color: theme.text }]}>{fmt(reporte?.deposito_total || 0)}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Depósitos</Text>
              </GlassCard>
            </View>

            <GlassCard style={styles.totalCard} padding={Theme.spacing.xl}>
              <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>TOTAL GANADO EN {year}</Text>
              <Text style={[styles.totalValue, { color: theme.success }]}>{fmt(reporte?.total_general || 0)}</Text>
            </GlassCard>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { paddingVertical: 60, alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16, gap: 12,
  },
  headerDesktop: { paddingTop: 24, paddingHorizontal: 40, maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%' },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, marginTop: 2 },

  scrollContent: { paddingHorizontal: 20, gap: 20 },
  scrollContentDesktop: { paddingHorizontal: 40, maxWidth: 700, alignSelf: 'center', width: '100%' },

  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  yearBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  yearLabel: { fontSize: 24, fontWeight: '800', minWidth: 80, textAlign: 'center' },

  statsGrid: { gap: 12 },
  statsGridDesktop: { flexDirection: 'row' },
  statCard: { flex: 1 },
  statIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  statLabel: { fontSize: 13 },

  totalCard: { alignItems: 'center', gap: 6 },
  totalLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  totalValue: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
});
