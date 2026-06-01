import { useState, useRef, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, useColorScheme,
  ActivityIndicator, Platform, useWindowDimensions, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import api from '../../services/api';

let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== 'web') {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
}

const TOKEN_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

type Stage = 'scan' | 'confirm' | 'done' | 'error';

export default function ScanQRScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;

  const camPerms = useCameraPermissions ? useCameraPermissions() : [{ granted: false }, () => {}];
  const [permission, requestPermission] = camPerms as any;

  const [stage, setStage] = useState<Stage>('scan');
  const [pago, setPago] = useState<any>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const scannedRef = useRef(false);

  useFocusEffect(useCallback(() => {
    setStage('scan');
    setPago(null);
    setToken('');
    setError('');
    scannedRef.current = false;
  }, []));

  const processToken = async (tok: string) => {
    if (!tok) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.getPagoByToken(tok);
      setPago(res.data);
      setToken(tok);
      setStage(res.data?.confirmado ? 'done' : 'confirm');
    } catch {
      setError('QR inválido o expirado');
      setStage('error');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcode = ({ data }: { data: string }) => {
    if (scannedRef.current || loading || stage !== 'scan') return;
    const match = data.match(TOKEN_REGEX);
    if (!match) return;
    scannedRef.current = true;
    processToken(match[0]);
  };

  const confirmarPago = async () => {
    if (!token) return;
    setConfirmando(true);
    try {
      await api.confirmarPago(token);
      setStage('done');
    } catch (e: any) {
      setError(e.message || 'Error al confirmar el pago');
    } finally {
      setConfirmando(false);
    }
  };

  const reset = () => {
    setStage('scan');
    setPago(null);
    setToken('');
    setError('');
    setManualToken('');
    scannedRef.current = false;
  };

  // Entrada manual del código (web sin cámara): acepta el token UUID o la URL del QR.
  const buscarManual = () => {
    const raw = manualToken.trim();
    if (!raw) return;
    const match = raw.match(TOKEN_REGEX);
    processToken(match ? match[0] : raw);
  };

  const fmtRenta = (n: number) =>
    `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, isDesktop ? styles.headerDesktop : { paddingTop: insets.top + 20 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Escanear QR</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Confirmar pago de inquilino</Text>
        </View>
        {stage !== 'scan' && (
          <TouchableOpacity
            onPress={reset}
            style={[styles.resetBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
          >
            <Ionicons name="refresh" size={18} color={theme.textSecondary} />
            <Text style={[styles.resetText, { color: theme.textSecondary }]}>Nuevo scan</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.content, isDesktop && styles.contentDesktop]}>

        {/* ── SCAN ── */}
        {stage === 'scan' && (
          Platform.OS === 'web' ? (
            /* En web no hay cámara nativa — mostrar instrucción */
            <View style={[styles.webNotice, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: theme.border }]}>
              <View style={[styles.webNoticeIcon, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)' }]}>
                <Ionicons name="phone-portrait-outline" size={40} color={theme.primary} />
              </View>
              <Text style={[styles.webNoticeTitle, { color: theme.text }]}>
                Escanea con la app móvil
              </Text>
              <Text style={[styles.webNoticeText, { color: theme.textSecondary }]}>
                Abre la app en tu celular y ve a la pestaña Escanear para aceptar el pago en efectivo con la cámara.
              </Text>

              <View style={[styles.webNoticeTip, { backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.06)', borderColor: theme.primary + '30' }]}>
                <Ionicons name="information-circle-outline" size={14} color={theme.primary} />
                <Text style={[styles.webNoticeTipText, { color: theme.textSecondary }]}>
                  ¿Sin cámara? Pide al inquilino el código de su QR e ingrésalo aquí abajo.
                </Text>
              </View>

              {/* Entrada manual del código (web) */}
              <View style={{ width: '100%', marginTop: 16, gap: 10 }}>
                <TextInput
                  style={[styles.manualInput, {
                    color: theme.text,
                    borderColor: error ? theme.danger : theme.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  }]}
                  value={manualToken}
                  onChangeText={t => { setManualToken(t); setError(''); }}
                  placeholder="Código del QR (o pega la liga)"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={buscarManual}
                />
                {error ? (
                  <Text style={{ color: theme.danger, fontSize: 13 }}>{error}</Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.permBtn, { backgroundColor: theme.primary, opacity: (loading || !manualToken.trim()) ? 0.6 : 1, alignSelf: 'stretch', justifyContent: 'center' }]}
                  onPress={buscarManual}
                  disabled={loading || !manualToken.trim()}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Ionicons name="search" size={16} color="#fff" />}
                  <Text style={styles.permBtnText}>Buscar pago</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            !permission?.granted ? (
              <View style={[styles.cameraPlaceholder, { borderColor: theme.border }]}>
                <Ionicons name="camera-outline" size={56} color={theme.textSecondary} />
                <Text style={[styles.camTitle, { color: theme.text }]}>Acceso a la cámara</Text>
                <Text style={[styles.camText, { color: theme.textSecondary }]}>
                  Necesitamos acceso a la cámara para escanear el código QR del inquilino.
                </Text>
                <TouchableOpacity style={[styles.permBtn, { backgroundColor: theme.primary }]} onPress={requestPermission}>
                  <Ionicons name="camera" size={16} color="#fff" />
                  <Text style={styles.permBtnText}>Permitir cámara</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                <View style={styles.cameraWrapper}>
                  {CameraView && (
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={handleBarcode}
                    />
                  )}
                  {/* Visor */}
                  <View style={styles.scannerOverlay}>
                    <View style={styles.scannerFrame}>
                      <View style={[styles.corner, styles.cornerTL, { borderColor: theme.primary }]} />
                      <View style={[styles.corner, styles.cornerTR, { borderColor: theme.primary }]} />
                      <View style={[styles.corner, styles.cornerBL, { borderColor: theme.primary }]} />
                      <View style={[styles.corner, styles.cornerBR, { borderColor: theme.primary }]} />
                    </View>
                    <Text style={styles.scanHint}>Apunta al código QR del inquilino</Text>
                  </View>
                  {loading && (
                    <View style={styles.scanLoading}>
                      <ActivityIndicator color="#fff" size="large" />
                      <Text style={{ color: '#fff', marginTop: 8, fontWeight: '600' }}>Procesando…</Text>
                    </View>
                  )}
                </View>
              </View>
            )
          )
        )}

        {/* ── CONFIRMAR ── */}
        {stage === 'confirm' && pago && (
          <View style={[styles.resultCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: theme.border }]}>
            <View style={[styles.resultIcon, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)' }]}>
              <Ionicons name="cash-outline" size={36} color={theme.primary} />
            </View>
            <Text style={[styles.resultTitle, { color: theme.text }]}>Pago pendiente</Text>

            <View style={[styles.resultDetails, { borderColor: theme.border }]}>
              <View style={styles.resultRow}>
                <Ionicons name="person-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>Inquilino</Text>
                <Text style={[styles.resultValue, { color: theme.text }]}>{pago.nombre_completo}</Text>
              </View>
              <View style={styles.resultRow}>
                <Ionicons name="home-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>Departamento</Text>
                <Text style={[styles.resultValue, { color: theme.text }]}>Depto {pago.depto_numero}</Text>
              </View>
              <View style={styles.resultRow}>
                <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>Periodo</Text>
                <Text style={[styles.resultValue, { color: theme.text }]}>{pago.periodo}</Text>
              </View>
              <View style={[styles.resultRow, styles.resultRowAmount]}>
                <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>Total</Text>
                <Text style={[styles.amountValue, { color: theme.text }]}>{fmtRenta(pago.monto || pago.renta || 0)}</Text>
              </View>
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.danger + '15', borderColor: theme.danger + '30' }]}>
                <Ionicons name="alert-circle-outline" size={14} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.confirmBtn, { opacity: confirmando ? 0.7 : 1 }]}
              onPress={confirmarPago}
              disabled={confirmando}
            >
              {confirmando
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              }
              <Text style={styles.confirmBtnText}>
                {confirmando ? 'Confirmando…' : 'Confirmar pago'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={reset} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── DONE ── */}
        {stage === 'done' && (
          <View style={[styles.resultCard, { backgroundColor: isDark ? 'rgba(52,199,89,0.08)' : '#F0FFF4', borderColor: '#34C75940' }]}>
            <View style={[styles.resultIcon, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
              <Ionicons name="checkmark-circle" size={48} color="#34C759" />
            </View>
            <Text style={[styles.resultTitle, { color: '#34C759' }]}>¡Pago confirmado!</Text>
            {pago && (
              <View style={[styles.resultDetails, { borderColor: '#34C75930' }]}>
                <View style={styles.resultRow}>
                  <Ionicons name="person-outline" size={16} color="#34C759" />
                  <Text style={[styles.resultLabel, { color: '#34C759' }]}>Inquilino</Text>
                  <Text style={[styles.resultValue, { color: '#34C759' }]}>{pago.nombre_completo}</Text>
                </View>
                <View style={styles.resultRow}>
                  <Ionicons name="home-outline" size={16} color="#34C759" />
                  <Text style={[styles.resultLabel, { color: '#34C759' }]}>Departamento</Text>
                  <Text style={[styles.resultValue, { color: '#34C759' }]}>Depto {pago.depto_numero}</Text>
                </View>
                <View style={[styles.resultRow, styles.resultRowAmount]}>
                  <Text style={[styles.amountLabel, { color: '#34C75990' }]}>Total</Text>
                  <Text style={[styles.amountValue, { color: '#34C759' }]}>{fmtRenta(pago.monto || pago.renta || 0)}</Text>
                </View>
              </View>
            )}
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#34C759' }]} onPress={reset}>
              <Ionicons name="qr-code-outline" size={18} color="#fff" />
              <Text style={styles.confirmBtnText}>Escanear otro QR</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ERROR ── */}
        {stage === 'error' && (
          <View style={[styles.resultCard, { backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#FFF5F5', borderColor: '#EF444440' }]}>
            <View style={[styles.resultIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
              <Ionicons name="close-circle" size={48} color="#EF4444" />
            </View>
            <Text style={[styles.resultTitle, { color: '#EF4444' }]}>QR inválido</Text>
            <Text style={[styles.errorDesc, { color: theme.textSecondary }]}>{error}</Text>
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.primary }]} onPress={reset}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.confirmBtnText}>Intentar de nuevo</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 70 : 24, paddingBottom: 12, gap: 12,
  },
  headerDesktop: { paddingTop: 24, paddingHorizontal: 40, maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 2, opacity: 0.7 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  resetText: { fontSize: 13, fontWeight: '600' },

  content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  contentDesktop: { maxWidth: 560, alignSelf: 'center', width: '100%', paddingHorizontal: 0 },

  // Web notice
  webNotice: {
    borderRadius: 20, borderWidth: 1, padding: 32, alignItems: 'center', gap: 16,
    marginTop: 20,
  },
  webNoticeIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  webNoticeTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  webNoticeText: { fontSize: 14, textAlign: 'center', lineHeight: 22, opacity: 0.8 },
  webNoticeTip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1, width: '100%',
  },
  webNoticeTipText: { flex: 1, fontSize: 13, lineHeight: 18 },
  manualInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },

  // Cámara
  cameraPlaceholder: {
    borderRadius: 20, borderWidth: 2, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32, marginTop: 20,
  },
  camTitle: { fontSize: 18, fontWeight: '800' },
  camText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  permBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 4 },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  cameraWrapper: { height: 340, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 24 },
  scannerFrame: { width: 230, height: 230, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanHint: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 20 },
  scanLoading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13 },
  resultCard: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: 'center', gap: 16, marginTop: 8 },
  resultIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  resultTitle: { fontSize: 22, fontWeight: '800' },
  errorDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  resultDetails: { width: '100%', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultRowAmount: { paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.2)', marginTop: 4 },
  resultLabel: { fontSize: 13, flex: 1 },
  resultValue: { fontSize: 13, fontWeight: '700' },
  amountLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  amountValue: { fontSize: 22, fontWeight: '900' },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: 16, width: '100%', backgroundColor: '#34C759',
  },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontSize: 14 },
});
