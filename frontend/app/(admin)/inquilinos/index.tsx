import { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, FlatList, TouchableOpacity,
  useColorScheme, Platform, useWindowDimensions, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { GlassCard } from '../../../components/ui/GlassCard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
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
    } catch {
      // error ya manejado por el API service
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

  const activos = inquilinos.filter(i => i.estado === 'activo').length;
  const paddingBottom = isDesktop ? 40 : insets.bottom + Theme.layout.dockHeight;

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textMuted }]}>Cargando inquilinos...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[
        styles.header,
        isDesktop ? styles.headerDesktop : { paddingTop: insets.top + 20 },
      ]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Inquilinos</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {activos} {activos === 1 ? 'activo' : 'activos'} de {inquilinos.length} total
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
            onPress={() => router.push('/(admin)/inquilinos/nuevo')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <Input
          icon="search-outline"
          placeholder="Buscar por nombre o departamento..."
          value={search}
          onChangeText={setSearch}
          style={{ marginBottom: 0 } as any}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={[
          styles.listContainer,
          isDesktop && styles.listContainerDesktop,
          { paddingBottom },
        ]}
        columnWrapperStyle={isDesktop ? styles.columnWrapper : undefined}
        showsVerticalScrollIndicator={false}
        numColumns={isDesktop ? 2 : 1}
        key={isDesktop ? 'desktop' : 'mobile'}
        ListEmptyComponent={
          <GlassCard style={styles.emptyCard} padding={Theme.spacing.xxxl}>
            <View style={styles.emptyContent}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.surface }]}>
                <Ionicons name="people-outline" size={32} color={theme.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {search ? 'Sin resultados' : 'No hay inquilinos'}
              </Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                {search ? `No se encontró "${search}"` : 'Agrega el primer inquilino con el botón +'}
              </Text>
            </View>
          </GlassCard>
        }
        renderItem={({ item }) => (
          <GlassCard
            style={[styles.card, isDesktop && styles.cardDesktop]}
            borderRadius={Theme.borderRadius.lg}
            padding={0}
          >
            <View style={styles.cardRow}>
              {/* Contenido principal */}
              <TouchableOpacity
                style={[styles.cardContent, isDesktop && styles.cardContentDesktop]}
                onPress={() => router.push(`/(admin)/inquilinos/${item.id}` as any)}
                activeOpacity={0.75}
              >
                <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>
                    {item.nombre_completo?.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || '??'}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
                    {item.nombre_completo}
                  </Text>
                  <View style={styles.deptoRow}>
                    <Ionicons name="business-outline" size={12} color={theme.textMuted} />
                    <Text style={[styles.cardDepto, { color: theme.textSecondary }]}>
                      Depto {item.depto_numero}
                    </Text>
                  </View>
                  <View style={styles.rentaRow}>
                    <Text style={[styles.cardRenta, { color: theme.text }]}>
                      ${Number(item.renta).toLocaleString()}
                    </Text>
                    <Badge
                      label={item.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      variant={item.estado === 'activo' ? 'success' : 'danger'}
                      size="sm"
                    />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Acciones */}
              <View style={[styles.actions, { borderLeftColor: theme.border }]}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => router.push({ pathname: '/(admin)/inquilinos/nuevo', params: { editId: item.id } } as any)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="pencil-outline" size={17} color={theme.primary} />
                </TouchableOpacity>
                <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => { setDeleteError(''); setConfirmItem(item); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={17} color={theme.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </GlassCard>
        )}
      />

      {/* Modal confirmación eliminar */}
      <Modal visible={!!confirmItem} transparent animationType="fade" onRequestClose={() => setConfirmItem(null)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.confirmBox} borderRadius={Theme.borderRadius.xxl} variant="elevated">
            <View style={[styles.confirmIconWrap, { backgroundColor: theme.dangerLight }]}>
              <Ionicons name="trash" size={26} color={theme.danger} />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>Eliminar Inquilino</Text>
            <Text style={[styles.confirmMsg, { color: theme.textSecondary }]}>
              ¿Seguro que deseas eliminar a{'\n'}
              <Text style={{ color: theme.text, fontWeight: '700' }}>{confirmItem?.nombre_completo}</Text>?{'\n'}
              El Departamento {confirmItem?.depto_numero} quedará disponible.
            </Text>

            {deleteError ? (
              <View style={[styles.errorBox, { backgroundColor: theme.dangerLight, borderColor: theme.danger + '50' }]}>
                <Ionicons name="alert-circle-outline" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>{deleteError}</Text>
              </View>
            ) : null}

            <View style={styles.confirmActions}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() => { setConfirmItem(null); setDeleteError(''); }}
                disabled={eliminando}
                style={{ flex: 1 }}
              />
              <Button
                title="Eliminar"
                variant="danger"
                loading={eliminando}
                onPress={confirmarEliminar}
                style={{ flex: 1 }}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '500' },
  header: {
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  headerDesktop: {
    paddingTop: 40,
    paddingHorizontal: 40,
    maxWidth: Theme.layout.maxWidth,
    alignSelf: 'center',
    width: '100%',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  listContainer: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  listContainerDesktop: {
    maxWidth: Theme.layout.maxWidth,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 40,
    gap: 16,
  },
  columnWrapper: { gap: 16 },
  card: { flex: 1 },
  cardDesktop: {},
  cardRow: { flexDirection: 'row', alignItems: 'stretch' },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    gap: 12,
  },
  cardContentDesktop: { padding: 20 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: { fontWeight: '800', fontSize: 15 },
  cardInfo: { flex: 1, gap: 3, minWidth: 0 },
  cardName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  deptoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDepto: { fontSize: 12, fontWeight: '500' },
  rentaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  cardRenta: { fontSize: 14, fontWeight: '800' },
  actions: {
    flexDirection: 'column',
    borderLeftWidth: StyleSheet.hairlineWidth,
    width: 52,
    flexShrink: 0,
  },
  actionBtn: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  actionDivider: { height: StyleSheet.hairlineWidth },
  // Empty
  emptyCard: {},
  emptyContent: { alignItems: 'center', gap: 12 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    padding: 24,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 400,
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  confirmIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  confirmMsg: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    width: '100%',
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '600' },
});
