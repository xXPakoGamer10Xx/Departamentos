import { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator, Modal, Image,
  Alert, Platform, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors } from '../../constants/Colors';
import { api } from '../../services/api';

const DOCK_HEIGHT = 104;

function formatFecha(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'Hace un momento';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ComprobantesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [comprobantes, setComprobantes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  // Modal de imagen
  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getComprobantesPendientes();
      setComprobantes(res.data || []);
    } catch (e) {
      console.error('Error cargando comprobantes', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const confirmar = async (pagoId: string) => {
    Alert.alert(
      'Confirmar pago',
      '¿Confirmas que el comprobante es válido y el pago fue recibido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'default',
          onPress: async () => {
            try {
              setConfirmando(pagoId);
              await api.confirmarPagoPorId(pagoId);
              setModalVisible(false);
              setSelected(null);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'No se pudo confirmar el pago');
            } finally {
              setConfirmando(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIcon, { backgroundColor: '#10B981' + '20' }]}>
            <Ionicons name="document-attach" size={22} color="#10B981" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Comprobantes</Text>
            <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
              {comprobantes.length > 0
                ? `${comprobantes.length} pendiente${comprobantes.length !== 1 ? 's' : ''}`
                : 'Todo al día'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={load} style={styles.refreshBtn} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color={theme.primary} />
            : <Ionicons name="refresh" size={22} color={theme.primary} />}
        </TouchableOpacity>
      </View>

      {/* Lista */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: DOCK_HEIGHT + insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={theme.primary} size="large" />
        ) : comprobantes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={72} color={theme.textSecondary + '60'} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin comprobantes pendientes</Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
              Los nuevos comprobantes de pago aparecerán aquí para que los revises y confirmes.
            </Text>
          </View>
        ) : (
          comprobantes.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
              activeOpacity={0.75}
              onPress={() => { setSelected(c); setModalVisible(true); }}
            >
              {/* Miniatura */}
              <View style={[styles.thumb, { backgroundColor: theme.background }]}>
                {c.comprobante_url ? (
                  <Image
                    source={{ uri: c.comprobante_url }}
                    style={styles.thumbImg}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="image-outline" size={28} color={theme.textSecondary} />
                )}
              </View>

              {/* Info */}
              <View style={styles.cardInfo}>
                <Text style={[styles.cardNombre, { color: theme.text }]} numberOfLines={1}>
                  {c.nombre_completo}
                </Text>
                <View style={styles.cardRow}>
                  <Ionicons name="business-outline" size={13} color={theme.textSecondary} />
                  <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                    Depto {c.depto_numero}
                  </Text>
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="time-outline" size={13} color={theme.textSecondary} />
                  <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                    {formatFecha(c.comprobante_subido_en)}
                  </Text>
                </View>
              </View>

              {/* Chevron */}
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary + '80'} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal: imagen + confirmar */}
      <Modal visible={modalVisible} animationType="slide" statusBarTranslucent>
        <View style={[styles.modalRoot, { backgroundColor: theme.background }]}>
          {/* Header modal */}
          <View style={[styles.modalHeader, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.modalName, { color: theme.text }]} numberOfLines={1}>
                {selected?.nombre_completo}
              </Text>
              <Text style={[styles.modalMeta, { color: theme.textSecondary }]}>
                Depto {selected?.depto_numero} · {formatFecha(selected?.comprobante_subido_en)}
              </Text>
            </View>
          </View>

          {/* Imagen a pantalla completa */}
          <View style={styles.imgContainer}>
            {selected?.comprobante_url ? (
              <Image
                source={{ uri: selected.comprobante_url }}
                style={styles.fullImg}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.noImg}>
                <Ionicons name="image-outline" size={64} color={theme.textSecondary} />
                <Text style={[{ color: theme.textSecondary, marginTop: 12 }]}>Sin imagen</Text>
              </View>
            )}
          </View>

          {/* Acción */}
          <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 20, borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: '#10B981', opacity: confirmando === selected?.id ? 0.7 : 1 },
              ]}
              onPress={() => selected && confirmar(selected.id)}
              disabled={!!confirmando}
            >
              {confirmando === selected?.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.confirmBtnText}>Confirmar pago</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  headerSub: { fontSize: 13, marginTop: 1 },
  refreshBtn: { padding: 8 },

  listContent: { paddingHorizontal: 16, paddingTop: 4 },

  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 20, textAlign: 'center' },
  emptyBody: { fontSize: 14, marginTop: 10, textAlign: 'center', lineHeight: 20 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  cardInfo: { flex: 1, gap: 3 },
  cardNombre: { fontSize: 15, fontWeight: '700' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMeta: { fontSize: 12 },

  // Modal
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalClose: { padding: 4 },
  modalName: { fontSize: 16, fontWeight: '700' },
  modalMeta: { fontSize: 12, marginTop: 2 },
  imgContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImg: { width: '100%', height: '100%' },
  noImg: { alignItems: 'center' },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    borderRadius: 14,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
