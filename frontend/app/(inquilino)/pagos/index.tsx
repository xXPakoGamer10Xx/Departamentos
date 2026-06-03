import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator, Image, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../services/api';
import { getItem } from '../../../services/storage';

const USER_KEY = 'auth_user';

function getMiId(): string | null {
  try {
    const user = JSON.parse(getItem(USER_KEY) || 'null');
    return user?.id || null;
  } catch { return null; }
}

function periodoLabel(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  const d = new Date(parseInt(anio), parseInt(mes) - 1, 1);
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

function fmtFecha(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtRenta(n: number): string {
  return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

export default function InquilinoHistorialPagos() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [pagos, setPagos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inquilinoId, setInquilinoId] = useState<string | null>(null);
  const [comprobanteVisible, setComprobanteVisible] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    api.getMiDepto()
      .then(r => {
        const id = r.data?.id;
        setInquilinoId(id);
        if (!id) return;
        return api.getHistorialPagos(id).then(h => setPagos(h.data || []));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []));

  const resumen = {
    total: pagos.filter(p => p.confirmado).length,
    aTiempo: pagos.filter(p => p.confirmado && p.a_tiempo === true).length,
    tarde: pagos.filter(p => p.confirmado && p.a_tiempo === false).length,
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Historial de pagos</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Todos tus pagos registrados
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
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Resumen */}
          {pagos.length > 0 && (
            <View style={styles.resumenRow}>
              <View style={[styles.resumenChip, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)' }]}>
                <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
                <Text style={[styles.resumenNum, { color: theme.primary }]}>{resumen.total}</Text>
                <Text style={[styles.resumenLabel, { color: theme.textSecondary }]}>pagado{resumen.total !== 1 ? 's' : ''}</Text>
              </View>
              <View style={[styles.resumenChip, { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)' }]}>
                <Ionicons name="time" size={16} color="#10B981" />
                <Text style={[styles.resumenNum, { color: '#10B981' }]}>{resumen.aTiempo}</Text>
                <Text style={[styles.resumenLabel, { color: theme.textSecondary }]}>a tiempo</Text>
              </View>
              <View style={[styles.resumenChip, { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)' }]}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={[styles.resumenNum, { color: '#EF4444' }]}>{resumen.tarde}</Text>
                <Text style={[styles.resumenLabel, { color: theme.textSecondary }]}>tarde</Text>
              </View>
            </View>
          )}

          {pagos.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={56} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin historial de pagos</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Tus pagos confirmados aparecerán aquí.
              </Text>
            </View>
          ) : (
            pagos.map(pago => {
              const confirmado = pago.confirmado;
              const aTiempo = pago.a_tiempo;

              let badgeColor = '#6B7280';
              let badgeLabel = 'Pendiente';
              let badgeIcon = 'ellipse-outline';
              if (confirmado && aTiempo === true) {
                badgeColor = '#10B981'; badgeLabel = 'A tiempo'; badgeIcon = 'checkmark-circle';
              } else if (confirmado && aTiempo === false) {
                badgeColor = '#F59E0B'; badgeLabel = 'Con retraso'; badgeIcon = 'warning';
              } else if (confirmado && aTiempo === null) {
                badgeColor = '#10B981'; badgeLabel = 'Confirmado'; badgeIcon = 'checkmark-circle';
              }

              return (
                <View
                  key={pago.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                      borderColor: confirmado ? (badgeColor + '30') : theme.border,
                    },
                  ]}
                >
                  {/* Barra lateral de color */}
                  <View style={[styles.cardBar, { backgroundColor: badgeColor }]} />

                  <View style={{ flex: 1, gap: 8 }}>
                    {/* Periodo + badge */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.periodoLabel, { color: theme.text }]}>
                        {periodoLabel(pago.periodo).toUpperCase()}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: badgeColor + '20' }]}>
                        <Ionicons name={badgeIcon as any} size={12} color={badgeColor} />
                        <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
                      </View>
                    </View>

                    {/* Monto */}
                    <Text style={[styles.monto, { color: theme.text }]}>
                      {fmtRenta(pago.monto || 0)}
                    </Text>

                    {/* Fecha de confirmación */}
                    {confirmado && pago.confirmado_en && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} />
                        <Text style={[styles.fechaText, { color: theme.textSecondary }]}>
                          Pagado: {fmtFecha(pago.confirmado_en)}
                        </Text>
                      </View>
                    )}

                    {/* Método */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons
                        name={pago.metodo === 'transferencia' ? 'card-outline' : 'cash-outline'}
                        size={13}
                        color={theme.textSecondary}
                      />
                      <Text style={[styles.fechaText, { color: theme.textSecondary }]}>
                        {pago.metodo === 'transferencia' ? 'Transferencia bancaria' : 'Efectivo (QR)'}
                      </Text>
                    </View>

                    {/* Comprobante */}
                    {pago.comprobante_url && (
                      <TouchableOpacity
                        style={[styles.comprobanteBtn, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)', borderColor: theme.primary + '30' }]}
                        onPress={() => setComprobanteVisible(pago.comprobante_url)}
                      >
                        <Ionicons name="document-attach-outline" size={14} color={theme.primary} />
                        <Text style={[styles.comprobanteBtnText, { color: theme.primary }]}>
                          Ver comprobante
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal comprobante */}
      <Modal visible={!!comprobanteVisible} transparent animationType="fade" onRequestClose={() => setComprobanteVisible(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setComprobanteVisible(null)} />
          <View style={[styles.modalBox, { backgroundColor: isDark ? '#1E2235' : '#fff' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Comprobante de pago</Text>
              <TouchableOpacity onPress={() => setComprobanteVisible(null)}>
                <Ionicons name="close-circle" size={26} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            {comprobanteVisible && (
              <Image source={{ uri: comprobanteVisible }} style={styles.comprobanteImg} resizeMode="contain" />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16, gap: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, marginTop: 2, opacity: 0.7 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, gap: 12 },

  resumenRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  resumenChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 12, borderRadius: 14,
  },
  resumenNum: { fontSize: 18, fontWeight: '900' },
  resumenLabel: { fontSize: 11, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22, opacity: 0.75 },

  card: {
    flexDirection: 'row', borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    paddingRight: 16, paddingVertical: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardBar: { width: 4, marginRight: 14, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  periodoLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, flex: 1 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  monto: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  fechaText: { fontSize: 12 },
  comprobanteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1,
    alignSelf: 'flex-start',
  },
  comprobanteBtnText: { fontSize: 12, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalBox: { borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  comprobanteImg: { width: '100%', height: 360, borderRadius: 12 },
});
