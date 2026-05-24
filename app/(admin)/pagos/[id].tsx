import {
  StyleSheet, View, Text, TouchableOpacity, useColorScheme,
  ActivityIndicator, useWindowDimensions, Platform, Image,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../services/api';

export default function PagoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  const [inquilino, setInquilino] = useState<any>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [pago, setPago] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getInquilinoById(id),
      api.getConfig(),
      api.getEstadoPago(id),
    ]).then(([inqRes, cfgRes, estadoRes]) => {
      setInquilino(inqRes.data);
      setConfig(cfgRes.data || {});
      if (estadoRes.data) setPago(estadoRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const generarQr = useCallback(async () => {
    if (!id || Platform.OS !== 'web') return;
    setGenerando(true);
    try {
      const res = await api.generarQrPago(id);
      const token = res.data?.qr_token;
      setPago(res.data);
      if (token) {
        const QRCode = await import('qrcode');
        const baseUrl = window.location.origin;
        const confirmUrl = `${baseUrl}/pagos/confirmar/${token}`;
        const dataUrl = await QRCode.toDataURL(confirmUrl, { width: 280, margin: 2 });
        setQrDataUrl(dataUrl);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerando(false);
    }
  }, [id]);

  const confirmarDirecto = useCallback(async () => {
    if (!pago?.qr_token) return;
    setConfirmando(true);
    try {
      const res = await api.confirmarPago(pago.qr_token);
      setPago(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setConfirmando(false);
    }
  }, [pago]);

  const fmtRenta = (n: number) =>
    `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  const getPeriodoLabel = () => {
    const now = new Date();
    return now.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient colors={isDark ? ['#1a1a1a', '#000000'] : ['#F2F2F7', '#E5E5EA']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!inquilino) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient colors={isDark ? ['#1a1a1a', '#000000'] : ['#F2F2F7', '#E5E5EA']} style={StyleSheet.absoluteFill} />
        <Ionicons name="alert-circle-outline" size={48} color={theme.danger} />
        <Text style={{ color: theme.textSecondary, marginTop: 12 }}>Inquilino no encontrado</Text>
      </View>
    );
  }

  const esTransferencia = inquilino.metodo_pago === 'transferencia';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={isDark ? ['#1a1a1a', '#000000'] : ['#F2F2F7', '#E5E5EA']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[styles.header, isDesktop && styles.headerDesktop, !isDesktop && { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Cobrar Renta</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {inquilino.nombre_completo} · Depto {inquilino.depto_numero}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop, { paddingBottom: isDesktop ? 32 : insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Monto */}
        <View style={[styles.montoCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}>
          <Text style={[styles.montoLabel, { color: theme.textSecondary }]}>{getPeriodoLabel()}</Text>
          <Text style={[styles.montoAmount, { color: theme.text }]}>{fmtRenta(inquilino.renta)}</Text>
          <Text style={[styles.montoSub, { color: theme.textSecondary }]}>Renta mensual · Depto {inquilino.depto_numero}</Text>

          {pago?.confirmado && (
            <View style={styles.pagadoBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.pagadoText}>Pagado</Text>
            </View>
          )}
        </View>

        {/* Transferencia: tarjeta bancaria */}
        {esTransferencia ? (
          <View>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Datos para transferencia</Text>
            <LinearGradient
              colors={['#1a56c4', '#0a3d8a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bankCard}
            >
              {/* Chip */}
              <View style={styles.chip}>
                <View style={styles.chipInner} />
              </View>

              <View style={styles.bankCardBody}>
                <Text style={styles.bankName}>
                  {config.banco_nombre || 'BANCO'}
                </Text>
                <Text style={styles.bankClabe}>
                  {formatClabe(config.banco_clabe || '')}
                </Text>
                <Text style={styles.bankTitular}>
                  {config.banco_titular || 'Titular no configurado'}
                </Text>
              </View>

              {/* Card logo area */}
              <View style={styles.bankCardFooter}>
                <Ionicons name="card" size={28} color="rgba(255,255,255,0.4)" />
                <Text style={styles.bankCardType}>CLABE</Text>
              </View>
            </LinearGradient>

            {(!config.banco_nombre || !config.banco_clabe) && (
              <TouchableOpacity
                style={[styles.configBtn, { borderColor: theme.border }]}
                onPress={() => router.push('/(admin)/configuracion')}
              >
                <Ionicons name="settings-outline" size={16} color={theme.primary} />
                <Text style={[styles.configBtnText, { color: theme.primary }]}>
                  Configurar datos bancarios en Ajustes
                </Text>
              </TouchableOpacity>
            )}

            {!pago?.confirmado && (
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: '#34C759', opacity: confirmando ? 0.7 : 1 }]}
                onPress={confirmarDirecto}
                disabled={confirmando || !pago?.qr_token}
              >
                {confirmando
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                }
                <Text style={styles.confirmBtnText}>
                  {confirmando ? 'Confirmando…' : 'Marcar como pagado'}
                </Text>
              </TouchableOpacity>
            )}

            {!pago && (
              <TouchableOpacity
                style={[styles.generateBtn, { backgroundColor: theme.primary, opacity: generando ? 0.7 : 1 }]}
                onPress={generarQr}
                disabled={generando}
              >
                {generando
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="add-circle-outline" size={20} color="#fff" />
                }
                <Text style={styles.confirmBtnText}>
                  {generando ? 'Generando…' : 'Registrar pago'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* Efectivo: QR */
          <View>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Pago en efectivo</Text>
            <View style={[styles.qrCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}>
              {pago?.confirmado ? (
                <View style={styles.qrConfirmado}>
                  <Ionicons name="checkmark-circle" size={64} color="#34C759" />
                  <Text style={[styles.qrConfirmadoText, { color: theme.text }]}>¡Pago confirmado!</Text>
                  <Text style={[styles.qrConfirmadoSub, { color: theme.textSecondary }]}>
                    {pago.confirmado_en
                      ? new Date(pago.confirmado_en).toLocaleString('es-MX')
                      : getPeriodoLabel()}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.qrHint, { color: theme.textSecondary }]}>
                    Genera el QR y escanéalo con tu teléfono para confirmar el pago automáticamente
                  </Text>

                  {qrDataUrl && Platform.OS === 'web' ? (
                    <View style={styles.qrWrapper}>
                      <Image
                        source={{ uri: qrDataUrl }}
                        style={styles.qrImage}
                        resizeMode="contain"
                      />
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.generateBtn, { backgroundColor: theme.primary, opacity: generando ? 0.7 : 1 }]}
                    onPress={generarQr}
                    disabled={generando || Platform.OS !== 'web'}
                  >
                    {generando
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Ionicons name="qr-code-outline" size={20} color="#fff" />
                    }
                    <Text style={styles.confirmBtnText}>
                      {generando ? 'Generando…' : qrDataUrl ? 'Regenerar QR' : 'Generar QR'}
                    </Text>
                  </TouchableOpacity>

                  {pago?.qr_token && !pago.confirmado && (
                    <TouchableOpacity
                      style={[styles.confirmBtn, { backgroundColor: '#34C759', opacity: confirmando ? 0.7 : 1 }]}
                      onPress={confirmarDirecto}
                      disabled={confirmando}
                    >
                      {confirmando
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                      }
                      <Text style={styles.confirmBtnText}>
                        {confirmando ? 'Confirmando…' : 'Confirmar pago aquí'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function formatClabe(clabe: string): string {
  if (!clabe) return '•••• •••• •••• ••••';
  const clean = clabe.replace(/\D/g, '');
  if (clean.length === 18) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)} ${clean.slice(12, 16)} ${clean.slice(16)}`;
  }
  return clabe;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 70 : 24,
    paddingBottom: 16,
    gap: 12,
  },
  headerDesktop: {
    paddingTop: 24,
    paddingHorizontal: 40,
    maxWidth: Theme.layout.maxWidth,
    alignSelf: 'center',
    width: '100%',
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, marginTop: 2, opacity: 0.65 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60, gap: 20 },
  scrollContentDesktop: {
    paddingHorizontal: 40,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },

  montoCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  montoLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  montoAmount: { fontSize: 42, fontWeight: '900', letterSpacing: -1 },
  montoSub: { fontSize: 14 },
  pagadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#34C75920',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pagadoText: { color: '#34C759', fontWeight: '700', fontSize: 14 },

  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },

  // Tarjeta bancaria
  bankCard: {
    borderRadius: 20,
    padding: 24,
    height: 200,
    justifyContent: 'space-between',
    shadowColor: '#1a56c4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  chip: {
    width: 44,
    height: 34,
    borderRadius: 6,
    backgroundColor: 'rgba(255,200,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipInner: {
    width: 36,
    height: 26,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(180,140,0,0.6)',
    backgroundColor: 'rgba(255,210,30,0.5)',
  },
  bankCardBody: { gap: 6 },
  bankName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  bankClabe: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  bankTitular: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bankCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  bankCardType: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },

  configBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  configBtnText: { fontSize: 13, fontWeight: '600' },

  // QR
  qrCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  qrHint: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  qrImage: { width: 220, height: 220 },
  qrConfirmado: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  qrConfirmadoText: { fontSize: 20, fontWeight: '800' },
  qrConfirmadoSub: { fontSize: 13 },

  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
    justifyContent: 'center',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
    justifyContent: 'center',
    marginTop: 4,
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
