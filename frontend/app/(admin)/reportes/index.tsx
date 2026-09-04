import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator, useWindowDimensions, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { SurfaceCard } from '../../../components/ui/SurfaceCard';
import { ProgressRing } from '../../../components/ui/ProgressRing';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import api from '../../../services/api';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function ReportesScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  const anioActual = new Date().getFullYear();
  const [year, setYear] = useState(anioActual);
  const [reporte, setReporte] = useState<{ renta_total: number; extra_total: number; deposito_total: number; total_general: number } | null>(null);
  const [meses, setMeses] = useState<{ mes: number; renta: number; extra: number }[]>([]);
  const [ocup, setOcup] = useState<{ ocupados: number; total: number }>({ ocupados: 0, total: 0 });
  const [deuda, setDeuda] = useState(0);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback((y: number) => {
    setLoading(true);
    Promise.all([
      api.getReporteAnual(y),
      api.getReporteMensual(y).catch(() => ({ data: { meses: [] as any[] } })),
      api.getDepartamentosStats().catch(() => ({ data: {} as any })),
      api.getResumenDeuda().catch(() => ({ data: { total_general: 0 } })),
    ])
      .then(([anual, mensual, stats, res]) => {
        setReporte(anual.data || null);
        setMeses(mensual.data?.meses || []);
        setOcup({ ocupados: Number(stats.data?.ocupados || 0), total: Number(stats.data?.total || 0) });
        setDeuda(Number(res.data?.total_general || 0));
      })
      .catch(() => setReporte(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(year); }, [year, cargar]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n || 0));
  const fmtK = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));

  const pctOcup = ocup.total > 0 ? Math.round((ocup.ocupados / ocup.total) * 100) : 0;
  const totalGeneral = reporte?.total_general || 0;
  const rentaPct = totalGeneral > 0 ? Math.round(((reporte?.renta_total || 0) / totalGeneral) * 100) : 0;
  const extraPct = totalGeneral > 0 ? Math.round(((reporte?.extra_total || 0) / totalGeneral) * 100) : 0;
  const depoPct = Math.max(0, 100 - rentaPct - extraPct);

  const maxMes = Math.max(1, ...meses.map(m => m.renta + m.extra));

  /* ---------------- KPI ---------------- */
  const kpis = (
    <View style={[styles.kpiRow, isDesktop && styles.kpiRowDesktop]}>
      <SurfaceCard style={styles.kpi} padding={Theme.spacing.md}>
        <View style={styles.kpiHead}>
          <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>RENTA COBRADA</Text>
          <Ionicons name="home-outline" size={15} color={theme.success} />
        </View>
        <Text style={[styles.kpiValue, { color: theme.text }]}>{fmt(reporte?.renta_total || 0)}</Text>
        <Text style={[styles.kpiMini, { color: theme.textSecondary }]}>{rentaPct}% del total</Text>
      </SurfaceCard>
      <SurfaceCard style={styles.kpi} padding={Theme.spacing.md}>
        <View style={styles.kpiHead}>
          <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>CUOTAS EXTRA</Text>
          <Ionicons name="receipt-outline" size={15} color={theme.warning} />
        </View>
        <Text style={[styles.kpiValue, { color: theme.text }]}>{fmt(reporte?.extra_total || 0)}</Text>
        <Text style={[styles.kpiMini, { color: theme.textSecondary }]}>mantenimiento y servicios</Text>
      </SurfaceCard>
      <SurfaceCard style={styles.kpi} padding={Theme.spacing.md}>
        <View style={styles.kpiHead}>
          <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>DEPÓSITOS EN GARANTÍA</Text>
          <Ionicons name="lock-closed-outline" size={15} color={theme.primary} />
        </View>
        <Text style={[styles.kpiValue, { color: theme.text }]}>{fmt(reporte?.deposito_total || 0)}</Text>
        <Text style={[styles.kpiMini, { color: theme.textSecondary }]}>en custodia</Text>
      </SurfaceCard>
      <SurfaceCard style={[styles.kpi, { borderColor: theme.primary + '55' }]} padding={Theme.spacing.md}>
        <View style={styles.kpiHead}>
          <Text style={[styles.kpiLabel, { color: theme.primary }]}>TOTAL RECAUDADO {year}</Text>
          <Ionicons name="wallet-outline" size={15} color={theme.primary} />
        </View>
        <Text style={[styles.kpiValue, { color: theme.text, fontSize: 22 }]}>{fmt(totalGeneral)}</Text>
        <View style={[styles.kpiBar, { backgroundColor: theme.primary }]} />
      </SurfaceCard>
    </View>
  );

  /* ---------------- Bar chart ---------------- */
  const chart = (
    <SurfaceCard style={isDesktop ? styles.chartCard : {}} padding={Theme.spacing.lg}>
      <View style={styles.chartHead}>
        <Text style={[styles.panelTitle, { color: theme.textSecondary }]}>FLUJO MENSUAL DE RECAUDACIÓN</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: theme.success }]} /><Text style={[styles.legendText, { color: theme.textSecondary }]}>Renta</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: theme.primary }]} /><Text style={[styles.legendText, { color: theme.textSecondary }]}>Extras</Text></View>
        </View>
      </View>

      <View style={styles.chartBody}>
        {/* Y labels */}
        <View style={styles.yAxis}>
          {[1, 0.66, 0.33, 0].map((f, i) => (
            <Text key={i} style={[styles.yLabel, { color: theme.textMuted }]}>{fmtK(maxMes * f)}</Text>
          ))}
        </View>
        {/* Plot + eje X */}
        <View style={{ flex: 1 }}>
          <View style={styles.plot}>
            {[0, 0.33, 0.66, 1].map((f, i) => (
              <View key={i} style={[styles.grid, { bottom: `${f * 100}%`, borderColor: theme.border }]} />
            ))}
            <View style={styles.bars}>
              {(meses.length ? meses : MESES.map((_, i) => ({ mes: i + 1, renta: 0, extra: 0 }))).map((m, i) => {
                const rentaH = (m.renta / maxMes) * 100;
                const extraH = (m.extra / maxMes) * 100;
                return (
                  <View key={i} style={styles.barStack}>
                    {extraH > 0 && <View style={[styles.barSeg, { height: `${extraH}%`, backgroundColor: theme.primary, borderTopLeftRadius: 3, borderTopRightRadius: 3 }]} />}
                    <View style={[styles.barSeg, { height: `${Math.max(rentaH, m.renta > 0 ? 2 : 0)}%`, backgroundColor: theme.success, borderTopLeftRadius: extraH > 0 ? 0 : 3, borderTopRightRadius: extraH > 0 ? 0 : 3 }]} />
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.xAxis}>
            {MESES.map((mn, i) => (
              <Text key={i} style={[styles.xLabel, { color: theme.textMuted }]}>{mn[0]}</Text>
            ))}
          </View>
        </View>
      </View>
    </SurfaceCard>
  );

  /* ---------------- Right panel ---------------- */
  const sidePanel = (
    <View style={isDesktop ? styles.side : { gap: 12 }}>
      <SurfaceCard style={styles.gaugeCard} padding={Theme.spacing.lg}>
        <Text style={[styles.panelTitle, { color: theme.textSecondary, alignSelf: 'flex-start' }]}>SALUD DE CARTERA</Text>
        <ProgressRing
          size={128}
          strokeWidth={12}
          progress={pctOcup}
          color={theme.success}
          trackColor={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'}
          fillColor={theme.card}
        >
          <Text style={[styles.gaugeValue, { color: theme.text }]}>{pctOcup}%</Text>
          <Text style={[styles.gaugeSub, { color: theme.textMuted }]}>Ocupación</Text>
        </ProgressRing>
      </SurfaceCard>

      <SurfaceCard padding={Theme.spacing.lg}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
          <Text style={[styles.panelTitle, { color: theme.textSecondary }]}>COBRANZA PENDIENTE</Text>
          <Text style={[styles.moraValue, { color: deuda > 0 ? theme.danger : theme.success }]}>{fmt(deuda)}</Text>
        </View>
        <Text style={[styles.kpiMini, { color: theme.textSecondary }]}>
          {deuda > 0 ? 'Saldo acumulado por cobrar' : 'Sin adeudos pendientes'}
        </Text>
      </SurfaceCard>

      <SurfaceCard padding={0} style={{ overflow: 'hidden' }}>
        <View style={[styles.compHead, { borderBottomColor: theme.border }]}>
          <Text style={[styles.panelTitle, { color: theme.textSecondary }]}>COMPOSICIÓN DE INGRESOS</Text>
        </View>
        {[
          { label: 'Renta base', pct: rentaPct, color: theme.success, val: reporte?.renta_total || 0 },
          { label: 'Cuotas extra', pct: extraPct, color: theme.primary, val: reporte?.extra_total || 0 },
          { label: 'Depósitos', pct: depoPct, color: theme.warning, val: reporte?.deposito_total || 0 },
        ].map((r, i, arr) => (
          <View key={r.label} style={[styles.compRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={[styles.legendDot, { backgroundColor: r.color }]} />
              <Text style={[styles.compLabel, { color: theme.text }]}>{r.label}</Text>
            </View>
            <Text style={[styles.compVal, { color: theme.textSecondary }]}>{fmt(r.val)}</Text>
            <Text style={[styles.compPct, { color: theme.text }]}>{r.pct}%</Text>
          </View>
        ))}
      </SurfaceCard>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={isDark ? ['#0E1321', '#1A1F2E'] : ['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFill} />

      <ScrollView
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop, { paddingBottom: isDesktop ? 40 : insets.bottom + Theme.layout.dockHeight }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, !isDesktop && { paddingTop: insets.top + 20 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Corte Anual & Analítica</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Resumen de operaciones y flujo de efectivo</Text>
          </View>
          <View style={[styles.yearBox, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <TouchableOpacity onPress={() => setYear(y => y - 1)} hitSlop={8}>
              <Ionicons name="chevron-back" size={16} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.yearLabel, { color: theme.text }]}>{year}</Text>
            <TouchableOpacity onPress={() => year < anioActual && setYear(y => y + 1)} disabled={year >= anioActual} hitSlop={8}>
              <Ionicons name="chevron-forward" size={16} color={year >= anioActual ? theme.textMuted : theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
        ) : (
          <>
            {kpis}
            {isDesktop ? (
              <View style={styles.mainGrid}>
                <View style={{ flex: 2, minWidth: 0 }}>{chart}</View>
                <View style={{ flex: 1, minWidth: 0 }}>{sidePanel}</View>
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                {chart}
                {sidePanel}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { paddingVertical: 60, alignItems: 'center' },
  content: { paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.md, gap: Theme.spacing.lg },
  contentDesktop: { maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: 40, paddingTop: 24 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  yearBox: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 36, paddingHorizontal: 12, borderRadius: Theme.borderRadius.sm, borderWidth: 1 },
  yearLabel: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },

  kpiRow: { gap: 12, flexDirection: 'row', flexWrap: 'wrap' },
  kpiRowDesktop: { flexWrap: 'nowrap' },
  kpi: { flex: 1, minWidth: 150, minHeight: 108, justifyContent: 'space-between' },
  kpiHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  kpiLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, flex: 1 },
  kpiValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.6 },
  kpiMini: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  kpiBar: { height: 3, borderRadius: 2, marginTop: 8 },

  mainGrid: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  chartCard: { flex: 1 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 },
  panelTitle: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },

  chartBody: { flexDirection: 'row', gap: 8 },
  yAxis: { justifyContent: 'space-between', height: 220, width: 34 },
  yLabel: { fontSize: 9.5, fontWeight: '600', fontVariant: ['tabular-nums'], textAlign: 'right' },
  plot: { height: 220, position: 'relative' },
  grid: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth },
  bars: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' },
  barStack: { flex: 1, height: '100%', marginHorizontal: 3, maxWidth: 26, flexDirection: 'column', justifyContent: 'flex-end' },
  barSeg: { width: '100%', minHeight: 1 },
  xAxis: { height: 20, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  xLabel: { fontSize: 9, fontWeight: '700', flex: 1, textAlign: 'center' },

  side: { flex: 1, gap: 12 },
  gaugeCard: { alignItems: 'center', gap: 16, minHeight: 200, justifyContent: 'center' },
  gaugeValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  gaugeSub: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  moraValue: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },

  compHead: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1 },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  compLabel: { fontSize: 12.5, fontWeight: '600' },
  compVal: { fontSize: 11.5, fontVariant: ['tabular-nums'] },
  compPct: { fontSize: 12.5, fontWeight: '700', minWidth: 36, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
