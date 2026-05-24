import { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, TextInput, FlatList, TouchableOpacity,
  useColorScheme, Platform, useWindowDimensions, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { GlassCard } from '../../../components/ui/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../services/api';

interface Inquilino {
  id: number | string;
  nombre_completo: string;
  depto_numero: string | number;
  renta: number | string;
  estado: 'activo' | 'inactivo' | string;
  [key: string]: any;
}

export default function InquilinosListScreen() {
  const [search, setSearch] = useState('');
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmItem, setConfirmItem] = useState<Inquilino | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [deleteError, setDeleteError] = useState('');
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
      const res = await api.getInquilinos();
      setInquilinos(res.data || []);
    } catch (e: any) {
      // silently fail on load
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { cargar(); }, []));

  const confirmarEliminar = async () => {
    if (!confirmItem) return;
    setDeleteError('');
    setEliminando(true);
    try {
      await api.deleteInquilino(String(confirmItem.id));
      setConfirmItem(null);
      cargar();
    } catch (e: any) {
      setDeleteError(e.message || 'No se pudo eliminar el inquilino');
    } finally {
      setEliminando(false);
    }
  };

  const filtered = inquilinos.filter(i =>
    i.nombre_completo?.toLowerCase().includes(search.toLowerCase()) ||
    String(i.depto_numero).includes(search)
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient colors={isDark ? ['#1a1a1a', '#000000'] : ['#F2F2F7', '#E5E5EA']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#1a1a1a', '#000000'] : ['#F2F2F7', '#E5E5EA']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, isDesktop && styles.headerDesktop, !isDesktop && { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Inquilinos</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {inquilinos.filter(i => i.estado === 'activo').length} activos actualmente
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: '#007AFF' }]}
            onPress={() => router.push('/(admin)/inquilinos/nuevo')}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {!isDesktop && (
          <View style={styles.searchWrapper}>
            <GlassCard intensity={15} borderRadius={12} style={styles.searchCard} border={true} padding={0}>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color={theme.textSecondary} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Buscar contrato o departamento..."
                  placeholderTextColor={theme.textSecondary + '90'}
                  value={search}
                  onChangeText={setSearch}
                  selectionColor={theme.primary}
                />
              </View>
            </GlassCard>
          </View>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={[styles.listContainer, isDesktop && styles.listContainerDesktop, { paddingBottom: isDesktop ? 32 : insets.bottom + 90 }]}
        columnWrapperStyle={isDesktop ? styles.columnWrapper : undefined}
        showsVerticalScrollIndicator={false}
        numColumns={isDesktop ? 2 : 1}
        key={isDesktop ? 'desktop' : 'mobile'}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hay inquilinos registrados</Text>
          </View>
        }
        renderItem={({ item }) => (
          <GlassCard
            style={[styles.card, isDesktop && styles.cardDesktop]}
            borderRadius={Theme.borderRadius.lg}
            padding={0}
          >
            <View style={styles.cardRow}>
              <TouchableOpacity
                style={[styles.cardContent, isDesktop && styles.cardContentDesktop]}
                onPress={() => router.push(`/(admin)/inquilinos/${item.id}` as any)}
              >
                <View style={[styles.avatar, isDesktop && styles.avatarDesktop, { backgroundColor: theme.primary + '20' }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>
                    {item.nombre_completo?.substring(0, 2).toUpperCase() || '??'}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{item.nombre_completo}</Text>
                  <View style={styles.deptoRow}>
                    <Ionicons name="business-outline" size={14} color={theme.textSecondary} />
                    <Text style={[styles.cardDepto, { color: theme.textSecondary }]}>
                      Departamento {item.depto_numero}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <Text style={[styles.cardRenta, { color: theme.text }]}>${Number(item.renta).toLocaleString()}</Text>
                  <View style={[
                    styles.badge,
                    { backgroundColor: item.estado === 'activo' ? theme.success + '15' : theme.danger + '15' }
                  ]}>
                    <Text style={[styles.badgeText, { color: item.estado === 'activo' ? theme.success : theme.danger }]}>
                      {item.estado?.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <View style={[styles.actions, { borderLeftColor: theme.border }]}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => router.push({ pathname: '/(admin)/inquilinos/nuevo', params: { editId: item.id } } as any)}
                >
                  <Ionicons name="pencil-outline" size={18} color={theme.primary} />
                </TouchableOpacity>
                <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => { setDeleteError(''); setConfirmItem(item); }}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </GlassCard>
        )}
      />

      {/* Modal de confirmación para eliminar */}
      <Modal visible={!!confirmItem} transparent animationType="fade" onRequestClose={() => setConfirmItem(null)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.confirmBox} borderRadius={Theme.borderRadius.xl}>
            <View style={[styles.confirmIcon, { backgroundColor: theme.danger + '15' }]}>
              <Ionicons name="trash" size={28} color={theme.danger} />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>Eliminar Inquilino</Text>
            <Text style={[styles.confirmMsg, { color: theme.textSecondary }]}>
              ¿Seguro que deseas eliminar a{'\n'}
              <Text style={{ color: theme.text, fontWeight: '700' }}>{confirmItem?.nombre_completo}</Text>?{'\n'}
              El Departamento {confirmItem?.depto_numero} quedará disponible.
            </Text>

            {deleteError ? (
              <View style={[styles.errorBox, { backgroundColor: theme.danger + '15', borderColor: theme.danger + '40' }]}>
                <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>{deleteError}</Text>
              </View>
            ) : null}

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, { borderWidth: 1, borderColor: theme.border }]}
                onPress={() => { setConfirmItem(null); setDeleteError(''); }}
                disabled={eliminando}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: theme.danger, opacity: eliminando ? 0.7 : 1 }]}
                onPress={confirmarEliminar}
                disabled={eliminando}
              >
                {eliminando
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '700' }}>Sí, eliminar</Text>
                }
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>
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
  },
  headerDesktop: {
    paddingTop: 40, paddingHorizontal: 40,
    maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%',
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: {
    fontSize: Theme.typography.display.fontSize,
    fontWeight: Theme.typography.display.fontWeight,
    letterSpacing: Theme.typography.display.letterSpacing,
  },
  searchWrapper: { gap: 8 },
  searchCard: { 
    height: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.1)',
  },
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 14,
    height: '100%',
    width: '100%',
  },
  searchIcon: { marginRight: 12 },
  searchInput: { 
    flex: 1, 
    fontSize: 15, 
    fontWeight: '500',
    height: '100%',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
    marginTop: 2,
  },
  addButton: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.dark.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  listContainer: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  listContainerDesktop: {
    maxWidth: Theme.layout.maxWidth, alignSelf: 'center',
    width: '100%', paddingHorizontal: 40, gap: 24,
  },
  columnWrapper: { gap: 24 },
  card: { flex: 1 },
  cardDesktop: {},
  cardRow: { flexDirection: 'row', alignItems: 'stretch' },
  cardContent: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 18 },
  cardContentDesktop: { padding: 24 },
  avatar: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarDesktop: { width: 60, height: 60, borderRadius: 18 },
  avatarText: { fontWeight: '700', fontSize: 15 },
  cardInfo: { flex: 1, gap: 4 },
  cardName: { fontSize: 17, fontWeight: '700' },
  deptoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardDepto: { fontSize: 14, fontWeight: '500', opacity: 0.8 },
  cardRight: { alignItems: 'flex-end', gap: 8, marginRight: 12 },
  cardRenta: { fontSize: 18, fontWeight: '800' },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  actions: { flexDirection: 'column', borderLeftWidth: 1, width: 52 },
  actionBtn: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  actionDivider: { height: 1 },
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16 },
  // Modal de confirmación
  modalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)', padding: 24,
  },
  confirmBox: { width: '100%', maxWidth: 400, padding: 28, alignItems: 'center', gap: 16 },
  confirmIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  confirmTitle: { fontSize: 20, fontWeight: '700' },
  confirmMsg: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 4 },
  confirmBtn: { flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, width: '100%' },
  errorText: { flex: 1, fontSize: 13 },
});
