import { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator, Modal, Image, TextInput,
  Alert, Platform, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import api from '../../services/api';
import { useSSEEvent } from '../../hooks/useSSE';
import { usePermisoGuard } from '../../hooks/usePermisoGuard';

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

function avisar(mensaje: string) {
  if (Platform.OS === 'web') window.alert(mensaje);
  else Alert.alert('Error', mensaje);
}

export default function AdminComprobantesScreen() {
  usePermisoGuard('pagos.marcar');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;

  const [comprobantes, setComprobantes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [rechazando, setRechazando] = useState(false);

  // Modal de imagen / revisión
  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  // Modal de rechazo (motivo / observación)
  const [showRechazarModal, setShowRechazarModal] = useState(false);
  const [rechazarComentario, setRechazarComentario] = useState('');

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

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useSSEEvent('comprobante_subido', () => load());

  const confirmar = async () => {
    if (!selected) return;
    setConfirmando(true);
    try {
      await api.confirmarPagoPorId(selected.id);
      setModalVisible(false);
      setSelected(null);
      await load();
    } catch (e: any) {
      avisar(e.message || 'No se pudo confirmar el pago');
    } finally {
      setConfirmando(false);
    }
  };

  const abrirRechazo = () => {
    setRechazarComentario('');
    setShowRechazarModal(true);
  };

  const rechazar = async () => {
    if (!selected) return;
    setRechazando(true);
    try {
      await api.rechazarPagoPorId(selected.id, rechazarComentario.trim());
      setShowRechazarModal(false);
      setModalVisible(false);
      setSelected(null);
      setRechazarComentario('');
      await load();
    } catch (e: any) {
      avisar(e.message || 'No se pudo rechazar el comprobante');
    } finally {
      setRechazando(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: (isDesktop ? 32 : insets.top + 16) }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIcon, { backgroundColor: '#10B981' + '20' }]}>
            <Ionicons name="document-attach" size={22} color="#10B981" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Comprobantes</Text>
            <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
              {comprobantes.length > 0
                ? `${comprobantes.length} pendiente${comprobantes.length !== 1 ? 's' : ''} de revisar`
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
          { paddingBottom: (isDesktop ? 20 : DOCK_HEIGHT + insets.bottom + 20) },
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
              Cuando un inquilino suba una imagen de su transferencia, aparecerá aquí para que la revises,
              la marques como pagada o la rechaces con un comentario.
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
              <View style={[styles.thumb, { backgroundColor: theme.background }]}>
                {c.comprobante_url ? (
                  <Image source={{ uri: c.comprobante_url }} style={styles.thumbImg} resizeMode="cover" />
                ) : (
                  <Ionicons name="image-outline" size={28} color={theme.textSecondary} />
                )}
              </View>

              <View style={styles.cardInfo}>
                <Text style={[styles.cardNombre, { color: theme.text }]} numberOfLines={1}>
                  {c.nombre_completo}
                </Text>
                <View style={styles.cardRow}>
                  <Ionicons name="business-outline" size={13} color={theme.textSecondary} />
                  <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>Depto {c.depto_numero}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="time-outline" size={13} color={theme.textSecondary} />
                  <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                    {formatFecha(c.comprobante_subido_en)}
                  </Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary + '80'} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal: imagen + confirmar/rechazar */}
      <Modal visible={modalVisible} animationType="slide" statusBarTranslucent onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modalRoot, { backgroundColor: theme.background }]}>
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

          <View style={styles.imgContainer}>
            {selected?.comprobante_url ? (
              <Image source={{ uri: selected.comprobante_url }} style={styles.fullImg} resizeMode="contain" />
            ) : (
              <View style={styles.noImg}>
                <Ionicons name="image-outline" size={64} color={theme.textSecondary} />
                <Text style={[{ color: theme.textSecondary, marginTop: 12 }]}>Sin imagen</Text>
              </View>
            )}
          </View>

          <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 20, borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.rechazarBtn, { borderColor: '#EF4444', opacity: (confirmando || rechazando) ? 0.7 : 1 }]}
              onPress={abrirRechazo}
              disabled={confirmando || rechazando}
            >
              <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
              <Text style={[styles.rechazarBtnText, { color: '#EF4444' }]}>Rechazar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: '#10B981', opacity: (confirmando || rechazando) ? 0.7 : 1 }]}
              onPress={confirmar}
              disabled={confirmando || rechazando}
            >
              {confirmando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.confirmBtnText}>Ya pagó</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: motivo del rechazo */}
      <Modal visible={showRechazarModal} transparent animationType="fade" onRequestClose={() => setShowRechazarModal(false)}>
        <View style={styles.rechazoOverlay}>
          <View style={[styles.rechazoBox, { backgroundColor: isDark ? '#232842' : '#fff' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EF444420', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.rechazoTitle, { color: theme.text }]}>Rechazar comprobante</Text>
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 16 }}>
              El inquilino será notificado y podrá subir un nuevo comprobante.
            </Text>
            <Text style={[styles.rechazoLabel, { color: theme.textSecondary }]}>Observación / comentario (opcional)</Text>
            <TextInput
              style={[
                styles.rechazoInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
              ]}
              value={rechazarComentario}
              onChangeText={setRechazarComentario}
              placeholder="Ej: No es el comprobante de este depto, el monto no coincide..."
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={300}
            />
            <View style={styles.rechazoBtns}>
              <TouchableOpacity
                style={[styles.rechazoCancelBtn, { borderColor: theme.border }]}
                onPress={() => setShowRechazarModal(false)}
                disabled={rechazando}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rechazoConfirmBtn, { backgroundColor: '#EF4444', opacity: rechazando ? 0.7 : 1 }]}
                onPress={rechazar}
                disabled={rechazando}
              >
                {rechazando
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '700' }}>Rechazar</Text>
                }
              </TouchableOpacity>
            </View>
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
  headerIcon: { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  headerSub: { fontSize: 13, marginTop: 1 },
  refreshBtn: { padding: 8 },

  listContent: { paddingHorizontal: 16, paddingTop: 4, maxWidth: 720, width: '100%', alignSelf: 'center' },

  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 20, textAlign: 'center' },
  emptyBody: { fontSize: 14, marginTop: 10, textAlign: 'center', lineHeight: 20 },

  card: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1,
    padding: 12, marginBottom: 12, gap: 12,
  },
  thumb: { width: 60, height: 60, borderRadius: 12, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  cardInfo: { flex: 1, gap: 3 },
  cardNombre: { fontSize: 15, fontWeight: '700' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMeta: { fontSize: 12 },

  // Modal imagen
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  modalClose: { padding: 4 },
  modalName: { fontSize: 16, fontWeight: '700' },
  modalMeta: { fontSize: 12, marginTop: 2 },
  imgContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fullImg: { width: '100%', height: '100%' },
  noImg: { alignItems: 'center' },
  modalFooter: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1 },
  rechazarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16,
  },
  rechazarBtnText: { fontSize: 15, fontWeight: '700' },
  confirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 54, borderRadius: 14,
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Modal rechazo
  rechazoOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 },
  rechazoBox: { width: '100%', maxWidth: 420, borderRadius: 20, padding: 24 },
  rechazoTitle: { fontSize: 17, fontWeight: '700' },
  rechazoLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  rechazoInput: {
    borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14,
    minHeight: 80, textAlignVertical: 'top', marginBottom: 16,
  },
  rechazoBtns: { flexDirection: 'row', gap: 10 },
  rechazoCancelBtn: {
    flex: 1, height: 48, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center',
  },
  rechazoConfirmBtn: {
    flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
});
