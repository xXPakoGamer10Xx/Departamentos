import { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  useColorScheme, Platform, useWindowDimensions, ActivityIndicator, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { GlassCard } from '../../../components/ui/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../services/api';

export default function ContratosScreen() {
  const [search, setSearch] = useState('');
  const [inquilinos, setInquilinos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  const cargar = async () => {
    try {
      setLoading(true);
      const res = await api.getInquilinos({ estado: 'activo' });
      setInquilinos(res.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
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
      } finally {
        setOpeningId(null);
      }
      return;
    }
    router.push(`/(admin)/contratos/generar/${item.id}` as any);
  };

  const editarContrato = (item: any) => {
    router.push(`/(admin)/contratos/generar/${item.id}` as any);
  };

  const filtered = inquilinos.filter(i =>
    i.nombre_completo?.toLowerCase().includes(search.toLowerCase()) ||
    String(i.depto_numero).includes(search)
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, isDesktop && styles.headerDesktop, !isDesktop && { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Contratos</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {filtered.length} inquilino{filtered.length !== 1 ? 's' : ''} activo{filtered.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <GlassCard intensity={30} borderRadius={26} padding={0} border={true}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={theme.icon} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Buscar por nombre o departamento..."
              placeholderTextColor={theme.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </GlassCard>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={[styles.listContainer, isDesktop && styles.listContainerDesktop, { paddingBottom: isDesktop ? 32 : insets.bottom + Theme.layout.dockHeight }]}
        columnWrapperStyle={isDesktop ? styles.columnWrapper : null}
        numColumns={isDesktop ? 2 : 1}
        key={isDesktop ? 'desktop' : 'mobile'}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hay inquilinos activos</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isOpening = openingId === String(item.id);
          const fmtFecha = (str: string) =>
            str ? new Date(str).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

          return (
            <GlassCard
              style={[styles.card, isDesktop && styles.cardDesktop]}
              borderRadius={Theme.borderRadius.lg}
              padding={0}
            >
              <View style={styles.cardInner}>
                <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>
                    {item.nombre_completo?.substring(0, 2).toUpperCase() || '??'}
                  </Text>
                </View>

                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
                    {item.nombre_completo}
                  </Text>
                  <View style={styles.row}>
                    <Ionicons name="business-outline" size={13} color={theme.textSecondary} />
                    <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                      Depto {item.depto_numero}
                    </Text>
                    <Text style={[styles.dot, { color: theme.border }]}>•</Text>
                    <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                      ${Number(item.renta).toLocaleString()}/mes
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} />
                    <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                      {fmtFecha(item.fecha_inicio)} — {fmtFecha(item.fecha_termino)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.editBtn, { borderColor: '#7C3AED40', backgroundColor: '#7C3AED12' }]}
                    onPress={() => editarContrato(item)}
                  >
                    <Ionicons
                      name={item.contrato_html ? 'create' : 'create-outline'}
                      size={18}
                      color="#7C3AED"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.generateBtn, { backgroundColor: theme.primary, opacity: isOpening ? 0.7 : 1 }]}
                    onPress={() => abrirContrato(item)}
                    disabled={isOpening}
                  >
                    {isOpening ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="document-text-outline" size={18} color="#fff" />
                        <Text style={styles.generateBtnText}>
                          {Platform.OS === 'web' ? 'Imprimir' : 'Ver PDF'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 20,
    gap: 16,
  },
  headerDesktop: {
    paddingTop: 40, paddingHorizontal: 40,
    maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%',
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: { fontSize: 13, marginTop: 2, opacity: 0.8 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 14 },
  searchIcon: { marginRight: 10 },
  searchInput: { 
    flex: 1, 
    fontSize: 16, 
    fontWeight: '500',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any
    })
  },
  listContainer: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  listContainerDesktop: {
    maxWidth: Theme.layout.maxWidth, alignSelf: 'center',
    width: '100%', paddingHorizontal: 40, gap: 20,
  },
  columnWrapper: { gap: 20 },
  card: { flex: 1 },
  cardDesktop: {},
  cardInner: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 16 },
  avatar: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { fontWeight: '700', fontSize: 15 },
  cardInfo: { flex: 1, gap: 6 },
  cardName: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMeta: { fontSize: 13, fontWeight: '500', opacity: 0.85, lineHeight: 18 },
  dot: { fontSize: 12 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  editBtn: {
    width: 42, height: 42, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, flexShrink: 0,
  },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16 },
});
