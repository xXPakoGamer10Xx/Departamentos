import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator, useWindowDimensions,
  Platform, Image, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { getItem, removeItem } from '../../services/storage';
import { useSSEEvent } from '../../hooks/useSSE';
import { showWebNotification } from '../../services/webNotifications';
import { NotificationBell } from '../../components/ui/NotificationBell';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export default function InquilinoHome() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 600;

  const [inquilino, setInquilino] = useState<any>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [pago, setPago] = useState<any>(null);
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [totalExtra, setTotalExtra] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null);

  const storedUser = (() => {
    try {
      return JSON.parse(getItem(USER_KEY) || 'null');
    } catch { /* empty */ }
    return null;
  })();

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [inqRes, cfgRes] = await Promise.all([api.getMiDepto(), api.getConfig()]);
      const inq = inqRes.data;
      setInquilino(inq);
      setConfig(cfgRes.data || {});
      if (inq?.id) {
        const pagoRes = await api.getEstadoPago(inq.id);
        if (pagoRes?.data !== undefined) setPago(pagoRes.data ?? null);
        setCuotas(pagoRes?.cuotas ?? []);
        setTotalExtra(pagoRes?.total_extra ?? 0);
      }
    } catch { /* silent fail */ }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  useSSEEvent('payment_confirmed', (data) => {
    if (data.pago) setPago((prev: any) => ({ ...prev, ...data.pago }));
    showWebNotification('✅ ¡Pago confirmado!', 'Tu pago de este mes fue confirmado');
  });

  useSSEEvent('payment_rejected', (data) => {
    if (data.pago) setPago((prev: any) => ({ ...prev, ...data.pago }));
    const razon = data.pago?.comentario_admin ? `Razón: ${data.pago.comentario_admin}` : 'Por favor envía un nuevo comprobante.';
    showWebNotification('❌ Comprobante rechazado', razon);
    Alert.alert('❌ Comprobante rechazado', razon);
  });

  const generarQr = useCallback(async () => {
    if (!inquilino?.id) return;
    setGenerando(true);
    try {
      const res = await api.generarQrPago(inquilino.id);
      const token = res.data?.qr_token;
      setPago(res.data);
      if (token) {
        let confirmUrl = '';
        if (Platform.OS === 'web') {
          const appUrl = config.app_url?.trim().replace(/\/$/, '');
          const origin = appUrl || (typeof window !== 'undefined' ? window.location.origin : '');
          confirmUrl = `${origin}/confirmar/${token}`;
        } else {
          const match = api.getBaseUrl().match(/^(https?:\/\/[^\/:]+)/);
          const host = match ? match[1] : 'http://localhost';
          confirmUrl = `${host}:8081/confirmar/${token}`;
        }
        const dataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=2&data=${encodeURIComponent(confirmUrl)}`;
        setQrDataUrl(dataUrl);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerando(false);
    }
  }, [inquilino, config]);

  const seleccionarComprobante = useCallback(async () => {
    if (!inquilino?.id) return;
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            setComprobantePreview(ev.target?.result as string);
          };
          reader.readAsDataURL(file);
        };
        input.click();
      } else {
        const ImagePicker = await import('expo-image-picker');
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir el comprobante.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.5,
          base64: true,
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        setComprobantePreview(`data:image/jpeg;base64,${asset.base64}`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo abrir la galería');
    }
  }, [inquilino]);

  const enviarComprobante = useCallback(async () => {
    if (!inquilino?.id || !comprobantePreview) return;
    setSubiendoComprobante(true);
    try {
      const res = await api.subirComprobante(inquilino.id, comprobantePreview);
      setPago(res.data);
      setComprobantePreview(null);
      Alert.alert('✅ Comprobante enviado', 'El administrador revisará tu pago pronto.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo subir el comprobante');
    } finally {
      setSubiendoComprobante(false);
    }
  }, [inquilino, comprobantePreview]);

  const handleLogout = () => {
    removeItem(TOKEN_KEY);
    removeItem(USER_KEY);
    api.setToken(null);
    router.replace('/(auth)/login');
  };

  const fmtRenta = (n: number) =>
    `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  const getPeriodoLabel = () =>
    new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).toUpperCase();

  const detectBankInfo = (numero: string): { tipo: string; formato: string } => {
    if (!numero) return { tipo: 'CLABE', formato: '•••• •••• •••• ••••' };
    const c = numero.replace(/\D/g, '');
    if (c.length === 18) return { tipo: 'CLABE', formato: `${c.slice(0, 4)} ${c.slice(4, 8)} ${c.slice(8, 12)} ${c.slice(12, 16)} ${c.slice(16)}` };
    if (c.length === 16) return { tipo: 'No. de tarjeta', formato: `${c.slice(0, 4)} ${c.slice(4, 8)} ${c.slice(8, 12)} ${c.slice(12)}` };
    if (c.length >= 10) return { tipo: 'No. de cuenta', formato: c };
    return { tipo: 'Cuenta', formato: numero };
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient colors={isDark ? ['#0E1321', '#1A1F2E'] : ['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const esTransferencia = inquilino?.metodo_pago === 'transferencia' || inquilino?.metodo_pago === 'ambos';
  const esEfectivo = inquilino?.metodo_pago === 'efectivo' || inquilino?.metodo_pago === 'ambos';

  const renderAptoCard = () => (
    <View style={[styles.aptoCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}>
      <View style={[styles.aptoIconWrap, { backgroundColor: theme.primaryLight || theme.primary + '20' }]}>
        <Ionicons name="home" size={22} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.aptoLabel, { color: theme.textSecondary }]}>Tu departamento</Text>
        <Text style={[styles.aptoNum, { color: theme.text }]}>Depto {inquilino?.depto_numero}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.aptoLabel, { color: theme.textSecondary }]}>Renta mensual</Text>
        <Text style={[styles.aptoRenta, { color: theme.text }]}>{inquilino ? fmtRenta(inquilino.renta) : ''}</Text>
      </View>
    </View>
  );

  const renderStatusCard = () => (
    <View style={[styles.statusCard, { backgroundColor: pago?.confirmado ? (isDark ? 'rgba(16,185,129,0.12)' : '#ECFDF5') : (isDark ? 'rgba(255,255,255,0.05)' : '#fff') }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons
          name={pago?.confirmado ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={pago?.confirmado ? '#10B981' : theme.textSecondary}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusMonth, { color: theme.textSecondary }]}>{getPeriodoLabel()}</Text>
          <Text style={[styles.statusLabel, { color: pago?.confirmado ? '#10B981' : theme.text }]}>
            {pago?.confirmado ? '¡Pago confirmado!' : pago ? 'Pago pendiente' : 'Sin registro de pago'}
          </Text>
          {pago?.confirmado && pago.confirmado_en ? (
            <Text style={[styles.statusDate, { color: theme.textSecondary }]}>
              {new Date(pago.confirmado_en).toLocaleString('es-MX')}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.statusAmount, { color: theme.text }]}>{inquilino ? fmtRenta(inquilino.renta) : ''}</Text>
      </View>
    </View>
  );

  const renderMetodosPago = () => {
    if (pago?.confirmado) return null;
    return (
      <>
        {/* Sin método de pago configurado */}
        {!esTransferencia && !esEfectivo && (
          <View style={[styles.noMethodBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderColor: theme.border }]}>
            <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
            <Text style={[styles.noMethodText, { color: theme.textSecondary }]}>
              El administrador aún no ha configurado tu método de pago. Contáctalo para más información.
            </Text>
          </View>
        )}

        {/* Transferencia bancaria */}
        {esTransferencia && (() => {
          const bankInfo = detectBankInfo(config.banco_clabe || '');
          return (
            <View style={{ gap: 8 }}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Datos para transferencia</Text>
              {(config.banco_clabe || config.banco_nombre) ? (
                <>
                  <LinearGradient
                    colors={['#1a56c4', '#0a3d8a']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.bankCard}
                  >
                    <View style={styles.chip}><View style={styles.chipInner} /></View>
                    <View style={{ gap: 6 }}>
                      <Text style={styles.bankName}>{config.banco_nombre || 'BANCO'}</Text>
                      <Text style={styles.bankClabe}>{bankInfo.formato}</Text>
                      <Text style={styles.bankTitular}>{config.banco_titular || ''}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <Ionicons name="card" size={26} color="rgba(255,255,255,0.4)" />
                      <Text style={styles.bankType}>{bankInfo.tipo}</Text>
                    </View>
                  </LinearGradient>
                  
                  {comprobantePreview ? (
                    <View style={[styles.comprobanteBox, { borderColor: '#3B82F6' + '40', backgroundColor: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.05)' }]}>
                      <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 13, marginBottom: 10 }}>Vista previa del comprobante</Text>
                      <Image source={{ uri: comprobantePreview }} style={styles.comprobanteImg} resizeMode="contain" />
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, width: '100%' }}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
                          onPress={seleccionarComprobante}
                          disabled={subiendoComprobante}
                        >
                          <Ionicons name="image-outline" size={16} color={theme.textSecondary} />
                          <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>Cambiar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, { flex: 1, backgroundColor: '#3B82F6', opacity: subiendoComprobante ? 0.7 : 1 }]}
                          onPress={enviarComprobante}
                          disabled={subiendoComprobante}
                        >
                          {subiendoComprobante
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Ionicons name="send-outline" size={16} color="#fff" />
                          }
                          <Text style={styles.actionBtnText}>
                            {subiendoComprobante ? 'Enviando…' : 'Enviar'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : pago?.comprobante_url ? (
                    <View style={[styles.comprobanteBox, { borderColor: '#10B981' + '40', backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 13 }}>Comprobante enviado</Text>
                      </View>
                      <Image source={{ uri: pago.comprobante_url }} style={styles.comprobanteImg} resizeMode="contain" />
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#10B981' + '20', marginTop: 8 }]}
                        onPress={seleccionarComprobante}
                      >
                        <Ionicons name="refresh-outline" size={16} color="#10B981" />
                        <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Actualizar comprobante</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#3B82F6', marginTop: 12 }]}
                      onPress={seleccionarComprobante}
                    >
                      <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Subir comprobante de pago</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View style={[styles.noMethodBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderColor: theme.border }]}>
                  <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
                  <Text style={[styles.noMethodText, { color: theme.textSecondary }]}>
                    El administrador aún no ha configurado los datos bancarios. Contacta al administrador.
                  </Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* Efectivo / QR */}
        {esEfectivo && (
          <View style={{ gap: 8 }}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              {inquilino?.metodo_pago === 'ambos' ? 'O paga en efectivo' : 'Pago en efectivo'}
            </Text>
            <View style={[styles.qrCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}>
              <View style={[styles.qrSteps, { borderColor: theme.border + '60' }]}>
                <View style={styles.qrStep}>
                  <View style={[styles.qrStepNum, { backgroundColor: theme.primary }]}><Text style={styles.qrStepNumText}>1</Text></View>
                  <Text style={[styles.qrStepText, { color: theme.textSecondary }]}>Genera el código QR</Text>
                </View>
                <View style={styles.qrStep}>
                  <View style={[styles.qrStepNum, { backgroundColor: theme.primary }]}><Text style={styles.qrStepNumText}>2</Text></View>
                  <Text style={[styles.qrStepText, { color: theme.textSecondary }]}>Muéstraselo al administrador</Text>
                </View>
                <View style={styles.qrStep}>
                  <View style={[styles.qrStepNum, { backgroundColor: theme.primary }]}><Text style={styles.qrStepNumText}>3</Text></View>
                  <Text style={[styles.qrStepText, { color: theme.textSecondary }]}>El admin lo escanea y confirma</Text>
                </View>
              </View>
              {qrDataUrl && (
                <View style={styles.qrWrapper}>
                  <Image source={{ uri: qrDataUrl }} style={styles.qrImage} resizeMode="contain" />
                </View>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: theme.primary, opacity: generando ? 0.7 : 1 }]}
                onPress={generarQr}
                disabled={generando}
              >
                {generando
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="qr-code-outline" size={18} color="#fff" />
                }
                <Text style={styles.actionBtnText}>
                  {generando ? 'Generando…' : qrDataUrl ? 'Regenerar QR' : 'Generar QR'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </>
    );
  };

  const renderCuotasCard = () => {
    if (cuotas.length === 0) return null;
    return (
      <View style={[styles.cuotasCard, { backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', borderColor: '#EF4444' + '30' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Ionicons name="warning-outline" size={16} color="#EF4444" />
          <Text style={[styles.cuotasTitle, { color: '#EF4444' }]}>Cargos adicionales este mes</Text>
        </View>
        {cuotas.map(c => (
          <View key={c.id} style={styles.cuotaRow}>
            <Text style={[styles.cuotaConcepto, { color: theme.text }]}>{c.concepto}</Text>
            <Text style={[styles.cuotaMonto, { color: '#EF4444' }]}>+${Number(c.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</Text>
          </View>
        ))}
        <View style={[styles.cuotaSeparator, { backgroundColor: '#EF4444' + '30' }]} />
        <View style={styles.cuotaRow}>
          <Text style={[styles.cuotaTotalLabel, { color: theme.text }]}>Total a pagar</Text>
          <Text style={[styles.cuotaTotal, { color: theme.text }]}>{inquilino ? fmtRenta(parseFloat(inquilino.renta) + totalExtra) : ''}</Text>
        </View>
      </View>
    );
  };

  const renderInfoRow = () => (
    <View style={[styles.infoRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }]}>
      <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
      <Text style={[styles.infoText, { color: theme.textSecondary }]}>
        Fecha de pago: {inquilino?.fecha_pago}
      </Text>
    </View>
  );

  const renderReportBtn = () => (
    <View style={{ gap: 12 }}>
      {inquilino && (
        <TouchableOpacity
          style={[styles.reportBtn, { backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.07)', borderColor: theme.primary + '30' }]}
          onPress={() => router.push('/(inquilino)/pagos' as any)}
        >
          <Ionicons name="receipt-outline" size={18} color={theme.primary} />
          <Text style={[styles.reportBtnText, { color: theme.primary }]}>Ver historial de pagos</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.primary} />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.reportBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: theme.border }]}
        onPress={() => router.push('/(inquilino)/tickets' as any)}
      >
        <Ionicons name="chatbox-ellipses-outline" size={18} color={theme.textSecondary} />
        <Text style={[styles.reportBtnText, { color: theme.textSecondary }]}>Reportar un problema</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={isDark ? ['#0E1321', '#1A1F2E'] : ['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, maxWidth: isWide ? 960 : undefined, alignSelf: isWide ? 'center' : undefined, width: '100%' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: theme.textSecondary }]}>Bienvenido,</Text>
          <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
            {storedUser?.nombre_completo || inquilino?.nombre_completo || 'Inquilino'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <NotificationBell />
          <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
            <Ionicons name="log-out-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 32,
            maxWidth: isWide ? 960 : undefined,
            alignSelf: isWide ? 'center' : undefined,
            width: '100%',
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!inquilino ? (
          /* Not linked yet */
          <View style={[styles.pendingCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}>
            <View style={[styles.pendingIcon, { backgroundColor: theme.warningLight }]}>
              <Ionicons name="time-outline" size={32} color={theme.warning} />
            </View>
            <Text style={[styles.pendingTitle, { color: theme.text }]}>Cuenta pendiente de activación</Text>
            <Text style={[styles.pendingText, { color: theme.textSecondary }]}>
              Tu cuenta está siendo configurada por el administrador. En cuanto sea vinculada a tu departamento, podrás ver tu información de pago aquí.
            </Text>
          </View>
        ) : (
          <>
            {isWide ? (
              /* Grid Layout para Escritorio (Web) */
              <View style={styles.gridContainer}>
                {/* Columna Izquierda: Renta y Métodos de Pago */}
                <View style={styles.gridLeft}>
                  {renderAptoCard()}
                  {renderStatusCard()}
                  {renderMetodosPago()}
                </View>

                {/* Columna Derecha: Cargos Extra, Tickets y Soporte */}
                <View style={styles.gridRight}>
                  {renderCuotasCard()}
                  {renderInfoRow()}
                  {renderReportBtn()}
                </View>
              </View>
            ) : (
              /* Layout de Columna Única Estándar (Móvil) */
              <>
                {renderAptoCard()}
                {renderStatusCard()}
                {renderMetodosPago()}
                {renderCuotasCard()}
                {renderInfoRow()}
                {renderReportBtn()}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16, gap: 12,
  },
  greeting: { fontSize: 13, fontWeight: '600' },
  userName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, gap: 16 },

  pendingCard: {
    borderRadius: 20, padding: 32, alignItems: 'center', gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  pendingIcon: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  pendingTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  pendingText: { fontSize: 14, textAlign: 'center', lineHeight: 22, opacity: 0.8 },

  aptoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  aptoIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  aptoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  aptoNum: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  aptoRenta: { fontSize: 18, fontWeight: '800', marginTop: 2 },

  statusCard: {
    padding: 20, borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  statusMonth: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusLabel: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  statusDate: { fontSize: 12, marginTop: 2 },
  statusAmount: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },

  bankCard: {
    borderRadius: 18, padding: 22, height: 190,
    justifyContent: 'space-between',
    shadowColor: '#1a56c4', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8, overflow: 'hidden',
  },
  chip: {
    width: 40, height: 30, borderRadius: 5,
    backgroundColor: 'rgba(255,200,0,0.8)', justifyContent: 'center', alignItems: 'center',
  },
  chipInner: {
    width: 32, height: 22, borderRadius: 3,
    borderWidth: 1, borderColor: 'rgba(180,140,0,0.6)', backgroundColor: 'rgba(255,210,30,0.5)',
  },
  bankName: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  bankClabe: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  bankTitular: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  bankType: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 2 },

  noMethodBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  noMethodText: { flex: 1, fontSize: 13, lineHeight: 20 },
  qrCard: {
    borderRadius: 18, padding: 24, alignItems: 'center', gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  qrSteps: { width: '100%', gap: 10, borderWidth: 1, borderRadius: 12, padding: 14 },
  qrStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qrStepNum: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  qrStepNumText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  qrStepText: { fontSize: 13, fontWeight: '500', flex: 1 },
  qrWrapper: {
    padding: 14, backgroundColor: '#fff', borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  qrImage: { width: 200, height: 200 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: 16, width: '100%',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  infoText: { fontSize: 13, fontWeight: '500' },

  cuotasCard: { borderRadius: 14, padding: 14, borderWidth: 1 },
  cuotasTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  cuotaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  cuotaConcepto: { fontSize: 13 },
  cuotaMonto: { fontSize: 13, fontWeight: '700' },
  cuotaSeparator: { height: 1, marginVertical: 6 },
  cuotaTotalLabel: { fontSize: 14, fontWeight: '700' },
  cuotaTotal: { fontSize: 16, fontWeight: '900' },

  reportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  reportBtnText: { flex: 1, fontSize: 14, fontWeight: '500' },

  comprobanteBox: { borderRadius: 14, padding: 14, borderWidth: 1, marginTop: 12, alignItems: 'center' },
  comprobanteImg: { width: '100%', height: 180, borderRadius: 10 },

  // Responsive desktop grid styles
  gridContainer: {
    flexDirection: 'row',
    gap: 24,
    width: '100%',
    alignItems: 'flex-start',
  },
  gridLeft: {
    flex: 3,
    gap: 16,
  },
  gridRight: {
    flex: 2,
    gap: 16,
  },
});
