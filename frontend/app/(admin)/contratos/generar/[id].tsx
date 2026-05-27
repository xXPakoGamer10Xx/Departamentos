import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator, Platform, useWindowDimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../../constants/Colors';
import { Theme } from '../../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import api from '../../../../services/api';

export default function ContractPreviewScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  const [inquilino, setInquilino] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    api.getInquilinoById(id as string)
      .then(r => setInquilino(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleAbrirPdf = async () => {
    setOpening(true);
    try {
      const url = api.getContratoPdfUrl(id as string);
      const token = api.getToken();

      if (Platform.OS === 'web') {
        window.open(`${url}?token=${encodeURIComponent(token || '')}`, '_blank');
        return;
      }

      // Android: descargar PDF y abrir diálogo de impresión nativo
      const localUri = FileSystem.cacheDirectory + `contrato_${id}.pdf`;
      const downloadResult = await FileSystem.downloadAsync(
        `${url}?token=${encodeURIComponent(token || '')}`,
        localUri
      );

      if (downloadResult.status !== 200) {
        Alert.alert('Error', 'No se pudo descargar el contrato PDF');
        return;
      }

      await Print.printAsync({ uri: localUri });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo imprimir el contrato');
    } finally {
      setOpening(false);
    }
  };

  const fmtFecha = (str: string) =>
    str
      ? new Date(str).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()
      : 'N/A';

  const fmtRenta = (n: number) =>
    n ? `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—';

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={isDark ? ['#1a1a1a', '#000000'] : ['#F2F2F7', '#E5E5EA']}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!inquilino) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={isDark ? ['#1a1a1a', '#000000'] : ['#F2F2F7', '#E5E5EA']}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="alert-circle-outline" size={48} color={theme.danger} />
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>Inquilino no encontrado</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#1a1a1a', '#000000'] : ['#F2F2F7', '#E5E5EA']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, isDesktop && styles.headerDesktop, !isDesktop && { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Vista Previa</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {inquilino.nombre_completo} · Depto {inquilino.depto_numero}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.printBtn, { backgroundColor: theme.primary, opacity: opening ? 0.7 : 1 }]}
          onPress={handleAbrirPdf}
          disabled={opening}
        >
          {opening
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="print-outline" size={20} color="#fff" />
          }
          <Text style={styles.printBtnText}>
            {opening ? 'Abriendo…' : 'Imprimir PDF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Document area */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: isDesktop ? 48 : insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* The document always looks like white paper regardless of theme */}
        <View style={[styles.page, isDesktop && styles.pageDesktop]}>

          {/* Page header */}
          <View style={styles.pageHeader}>
            <View style={styles.pageHeaderLeft}>
              <View style={styles.pageLogoBox}>
                <Ionicons name="home" size={20} color="#fff" />
              </View>
              <View>
                <Text style={styles.pageLogoLabel}>NETHRENT</Text>
                <Text style={styles.pageLogoSub}>Arrendamiento</Text>
              </View>
            </View>
            <View style={styles.pageHeaderRight}>
              <Text style={styles.pageDocLabel}>CONTRATO DE</Text>
              <Text style={styles.pageDocLabel}>ARRENDAMIENTO</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Main fields */}
          <View style={styles.fieldGrid}>
            <DataRow label="Arrendatario" value={inquilino.nombre_completo} highlight />
            <DataRow label="Departamento No." value={String(inquilino.depto_numero)} />
            <DataRow label="Renta mensual" value={`${fmtRenta(inquilino.renta)}${inquilino.renta_letra ? `  (${inquilino.renta_letra})` : ''}`} highlight />
            <DataRow label="Día de pago" value={`${inquilino.fecha_pago} de cada mes`} />
            <DataRow label="Vigencia" value={`${fmtFecha(inquilino.fecha_inicio)}  —  ${fmtFecha(inquilino.fecha_termino)}`} />
            {inquilino.fiador_nombre ? (
              <DataRow label="Fiador" value={inquilino.fiador_nombre} />
            ) : null}
            {inquilino.fiador_telefono ? (
              <DataRow label="Tel. fiador" value={inquilino.fiador_telefono} />
            ) : null}
          </View>

          <View style={styles.divider} />

          {/* Print hint */}
          <View style={styles.printHint}>
            <Ionicons name="information-circle-outline" size={16} color="#94a3b8" />
            <Text style={styles.printHintText}>
              Presiona <Text style={{ fontWeight: '700' }}>Imprimir PDF</Text> para obtener el contrato completo con todas las cláusulas.
              {Platform.OS === 'web' ? ' Luego usa Ctrl+P / Cmd+P para imprimir.' : ''}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={dataStyles.row}>
      <Text style={dataStyles.label}>{label}</Text>
      <Text style={[dataStyles.value, highlight && dataStyles.valueHighlight]}>{value}</Text>
    </View>
  );
}

const dataStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  label: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    width: 160,
    flexShrink: 0,
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  valueHighlight: {
    color: '#0f172a',
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { fontSize: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 70 : 24,
    paddingBottom: 20,
    gap: 12,
  },
  headerDesktop: {
    paddingTop: 24,
    paddingHorizontal: 40,
    maxWidth: Theme.layout.maxWidth,
    alignSelf: 'center',
    width: '100%',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, marginTop: 2, opacity: 0.65 },
  printBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: 14,
  },
  printBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  scrollArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    alignItems: 'center',
  },

  // The document page — always white like real paper
  page: {
    width: '100%',
    maxWidth: 720,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  pageDesktop: {
    padding: 48,
  },

  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  pageHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pageLogoBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#007AFF',
    justifyContent: 'center', alignItems: 'center',
  },
  pageLogoLabel: { fontSize: 14, fontWeight: '900', color: '#0f172a', letterSpacing: -0.3 },
  pageLogoSub: { fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 1 },
  pageHeaderRight: { alignItems: 'flex-end' },
  pageDocLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 1 },

  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 20 },

  fieldGrid: { gap: 0 },

  printHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  printHintText: {
    flex: 1, fontSize: 12, color: '#64748b', lineHeight: 18,
  },
});
