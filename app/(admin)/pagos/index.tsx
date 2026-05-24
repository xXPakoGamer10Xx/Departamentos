import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator, useWindowDimensions, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api.getInquilinos({ estado: 'activo' })
        .then(r => setInquilinos(r.data || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

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
        colors={isDark ? ['#1a1a1a', '#000000'] : ['#F2F2F7', '#E5E5EA']}
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
          contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop, { paddingBottom: isDesktop ? 32 : insets.bottom + 90 }]}
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
                style={[styles.card, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}
                onPress={() => router.push(`/(admin)/pagos/${item.id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.cardIcon, { backgroundColor: item.metodo_pago === 'transferencia' ? '#34C75920' : '#007AFF20' }]}>
                  <Ionicons
                    name={item.metodo_pago === 'transferencia' ? 'card' : 'cash'}
                    size={22}
                    color={item.metodo_pago === 'transferencia' ? '#34C759' : '#007AFF'}
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
                <View style={[
                  styles.metodoBadge,
                  { backgroundColor: item.metodo_pago === 'transferencia' ? '#34C75920' : '#007AFF20' }
                ]}>
                  <Text style={[
                    styles.metodoText,
                    { color: item.metodo_pago === 'transferencia' ? '#34C759' : '#007AFF' }
                  ]}>
                    {item.metodo_pago === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                  </Text>
                </View>
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
  metodoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  metodoText: { fontSize: 12, fontWeight: '700' },
});
