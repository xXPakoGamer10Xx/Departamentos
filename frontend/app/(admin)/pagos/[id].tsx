import {
  StyleSheet, View, Text, TouchableOpacity, useColorScheme,
  ActivityIndicator, useWindowDimensions, Platform, Image,
  ScrollView, Modal, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useSSEEvent } from '../../../hooks/useSSE';
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
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [totalExtra, setTotalExtra] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [marcandoPagado, setMarcandoPagado] = useState(false);
  const [showRechazarModal, setShowRechazarModal] = useState(false);
  const [rechazarComentario, setRechazarComentario] = useState('');

  // Abonos (pagos parciales)
  const [abonos, setAbonos] = useState<any[]>([]);
  const [totalAbonado, setTotalAbonado] = useState(0);
  const [saldoPendiente, setSaldoPendiente] = useState<number | null>(null);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [editingAbonoId, setEditingAbonoId] = useState<string | null>(null);
  const [abonoMonto, setAbonoMonto] = useState('');
  const [abonoFecha, setAbonoFecha] = useState('');
  const [abonoNota, setAbonoNota] = useState('');
  const [savingAbono, setSavingAbono] = useState(false);
  const [abonoError, setAbonoError] = useState('');

  // Historial
  const [historial, setHistorial] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [comprobanteModal, setComprobanteModal] = useState<string | null>(null);

  // Cuota extra modal
  const [showCuota, setShowCuota] = useState(false);
  const [cuotaConcepto, setCuotaConcepto] = useState('');
  const [cuotaMonto, setCuotaMonto] = useState('');
  const [savingCuota, setSavingCuota] = useState(false);
  const [cuotaError, setCuotaError] = useState('');

  const cargar = useCallback((showLoader = false) => {
    if (!id) return;
    if (showLoader) setLoading(true);
    Promise.all([
      api.getInquilinoById(id),
      api.getConfig(),
      api.getEstadoPago(id),
    ]).then(async ([inqRes, cfgRes, estadoRes]) => {
      setInquilino(inqRes.data);
      setConfig(cfgRes.data || {});
      setPago(estadoRes.data || null);
      setCuotas(estadoRes.cuotas || []);
      setTotalExtra(estadoRes.total_extra || 0);
      setTotalAbonado((estadoRes as any).total_abonado || 0);
      setSaldoPendiente((estadoRes as any).saldo_pendiente ?? null);
      if (estadoRes.data?.id) {
        try {
          const abonosRes = await api.getAbonosPago(estadoRes.data.id);
          setAbonos(abonosRes.data || []);
        } catch { setAbonos([]); }
      } else {
        setAbonos([]);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(useCallback(() => { cargar(true); }, [cargar]));

  // Polling en vivo. No recargar con un modal abierto para no pisar lo que se edita.
  useEffect(() => {
    const interval = setInterval(() => {
      if (showRechazarModal || showCuota) return;
      cargar();
    }, 10000);
    return () => clearInterval(interval);
  }, [cargar, showRechazarModal, showCuota]);

  // Refresco inmediato en web cuando el inquilino sube comprobante o paga
  useSSEEvent('comprobante_subido', () => cargar());
  useSSEEvent('payment_confirmed', () => cargar());

  const loadHistorial = useCallback(async () => {
    if (!id || loadingHistorial) return;
    setLoadingHistorial(true);
    try {
      const r = await api.getHistorialPagos(id);
      setHistorial(r.data || []);
      setShowHistorial(true);
    } catch { /* ignore */ }
    finally { setLoadingHistorial(false); }
  }, [id, loadingHistorial]);

  const confirmarDirecto = useCallback(async () => {
    if (!pago) return;
    setConfirmando(true);
    try {
      if (pago.qr_token) {
        await api.confirmarPago(pago.qr_token);
      } else {
        await api.confirmarPagoPorId(pago.id);
      }
      cargar();
    } catch (e) {
      console.error(e);
    } finally {
      setConfirmando(false);
    }
  }, [pago, cargar]);

  const rechazarPago = useCallback(async () => {
    if (!pago) return;
    setRechazando(true);
    try {
      const res = await api.rechazarPagoPorId(pago.id, rechazarComentario.trim());
      setPago(res.data);
      setShowRechazarModal(false);
      setRechazarComentario('');
    } catch (e) {
      console.error(e);
    } finally {
      setRechazando(false);
    }
  }, [pago, rechazarComentario]);

  const addCuota = useCallback(async () => {
    if (!cuotaConcepto.trim()) { setCuotaError('El concepto es requerido'); return; }
    const monto = parseFloat(cuotaMonto);
    if (!monto || monto <= 0) { setCuotaError('Ingresa un monto válido mayor a cero'); return; }
    setSavingCuota(true);
    setCuotaError('');
    try {
      const res = await api.createCuota({ inquilino_id: id!, concepto: cuotaConcepto.trim(), monto });
      setCuotas(prev => [...prev, res.data]);
      setTotalExtra(prev => prev + monto);
      setCuotaConcepto(''); setCuotaMonto('');
      setShowCuota(false);
    } catch (e: any) {
      setCuotaError(e.message || 'No se pudo agregar el cargo');
    } finally {
      setSavingCuota(false);
    }
  }, [id, cuotaConcepto, cuotaMonto]);

  const marcarPagadoManual = useCallback(async () => {
    if (!inquilino) return;
    setMarcandoPagado(true);
    try {
      await api.marcarPagadoAdmin(inquilino.id);
      cargar();
    } catch (e) {
      console.error(e);
    } finally {
      setMarcandoPagado(false);
    }
  }, [inquilino, cargar]);

  const removeCuota = useCallback(async (cuotaId: string, monto: number) => {
    try {
      await api.deleteCuota(cuotaId);
      setCuotas(prev => prev.filter(c => c.id !== cuotaId));
      setTotalExtra(prev => Math.max(0, prev - monto));
    } catch { /* ignore */ }
  }, []);

  const abrirNuevoAbono = useCallback(() => {
    setEditingAbonoId(null);
    setAbonoMonto('');
    setAbonoFecha(new Date().toISOString().slice(0, 10));
    setAbonoNota('');
    setAbonoError('');
    setShowAbonoModal(true);
  }, []);

  const abrirEditarAbono = useCallback((abono: any) => {
    setEditingAbonoId(abono.id);
    setAbonoMonto(String(abono.monto));
    setAbonoFecha(String(abono.fecha).slice(0, 10));
    setAbonoNota(abono.nota || '');
    setAbonoError('');
    setShowAbonoModal(true);
  }, []);

  const guardarAbono = useCallback(async () => {
    const monto = parseFloat(abonoMonto);
    if (!monto || monto <= 0) { setAbonoError('Ingresa un monto válido mayor a cero'); return; }
    if (abonoFecha && !/^\d{4}-\d{2}-\d{2}$/.test(abonoFecha)) {
      setAbonoError('La fecha debe tener el formato AAAA-MM-DD'); return;
    }
    setSavingAbono(true);
    setAbonoError('');
    try {
      if (editingAbonoId) {
        await api.editarAbono(editingAbonoId, { monto, fecha: abonoFecha || undefined, nota: abonoNota.trim() || undefined });
      } else {
        await api.registrarAbono({
          inquilino_id: id!,
          monto,
          fecha: abonoFecha || undefined,
          nota: abonoNota.trim() || undefined,
        });
      }
      setShowAbonoModal(false);
      cargar();
    } catch (e: any) {
      setAbonoError(e.message || 'No se pudo guardar el abono');
    } finally {
      setSavingAbono(false);
    }
  }, [id, editingAbonoId, abonoMonto, abonoFecha, abonoNota, cargar]);

  const eliminarAbono = useCallback(async (abonoId: string) => {
    try {
      await api.eliminarAbono(abonoId);
      cargar();
    } catch { /* ignore */ }
  }, [cargar]);

  const fmtRenta = (n: number) =>
    `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  const getPeriodoLabel = () => {
    const now = new Date();
    return now.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!inquilino) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <LinearGradient colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']} style={StyleSheet.absoluteFill} />
        <Ionicons name="alert-circle-outline" size={48} color={theme.danger} />
        <Text style={{ color: theme.textSecondary, marginTop: 12 }}>Inquilino no encontrado</Text>
      </View>
    );
  }

  const esTransferencia = inquilino.metodo_pago === 'transferencia' || inquilino.metodo_pago === 'ambos';
  const esEfectivo = inquilino.metodo_pago === 'efectivo' || inquilino.metodo_pago === 'ambos';
  const esAmbos = inquilino.metodo_pago === 'ambos';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']} style={StyleSheet.absoluteFill} />

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
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop, { paddingBottom: isDesktop ? 32 : insets.bottom + Theme.layout.dockHeight }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Monto */}
        <View style={[styles.montoCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}>
          <Text style={[styles.montoLabel, { color: theme.textSecondary }]}>{getPeriodoLabel()}</Text>
          <Text style={[styles.montoAmount, { color: theme.text }]}>
            {fmtRenta(parseFloat(String(inquilino.renta)) + totalExtra)}
          </Text>
          {totalExtra > 0 ? (
            <Text style={[styles.montoSub, { color: theme.textSecondary }]}>
              Renta {fmtRenta(inquilino.renta)} + cargos {fmtRenta(totalExtra)} · Depto {inquilino.depto_numero}
            </Text>
          ) : (
            <Text style={[styles.montoSub, { color: theme.textSecondary }]}>Renta mensual · Depto {inquilino.depto_numero}</Text>
          )}

          {pago?.confirmado && (
            <View style={styles.pagadoBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.pagadoText}>Pagado</Text>
            </View>
          )}
          {!pago?.confirmado && totalAbonado > 0 && (
            <View style={[styles.pagadoBadge, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="time" size={16} color="#F59E0B" />
              <Text style={[styles.pagadoText, { color: '#F59E0B' }]}>
                Parcial · Abonado {fmtRenta(totalAbonado)}{saldoPendiente != null ? ` · Falta ${fmtRenta(saldoPendiente)}` : ''}
              </Text>
            </View>
          )}
          {!pago?.confirmado && pago?.rechazado && (
            <View style={[styles.pagadoBadge, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="close-circle" size={16} color="#EF4444" />
              <Text style={[styles.pagadoText, { color: '#EF4444' }]}>Comprobante rechazado</Text>
            </View>
          )}
          {!pago?.confirmado && pago?.rechazado && pago?.comentario_admin && (
            <View style={[styles.rechazoRazon, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)', borderColor: '#EF444430' }]}>
              <Ionicons name="chatbubble-outline" size={13} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontSize: 12, flex: 1 }}>{pago.comentario_admin}</Text>
            </View>
          )}
        </View>

        {/* Botones: registrar abono / marcar pagado manualmente */}
        {!pago?.confirmado && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.confirmBtn, { flex: 1, marginTop: 0, backgroundColor: theme.primary }]}
              onPress={abrirNuevoAbono}
            >
              <Ionicons name="cash-outline" size={20} color="#fff" />
              <Text style={styles.confirmBtnText}>Registrar abono</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { flex: 1, marginTop: 0, backgroundColor: '#34C759', opacity: marcandoPagado ? 0.7 : 1 }]}
              onPress={marcarPagadoManual}
              disabled={marcandoPagado}
            >
              {marcandoPagado
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="checkmark-circle" size={20} color="#fff" />
              }
              <Text style={styles.confirmBtnText}>
                {marcandoPagado ? 'Marcando…' : 'Marcar como pagado'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Historial de abonos de este periodo */}
        {abonos.length > 0 && (
          <View>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Historial de abonos</Text>
            {abonos.map(a => (
              <View key={a.id} style={[styles.cuotaRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }]}>
                <Ionicons name="cash-outline" size={14} color="#34C759" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cuotaConcepto, { color: theme.text }]}>
                    {fmtRenta(a.monto)} · {new Date(a.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                  {(a.nota || a.registrado_por_nombre) && (
                    <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                      {[a.nota, a.registrado_por_nombre ? `por ${a.registrado_por_nombre}` : null].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>
                {!pago?.confirmado && (
                  <>
                    <TouchableOpacity onPress={() => abrirEditarAbono(a)}>
                      <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => eliminarAbono(a.id)}>
                      <Ionicons name="trash-outline" size={16} color={theme.danger} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Cargos extra */}
        {!pago?.confirmado && (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Cargos extra</Text>
              <TouchableOpacity
                style={[styles.addCuotaBtn, { backgroundColor: theme.primary }]}
                onPress={() => { setCuotaConcepto(''); setCuotaMonto(''); setCuotaError(''); setShowCuota(true); }}
              >
                <Ionicons name="add" size={14} color="#fff" />
                <Text style={styles.addCuotaBtnText}>Agregar</Text>
              </TouchableOpacity>
            </View>
            {cuotas.length === 0 ? (
              <Text style={[styles.noCuotas, { color: theme.textSecondary }]}>Sin cargos adicionales este mes</Text>
            ) : (
              cuotas.map(c => (
                <View key={c.id} style={[styles.cuotaRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }]}>
                  <Ionicons name="receipt-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.cuotaConcepto, { color: theme.text }]} numberOfLines={1}>{c.concepto}</Text>
                  <Text style={[styles.cuotaMonto, { color: '#EF4444' }]}>+{fmtRenta(c.monto)}</Text>
                  <TouchableOpacity onPress={() => removeCuota(c.id, parseFloat(c.monto))}>
                    <Ionicons name="trash-outline" size={16} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* Transferencia: tarjeta bancaria */}
        {esTransferencia && (() => {
          const bankInfo = detectBankInfo(config.banco_clabe || '');
          return (
          <View>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Datos para transferencia</Text>
            <LinearGradient
              colors={['#1a56c4', '#0a3d8a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bankCard}
            >
              <View style={styles.chip}>
                <View style={styles.chipInner} />
              </View>
              <View style={styles.bankCardBody}>
                <Text style={styles.bankName}>{config.banco_nombre || 'BANCO'}</Text>
                <Text style={styles.bankClabe}>{bankInfo.formato}</Text>
                <Text style={styles.bankTitular}>{config.banco_titular || 'Titular no configurado'}</Text>
              </View>
              <View style={styles.bankCardFooter}>
                <Ionicons name="card" size={28} color="rgba(255,255,255,0.4)" />
                <Text style={styles.bankCardType}>{bankInfo.tipo}</Text>
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

            {/* Comprobante del inquilino */}
            {pago?.comprobante_url && (
              <View style={[styles.comprobanteCard, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.06)', borderColor: '#6366F140' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Ionicons name="document-attach" size={16} color="#6366F1" />
                  <Text style={{ color: '#6366F1', fontWeight: '700', fontSize: 13 }}>
                    Comprobante enviado por inquilino
                  </Text>
                  {pago.comprobante_subido_en && (
                    <Text style={{ color: theme.textSecondary, fontSize: 11, marginLeft: 'auto' }}>
                      {new Date(pago.comprobante_subido_en).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
                <Image source={{ uri: pago.comprobante_url }} style={styles.comprobanteImg} resizeMode="contain" />
              </View>
            )}

            {!pago?.confirmado && !pago?.rechazado && (
              <View style={{ gap: 10, marginTop: 4 }}>
                {/* Botones de Confirmar y Rechazar cuando hay comprobante */}
                {pago?.comprobante_url ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.confirmBtn, { flex: 1, marginTop: 0, backgroundColor: isDark ? 'rgba(239,68,68,0.85)' : '#EF4444', opacity: confirmando || rechazando ? 0.6 : 1 }]}
                      onPress={() => { setRechazarComentario(''); setShowRechazarModal(true); }}
                      disabled={confirmando || rechazando}
                    >
                      <Ionicons name="close-circle-outline" size={20} color="#fff" />
                      <Text style={styles.confirmBtnText}>Rechazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.confirmBtn, { flex: 2, marginTop: 0, backgroundColor: '#34C759', opacity: confirmando || rechazando ? 0.7 : 1 }]}
                      onPress={confirmarDirecto}
                      disabled={confirmando || rechazando}
                    >
                      {confirmando
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                      }
                      <Text style={styles.confirmBtnText}>
                        {confirmando ? 'Confirmando…' : 'Confirmar pago'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: isDark ? 'rgba(52,199,89,0.3)' : '#34C75960', opacity: confirmando ? 0.7 : 1 }]}
                    onPress={confirmarDirecto}
                    disabled={confirmando}
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
              </View>
            )}
            {/* Comprobante rechazado — esperando nuevo envío del inquilino */}
            {!pago?.confirmado && pago?.rechazado && pago?.comprobante_url && (
              <View style={[styles.comprobanteCard, { backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', borderColor: '#EF444430', opacity: 0.8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Ionicons name="close-circle" size={14} color="#EF4444" />
                  <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12 }}>Comprobante rechazado — esperando reenvío</Text>
                </View>
                <Image source={{ uri: pago.comprobante_url }} style={[styles.comprobanteImg, { opacity: 0.6 }]} resizeMode="contain" />
              </View>
            )}

          </View>
          );
        })()}

        {/* Efectivo: QR */}
        {esEfectivo && (
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
                    {pago?.qr_token
                      ? 'El inquilino ya generó su QR. Escanéalo desde la pestaña Escanear para aceptar el pago en efectivo.'
                      : 'El inquilino genera su QR desde su app. Cuando lo tenga, escanéalo desde la pestaña Escanear para aceptar el pago en efectivo.'}
                  </Text>

                  <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
                    onPress={() => router.push('/(admin)/scan' as any)}
                  >
                    <Ionicons name="qr-code-outline" size={20} color="#fff" />
                    <Text style={styles.confirmBtnText}>Ir a Escanear</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: isDark ? 'rgba(52,199,89,0.3)' : '#34C75960', opacity: confirmando ? 0.7 : 1, marginTop: 10 }]}
                    onPress={confirmarDirecto}
                    disabled={confirmando}
                  >
                    {confirmando
                      ? <ActivityIndicator color={isDark ? '#34C759' : '#15803D'} size="small" />
                      : <Ionicons name="checkmark-circle-outline" size={20} color={isDark ? '#34C759' : '#15803D'} />
                    }
                    <Text style={[styles.confirmBtnText, { color: isDark ? '#34C759' : '#15803D' }]}>
                      {confirmando ? 'Confirmando…' : 'Marcar como pagado (Manual)'}
                    </Text>
                  </TouchableOpacity>

                  {!pago?.qr_token && (
                    <View style={[styles.qrPendiente, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                      <Ionicons name="time-outline" size={32} color={theme.textSecondary} />
                      <Text style={[styles.qrPendienteText, { color: theme.textSecondary }]}>
                        El inquilino aún no genera su QR este período
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        )}
        {/* ── Historial de pagos ── */}
        <View>
          <TouchableOpacity
            style={[styles.historialToggle, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: theme.border }]}
            onPress={() => showHistorial ? setShowHistorial(false) : loadHistorial()}
          >
            <Ionicons name="receipt-outline" size={18} color={theme.primary} />
            <Text style={[styles.historialToggleText, { color: theme.primary }]}>
              {showHistorial ? 'Ocultar historial de pagos' : 'Ver historial de pagos'}
            </Text>
            {loadingHistorial
              ? <ActivityIndicator size="small" color={theme.primary} style={{ marginLeft: 'auto' }} />
              : <Ionicons name={showHistorial ? 'chevron-up' : 'chevron-down'} size={16} color={theme.primary} style={{ marginLeft: 'auto' }} />
            }
          </TouchableOpacity>

          {showHistorial && historial.length > 0 && (
            <View style={{ gap: 10, marginTop: 12 }}>
              {historial.map(p => {
                const aTiempo = p.a_tiempo;
                const confirmado = p.confirmado;
                let badgeColor = '#6B7280';
                let badgeLabel = 'Pendiente';
                let badgeIcon = 'ellipse-outline';
                if (confirmado && aTiempo === true) {
                  badgeColor = '#10B981'; badgeLabel = 'A tiempo'; badgeIcon = 'checkmark-circle';
                } else if (confirmado && aTiempo === false) {
                  badgeColor = '#F59E0B'; badgeLabel = 'Con retraso'; badgeIcon = 'warning';
                } else if (confirmado) {
                  badgeColor = '#10B981'; badgeLabel = 'Confirmado'; badgeIcon = 'checkmark-circle';
                }
                return (
                  <View
                    key={p.id}
                    style={[styles.histCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderColor: badgeColor + '30' }]}
                  >
                    <View style={[styles.histCardBar, { backgroundColor: badgeColor }]} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.histPeriodo, { color: theme.text }]}>
                          {(() => {
                            const [a, m] = p.periodo.split('-');
                            return new Date(parseInt(a), parseInt(m) - 1, 1)
                              .toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
                              .toUpperCase();
                          })()}
                        </Text>
                        <View style={[styles.histBadge, { backgroundColor: badgeColor + '20' }]}>
                          <Ionicons name={badgeIcon as any} size={11} color={badgeColor} />
                          <Text style={[styles.histBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
                        </View>
                      </View>
                      <Text style={[styles.histMonto, { color: theme.text }]}>
                        {fmtRenta(parseFloat(p.monto))}
                      </Text>
                      {confirmado && p.confirmado_en && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="calendar-outline" size={12} color={theme.textSecondary} />
                          <Text style={[styles.histFecha, { color: theme.textSecondary }]}>
                            {new Date(p.confirmado_en).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          <Text style={[styles.histMetodo, { color: theme.textSecondary }]}>
                            · {p.metodo === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                          </Text>
                        </View>
                      )}
                      {p.escaneado_por_nombre && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="qr-code-outline" size={12} color={theme.textSecondary} />
                          <Text style={[styles.histFecha, { color: theme.textSecondary }]}>
                            Escaneado por {p.escaneado_por_nombre}
                          </Text>
                        </View>
                      )}
                      {p.comprobante_url && (
                        <TouchableOpacity
                          style={[styles.verComprobanteBtn, { borderColor: theme.primary + '40', backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.07)' }]}
                          onPress={() => setComprobanteModal(p.comprobante_url)}
                        >
                          <Ionicons name="document-attach-outline" size={13} color={theme.primary} />
                          <Text style={[styles.verComprobanteBtnText, { color: theme.primary }]}>Ver comprobante</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {showHistorial && historial.length === 0 && (
            <View style={[styles.histEmpty, { borderColor: theme.border }]}>
              <Ionicons name="receipt-outline" size={28} color={theme.textSecondary} />
              <Text style={[styles.histEmptyText, { color: theme.textSecondary }]}>Sin pagos registrados</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal rechazar pago */}
      <Modal visible={showRechazarModal} transparent animationType="fade" onRequestClose={() => setShowRechazarModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDark ? '#1E2235' : '#fff' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EF444420', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 0 }]}>Rechazar comprobante</Text>
            </View>
            <Text style={[{ color: theme.textSecondary, fontSize: 13, marginBottom: 16 }]}>
              El inquilino será notificado y podrá enviar un nuevo comprobante.
            </Text>
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Motivo del rechazo (opcional)</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]}
              value={rechazarComentario}
              onChangeText={setRechazarComentario}
              placeholder="Ej: El comprobante no es legible, el monto no coincide..."
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={300}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                onPress={() => setShowRechazarModal(false)}
                disabled={rechazando}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#EF4444', opacity: rechazando ? 0.7 : 1 }]}
                onPress={rechazarPago}
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

      {/* Modal comprobante */}
      <Modal visible={!!comprobanteModal} transparent animationType="fade" onRequestClose={() => setComprobanteModal(null)}>
        <View style={styles.comprobanteOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setComprobanteModal(null)} />
          <View style={[styles.comprobanteModalBox, { backgroundColor: isDark ? '#1E2235' : '#fff' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.comprobanteModalTitle, { color: theme.text }]}>Comprobante de pago</Text>
              <TouchableOpacity onPress={() => setComprobanteModal(null)}>
                <Ionicons name="close-circle" size={26} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            {comprobanteModal && (
              <Image source={{ uri: comprobanteModal }} style={styles.comprobanteFullImg} resizeMode="contain" />
            )}
          </View>
        </View>
      </Modal>

      {/* Modal agregar cuota */}
      <Modal visible={showCuota} transparent animationType="fade" onRequestClose={() => setShowCuota(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDark ? '#1E2235' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Agregar cargo extra</Text>
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Concepto</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: cuotaError ? theme.danger : theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
              value={cuotaConcepto}
              onChangeText={t => { setCuotaConcepto(t); setCuotaError(''); }}
              placeholder="Ej: Foco fundido, Daño en puerta..."
              placeholderTextColor={theme.textSecondary}
              autoFocus
              maxLength={200}
            />
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Monto ($)</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: cuotaError ? theme.danger : theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
              value={cuotaMonto}
              onChangeText={t => { setCuotaMonto(t.replace(/[^0-9.]/g, '')); setCuotaError(''); }}
              placeholder="100.00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />
            {cuotaError ? (
              <Text style={[styles.cuotaErr, { color: theme.danger }]}>{cuotaError}</Text>
            ) : null}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalCancelBtn, { borderColor: theme.border }]} onPress={() => setShowCuota(false)} disabled={savingCuota}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: theme.primary, opacity: savingCuota ? 0.7 : 1 }]} onPress={addCuota} disabled={savingCuota}>
                {savingCuota ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Agregar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Modal registrar/editar abono */}
      <Modal visible={showAbonoModal} transparent animationType="fade" onRequestClose={() => setShowAbonoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDark ? '#1E2235' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {editingAbonoId ? 'Editar abono' : 'Registrar abono'}
            </Text>
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Monto ($)</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: abonoError ? theme.danger : theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
              value={abonoMonto}
              onChangeText={t => { setAbonoMonto(t.replace(/[^0-9.]/g, '')); setAbonoError(''); }}
              placeholder="500.00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Fecha (AAAA-MM-DD)</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: abonoError ? theme.danger : theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
              value={abonoFecha}
              onChangeText={t => { setAbonoFecha(t); setAbonoError(''); }}
              placeholder="2026-08-16"
              placeholderTextColor={theme.textSecondary}
              maxLength={10}
            />
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Nota (opcional)</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
              value={abonoNota}
              onChangeText={setAbonoNota}
              placeholder="Ej: Pago en efectivo, adelanto..."
              placeholderTextColor={theme.textSecondary}
              maxLength={200}
            />
            {abonoError ? (
              <Text style={[styles.cuotaErr, { color: theme.danger }]}>{abonoError}</Text>
            ) : null}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalCancelBtn, { borderColor: theme.border }]} onPress={() => setShowAbonoModal(false)} disabled={savingAbono}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: theme.primary, opacity: savingAbono ? 0.7 : 1 }]} onPress={guardarAbono} disabled={savingAbono}>
                {savingAbono ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function detectBankInfo(numero: string): { tipo: string; formato: string } {
  if (!numero) return { tipo: 'CLABE', formato: '•••• •••• •••• ••••' };
  const c = numero.replace(/\D/g, '');
  if (c.length === 18) return { tipo: 'CLABE', formato: `${c.slice(0, 4)} ${c.slice(4, 8)} ${c.slice(8, 12)} ${c.slice(12, 16)} ${c.slice(16)}` };
  if (c.length === 16) return { tipo: 'No. de tarjeta', formato: `${c.slice(0, 4)} ${c.slice(4, 8)} ${c.slice(8, 12)} ${c.slice(12)}` };
  if (c.length >= 10) return { tipo: 'No. de cuenta', formato: c };
  return { tipo: 'Cuenta', formato: numero };
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
  rechazoRazon: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },

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
  qrWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: 10, borderRadius: 10, borderWidth: 1 },
  qrWarningText: { flex: 1, fontSize: 12, color: '#F59E0B', lineHeight: 17 },
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
  qrPendiente: { alignItems: 'center', gap: 8, paddingVertical: 20, borderRadius: 12, marginTop: 12 },
  qrPendienteText: { fontSize: 14, textAlign: 'center' },

  comprobanteCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginTop: 12 },
  comprobanteImg: { width: '100%', height: 200, borderRadius: 10 },

  // Historial
  historialToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  historialToggleText: { fontSize: 14, fontWeight: '700' },
  histCard: {
    flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden',
    paddingRight: 14, paddingVertical: 12,
  },
  histCardBar: { width: 4, marginRight: 12, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  histPeriodo: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, flex: 1 },
  histBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  histBadgeText: { fontSize: 10, fontWeight: '700' },
  histMonto: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  histFecha: { fontSize: 11 },
  histMetodo: { fontSize: 11 },
  verComprobanteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start',
  },
  verComprobanteBtnText: { fontSize: 11, fontWeight: '700' },
  histEmpty: { alignItems: 'center', gap: 8, padding: 24, borderRadius: 14, borderWidth: 1, marginTop: 10 },
  histEmptyText: { fontSize: 13 },

  // Modal comprobante
  comprobanteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  comprobanteModalBox: { borderRadius: 20, padding: 20 },
  comprobanteModalTitle: { fontSize: 16, fontWeight: '800' },
  comprobanteFullImg: { width: '100%', height: 380, borderRadius: 12 },

  addCuotaBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  addCuotaBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  noCuotas: { fontSize: 13, fontStyle: 'italic', paddingBottom: 4 },
  cuotaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  cuotaConcepto: { flex: 1, fontSize: 13 },
  cuotaMonto: { fontSize: 13, fontWeight: '700' },
  // Modal cuota
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 },
  modalBox: { width: '100%', maxWidth: 400, borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 17, fontWeight: '800', marginBottom: 16 },
  modalLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  modalInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 12 },
  cuotaErr: { fontSize: 12, marginBottom: 8 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn: { flex: 1, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  modalConfirmBtn: { flex: 1, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },

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
