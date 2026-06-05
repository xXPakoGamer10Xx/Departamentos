import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator, useWindowDimensions, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSSEEvent } from '../../../hooks/useSSE';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../services/api';

export default function PagosScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  const [inquilinos, setInquilinos] = useState<any[]>([]);
  const [estados, setEstados] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [marcandoId, setMarcandoId] = useState<string | null>(null);

  const cargar = useCallback((showLoader = false) => {
    if (showLoader) setLoading(true);
    Promise.all([
      api.getInquilinos({ estado: 'activo' }),
      api.getEstadosPagosActuales().catch(() => ({ data: [] as any[] })),
    ])
      .then(([inqRes, estRes]) => {
        setInquilinos(inqRes.data || []);
        const map: Record<string, any> = {};
        (estRes.data || []).forEach((e: any) => { map[e.inquilino_id] = e; });
        setEstados(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => { cargar(true); }, [cargar])
  );

  // Polling en vivo mientras la pantalla está abierta (mecanismo principal en móvil)
  useEffect(() => {
    const interval = setInterval(() => cargar(), 10000);
    return () => clearInterval(interval);
  }, [cargar]);

  // Refresco inmediato en web cuando un inquilino paga o sube comprobante
  useSSEEvent('payment_confirmed', () => cargar());
  useSSEEvent('comprobante_subido', () => cargar());

  const marcarPagado = useCallback(async (inquilinoId: string) => {
    setMarcandoId(inquilinoId);
    try {
      const res = await api.marcarPagadoAdmin(inquilinoId);
      setEstados(prev => ({
        ...prev,
        [inquilinoId]: { ...prev[inquilinoId], ...res.data, inquilino_id: inquilinoId, confirmado: true },
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setMarcandoId(null);
    }
  }, []);

  const filtered = inquilinos.filter(i =>
    !search ||
    i.nombre_completo?.toLowerCase().includes(search.toLowerCase()) ||
    String(i.depto_numero).includes(search)
  );

  const fmtRenta = (n: number) =>
    `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, isDesktop && styles.headerDesktop, !isDesktop && { paddingTop: insets.top + 20 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Pagos</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {inquilinos.length} inquilino{inquilinos.length !== 1 ? 's' : ''} activo{inquilinos.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop, { paddingBottom: isDesktop ? 32 : insets.bottom + Theme.layout.dockHeight }]}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="card-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No hay inquilinos activos
              </Text>
            </View>
          ) : (
            filtered.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => router.push(`/(admin)/pagos/${item.id}`)}
                activeOpacity={0.75}
              >
                <View style={[styles.cardIcon, { backgroundColor: item.metodo_pago === 'ambos' ? theme.warningLight : item.metodo_pago === 'transferencia' ? theme.successLight : theme.infoLight }]}>
                  <Ionicons
                    name={item.metodo_pago === 'ambos' ? 'swap-horizontal' : item.metodo_pago === 'transferencia' ? 'card' : 'cash'}
                    size={22}
                    color={item.metodo_pago === 'ambos' ? theme.warning : item.metodo_pago === 'transferencia' ? theme.success : theme.info}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
                    {item.nombre_completo}
                  </Text>
                  <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                    Depto {item.depto_numero} · {fmtRenta(item.renta)}/mes
                  </Text>
                </View>
                {estados[item.id]?.confirmado ? (
                  <View style={styles.pagadoBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                    <Text style={styles.pagadoText}>Pagado</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.marcarBtn, { opacity: marcandoId === item.id ? 0.6 : 1 }]}
                    onPress={() => marcarPagado(item.id)}
                    disabled={marcandoId === item.id}
                  >
                    {marcandoId === item.id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="checkmark-circle-outline" size={15} color="#fff" />
                    }
                    <Text style={styles.marcarBtnText}>Pagar</Text>
                  </TouchableOpacity>
                )}
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

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
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 2, opacity: 0.7 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 48, gap: 10 },
  scrollContentDesktop: {
    paddingHorizontal: 40,
    maxWidth: Theme.layout.maxWidth,
    alignSelf: 'center',
    width: '100%',
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  cardSub: { fontSize: 13, marginTop: 2 },
  pagadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#34C75920',
  },
  pagadoText: { fontSize: 12, fontWeight: '700', color: '#34C759' },
  marcarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#34C759',
  },
  marcarBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});
