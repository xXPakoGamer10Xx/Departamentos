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
import { useEffect, useState, useCallback, useRef } from 'react';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSSEEvent } from '../../../hooks/useSSE';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import api from '../../../services/api';
import { buildReciboHtml } from '../../../utils/recibo';

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
  const [showCargosExtra, setShowCargosExtra] = useState(false);
  const [comprobanteModal, setComprobanteModal] = useState<string | null>(null);

  // Cuota extra modal
  const [showCuota, setShowCuota] = useState(false);
  const [cuotaConcepto, setCuotaConcepto] = useState('');
  const [cuotaMonto, setCuotaMonto] = useState('');
  const [savingCuota, setSavingCuota] = useState(false);
  const [cuotaError, setCuotaError] = useState('');

  // Promesa de pago (separada en Día, Mes, Año)
  const [promesaDia, setPromesaDia] = useState('');
  const [promesaMes, setPromesaMes] = useState('');
  const [promesaAno, setPromesaAno] = useState('');
  const [savingPromesa, setSavingPromesa] = useState(false);
  const [promesaError, setPromesaError] = useState('');
  const [promesaGuardada, setPromesaGuardada] = useState(false);
  const [showMobileDatePicker, setShowMobileDatePicker] = useState(false);
  const [editandoPromesa, setEditandoPromesa] = useState(false);

  const diaRef = useRef<any>(null);
  const mesRef = useRef<any>(null);
  const webDatePickerRef = useRef<any>(null);

  // Depósito (separado de la renta)
  const [depositoSaldo, setDepositoSaldo] = useState<{ deposito_total: number; deposito_pagado: number; deposito_saldo: number } | null>(null);
  const [depositoAbonos, setDepositoAbonos] = useState<any[]>([]);
  const [showDepositoModal, setShowDepositoModal] = useState(false);
  const [editingDepositoAbonoId, setEditingDepositoAbonoId] = useState<string | null>(null);
  const [depositoMonto, setDepositoMonto] = useState('');
  const [depositoFecha, setDepositoFecha] = useState('');
  const [depositoNota, setDepositoNota] = useState('');
  const [savingDeposito, setSavingDeposito] = useState(false);
  const [depositoError, setDepositoError] = useState('');
  const [showDeposito, setShowDeposito] = useState(false);

  const getFechaLocalISO = () => {
    const d = new Date();
    const offsetMs = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
  };

  const formatToDDMMAAAA = (isoDate?: any): string => {
    if (!isoDate) return '';
    const str = typeof isoDate === 'string' ? isoDate.trim() : new Date(isoDate).toISOString().slice(0, 10);
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return str;
  };

  const getIsoFromParts = (d: string, m: string, y: string): string | null => {
    if (!d && !m && !y) return null;
    if (!d || !m || !y || y.length < 4) return null;
    const dayNum = parseInt(d, 10);
    const monthNum = parseInt(m, 10);
    const yearNum = parseInt(y, 10);
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31 || yearNum < 1900 || yearNum > 2100) return null;
    const dt = new Date(yearNum, monthNum - 1, dayNum);
    if (dt.getFullYear() !== yearNum || dt.getMonth() !== monthNum - 1 || dt.getDate() !== dayNum) return null;
    return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
  };

  // El año no se pide en el formulario: se infiere solo. Si el día/mes ya pasó
  // este año, se asume que la promesa es para el año siguiente.
  const inferAno = (dia: string, mes: string): string => {
    const dayNum = parseInt(dia, 10);
    const monthNum = parseInt(mes, 10);
    const now = new Date();
    const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const candidato = new Date(now.getFullYear(), monthNum - 1, dayNum);
    return String(candidato < hoy ? now.getFullYear() + 1 : now.getFullYear());
  };

  const getPromesaPreview = () => {
    const iso = getIsoFromParts(promesaDia, promesaMes, promesaAno);
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    dt.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dt.getTime() - hoy.getTime()) / 86400000);

    const raw = dt.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const cap = raw.charAt(0).toUpperCase() + raw.slice(1);

    let badge = '';
    if (diffDays === 0) badge = ' · Hoy';
    else if (diffDays === 1) badge = ' · Mañana';
    else if (diffDays === -1) badge = ' · Ayer';
    else if (diffDays > 1) badge = ` · en ${diffDays} días`;
    else if (diffDays < -1) badge = ` · hace ${Math.abs(diffDays)} días`;

    return `${cap}${badge}`;
  };

  const cargar = useCallback((showLoader = false) => {
    if (!id) return;
    if (showLoader) setLoading(true);
    Promise.all([
      api.getInquilinoById(id),
      api.getConfig(),
      api.getEstadoPago(id),
      api.getSaldoDeposito(id),
      api.getAbonosDeposito(id),
    ]).then(async ([inqRes, cfgRes, estadoRes, depSaldoRes, depAbonosRes]) => {
      setInquilino(inqRes.data);
      setConfig(cfgRes.data || {});
      setPago(estadoRes.data || null);
      setCuotas(estadoRes.cuotas || []);
      setTotalExtra(estadoRes.total_extra || 0);
      setTotalAbonado((estadoRes as any).total_abonado || 0);
      setSaldoPendiente((estadoRes as any).saldo_pendiente ?? null);
      if (estadoRes.data?.fecha_promesa) {
        const match = String(estadoRes.data.fecha_promesa).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          setPromesaDia(match[3]);
          setPromesaMes(match[2]);
          setPromesaAno(match[1]);
        } else {
          setPromesaDia('');
          setPromesaMes('');
          setPromesaAno('');
        }
      } else {
        setPromesaDia('');
        setPromesaMes('');
        setPromesaAno('');
      }
      setEditandoPromesa(!estadoRes.data?.fecha_promesa);
      setPromesaError('');
      setDepositoSaldo(depSaldoRes.data || null);
      setDepositoAbonos(depAbonosRes.data || []);
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
      await api.createCuota({ inquilino_id: id!, concepto: cuotaConcepto.trim(), monto });
      setCuotaConcepto(''); setCuotaMonto('');
      setShowCuota(false);
      cargar();
    } catch (e: any) {
      setCuotaError(e.message || 'No se pudo agregar el cargo');
    } finally {
      setSavingCuota(false);
    }
  }, [id, cuotaConcepto, cuotaMonto, cargar]);

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

  const removeCuota = useCallback(async (cuotaId: string) => {
    try {
      await api.deleteCuota(cuotaId);
      cargar();
    } catch { /* ignore */ }
  }, [cargar]);

  const abrirNuevoAbono = useCallback(() => {
    setEditingAbonoId(null);
    setAbonoMonto('');
    setAbonoFecha(getFechaLocalISO());
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

  const handleDiaChange = (text: string) => {
    setPromesaError('');
    setPromesaGuardada(false);
    const clean = text.trim();
    const dmy = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      setPromesaDia(dmy[1].padStart(2, '0'));
      setPromesaMes(dmy[2].padStart(2, '0'));
      setPromesaAno(dmy[3]);
      mesRef.current?.blur();
      return;
    }
    const ymd = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      setPromesaDia(ymd[3]);
      setPromesaMes(ymd[2]);
      setPromesaAno(ymd[1]);
      mesRef.current?.blur();
      return;
    }

    const digits = text.replace(/\D/g, '').slice(0, 2);
    setPromesaDia(digits);
    if (digits.length === 2 && promesaMes.length === 2) setPromesaAno(inferAno(digits, promesaMes));

    if (digits.length === 2) {
      mesRef.current?.focus();
    } else if (digits.length === 1 && parseInt(digits, 10) > 3) {
      setPromesaDia(`0${digits}`);
      mesRef.current?.focus();
    }
  };

  const handleMesChange = (text: string) => {
    setPromesaError('');
    setPromesaGuardada(false);
    const clean = text.trim();
    const dmy = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      setPromesaDia(dmy[1].padStart(2, '0'));
      setPromesaMes(dmy[2].padStart(2, '0'));
      setPromesaAno(dmy[3]);
      return;
    }

    const digits = text.replace(/\D/g, '').slice(0, 2);
    setPromesaMes(digits);
    if (digits.length === 2 && promesaDia.length === 2) setPromesaAno(inferAno(promesaDia, digits));
    else if (digits.length === 1 && parseInt(digits, 10) > 1) {
      setPromesaMes(`0${digits}`);
      if (promesaDia.length === 2) setPromesaAno(inferAno(promesaDia, `0${digits}`));
    }
  };

  const setFechaRapida = (diasDesdeHoy: number) => {
    const target = new Date();
    target.setDate(target.getDate() + diasDesdeHoy);
    const dd = String(target.getDate()).padStart(2, '0');
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const yyyy = String(target.getFullYear());
    setPromesaDia(dd);
    setPromesaMes(mm);
    setPromesaAno(yyyy);
    setPromesaError('');
    setPromesaGuardada(false);
  };

  const abrirSelectorFecha = () => {
    if (Platform.OS === 'web') {
      if (webDatePickerRef.current?.showPicker) {
        try {
          webDatePickerRef.current.showPicker();
        } catch {
          webDatePickerRef.current?.click();
        }
      } else {
        webDatePickerRef.current?.click();
      }
    } else {
      setShowMobileDatePicker(true);
    }
  };

  const guardarPromesa = useCallback(async () => {
    if (!pago?.id) return;
    const d = promesaDia.trim();
    const m = promesaMes.trim();
    const y = promesaAno.trim();

    if (!d && !m && !y) {
      setSavingPromesa(true);
      setPromesaError('');
      try {
        await api.setPromesaPago(pago.id, null);
        cargar();
        setPromesaGuardada(true);
        setTimeout(() => setPromesaGuardada(false), 2500);
      } catch (e: any) {
        setPromesaError(e.message || 'No se pudo borrar la fecha');
      } finally {
        setSavingPromesa(false);
      }
      return;
    }

    const iso = getIsoFromParts(d, m, y);
    if (!iso) {
      setPromesaError('Ingresa una fecha válida: Día (01-31) y Mes (01-12)');
      return;
    }

    setSavingPromesa(true);
    setPromesaError('');
    try {
      await api.setPromesaPago(pago.id, iso);
      cargar();
      setPromesaGuardada(true);
      setEditandoPromesa(false);
      setTimeout(() => setPromesaGuardada(false), 2500);
    } catch (e: any) {
      setPromesaError(e.message || 'No se pudo guardar la fecha');
    } finally {
      setSavingPromesa(false);
    }
  }, [pago, promesaDia, promesaMes, promesaAno, cargar]);

  const abrirNuevoDeposito = useCallback(() => {
    setEditingDepositoAbonoId(null);
    setDepositoMonto('');
    setDepositoFecha(getFechaLocalISO());
    setDepositoNota('');
    setDepositoError('');
    setShowDepositoModal(true);
  }, []);

  const abrirEditarDeposito = useCallback((abono: any) => {
    setEditingDepositoAbonoId(abono.id);
    setDepositoMonto(String(abono.monto));
    setDepositoFecha(String(abono.fecha).slice(0, 10));
    setDepositoNota(abono.nota || '');
    setDepositoError('');
    setShowDepositoModal(true);
  }, []);

  const guardarDeposito = useCallback(async () => {
    const monto = parseFloat(depositoMonto);
    if (!monto || monto <= 0) { setDepositoError('Ingresa un monto válido mayor a cero'); return; }
    if (depositoFecha && !/^\d{4}-\d{2}-\d{2}$/.test(depositoFecha)) {
      setDepositoError('La fecha debe tener el formato AAAA-MM-DD'); return;
    }
    setSavingDeposito(true);
    setDepositoError('');
    try {
      if (editingDepositoAbonoId) {
        await api.editarAbonoDeposito(editingDepositoAbonoId, { monto, fecha: depositoFecha || undefined, nota: depositoNota.trim() || undefined });
      } else {
        await api.registrarAbonoDeposito({
          inquilino_id: id!,
          monto,
          fecha: depositoFecha || undefined,
          nota: depositoNota.trim() || undefined,
        });
      }
      setShowDepositoModal(false);
      cargar();
    } catch (e: any) {
      setDepositoError(e.message || 'No se pudo guardar el abono');
    } finally {
      setSavingDeposito(false);
    }
  }, [id, editingDepositoAbonoId, depositoMonto, depositoFecha, depositoNota, cargar]);

  const eliminarDeposito = useCallback(async (abonoId: string) => {
    try {
      await api.eliminarAbonoDeposito(abonoId);
      cargar();
    } catch { /* ignore */ }
  }, [cargar]);

  const fmtRenta = (n: number) =>
    `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  const getPeriodoLabel = () => {
    const now = new Date();
    return now.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  const handleImprimirRecibo = useCallback(() => {
    if (!inquilino) return;
    const rentaBase = parseFloat(String(inquilino.renta)) || 0;
    const saldoRenta = pago?.confirmado
      ? 0
      : pago
        ? (saldoPendiente ?? 0)
        : rentaBase + totalExtra;

    const html = buildReciboHtml({
      arrendadorNombre: config.arrendador_nombre || 'Administración',
      nombreInquilino: inquilino.nombre_completo,
      deptoNumero: inquilino.depto_numero,
      periodoLabel: getPeriodoLabel(),
      renta: rentaBase,
      cargosExtra: cuotas.map((c: any) => ({ concepto: c.concepto, monto: parseFloat(c.monto) || 0 })),
      abonosRenta: abonos.map((a: any) => ({ monto: parseFloat(a.monto) || 0, fecha: a.fecha })),
      saldoRentaPendiente: saldoRenta,
      depositoPendiente: depositoSaldo?.deposito_saldo || 0,
    });

    if (Platform.OS === 'web') {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) { URL.revokeObjectURL(url); return; }
      setTimeout(() => {
        win.print();
        URL.revokeObjectURL(url);
      }, 300);
    } else {
      Print.printAsync({ html }).catch(() => {});
    }
  }, [inquilino, config, cuotas, abonos, pago, saldoPendiente, totalExtra, depositoSaldo]);

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
  const usaQrInquilinos = config.usa_qr_inquilinos !== 'false';
  const hayAbonoParcial = !pago?.confirmado && totalAbonado > 0 && saldoPendiente != null;

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
        <TouchableOpacity onPress={handleImprimirRecibo} style={styles.backBtn} accessibilityLabel="Imprimir recibo">
          <Ionicons name="print-outline" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop, { paddingBottom: isDesktop ? 32 : insets.bottom + Theme.layout.dockHeight }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Monto */}
        <View style={[styles.montoCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}>
          {hayAbonoParcial ? (
            <>
              <Text style={[styles.montoLabel, { color: theme.textSecondary }]}>FALTA POR PAGAR</Text>
              <Text style={[styles.montoAmount, { color: '#F59E0B' }]}>
                {fmtRenta(saldoPendiente!)}
              </Text>
              <Text style={[styles.montoSub, { color: theme.textSecondary }]}>
                Total del mes {fmtRenta(parseFloat(String(inquilino.renta)) + totalExtra)} · Abonado {fmtRenta(totalAbonado)}
              </Text>
            </>
          ) : (
            <>
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
            </>
          )}

          {pago?.confirmado && (
            <View style={styles.pagadoBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.pagadoText}>Pagado</Text>
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

        {/* Promesa de pago */}
        {!pago?.confirmado && pago?.id && (
          <View style={[styles.promesaCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: theme.border }]}>
            {!editandoPromesa ? (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                onPress={() => setEditandoPromesa(true)}
              >
                <Ionicons name="calendar" size={16} color={theme.primary} />
                <Text style={{ flex: 1, color: theme.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                  Prometió pagar: {getPromesaPreview()}
                </Text>
                <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="calendar-outline" size={16} color={theme.primary} />
                    <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginBottom: 0 }]}>¿Cuándo dijo que paga?</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.calendarioBtn, { borderColor: theme.primary + '50', backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)' }]}
                    onPress={abrirSelectorFecha}
                  >
                    <Ionicons name="calendar" size={13} color={theme.primary} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.primary }}>Abrir calendario</Text>
                  </TouchableOpacity>
                </View>

                {/* Input oculto para abrir el selector nativo del navegador en Web */}
                {Platform.OS === 'web' && (
                  <input
                    ref={webDatePickerRef}
                    type="date"
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                    value={getIsoFromParts(promesaDia, promesaMes, promesaAno) || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m, d] = e.target.value.split('-');
                        setPromesaDia(d);
                        setPromesaMes(m);
                        setPromesaAno(y);
                        setPromesaError('');
                      }
                    }}
                  />
                )}

                {/* Selector nativo móvil */}
                {showMobileDatePicker && (
                  <DateTimePicker
                    value={
                      getIsoFromParts(promesaDia, promesaMes, promesaAno)
                        ? new Date(`${getIsoFromParts(promesaDia, promesaMes, promesaAno)}T12:00:00`)
                        : new Date()
                    }
                    mode="date"
                    display="default"
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      setShowMobileDatePicker(false);
                      if (event.type === 'set' && date) {
                        setPromesaDia(String(date.getDate()).padStart(2, '0'));
                        setPromesaMes(String(date.getMonth() + 1).padStart(2, '0'));
                        setPromesaAno(String(date.getFullYear()));
                        setPromesaError('');
                      }
                    }}
                  />
                )}

                {/* Campos separados: Día / Mes (el año se infiere solo) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  {/* Día */}
                  <View style={[styles.dateSegmentBox, { flex: 0.7, borderColor: promesaError && !promesaDia ? theme.danger : theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}>
                    <Text style={[styles.dateSegmentLabel, { color: theme.textSecondary }]}>DÍA</Text>
                    <TextInput
                      ref={diaRef}
                      style={[styles.dateSegmentInput, { color: theme.text }]}
                      value={promesaDia}
                      onChangeText={handleDiaChange}
                      placeholder="DD"
                      placeholderTextColor={theme.textSecondary + '70'}
                      maxLength={10}
                      keyboardType="numeric"
                      textAlign="center"
                      selectTextOnFocus
                    />
                  </View>

                  <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textSecondary }}>/</Text>

                  {/* Mes */}
                  <View style={[styles.dateSegmentBox, { flex: 0.7, borderColor: promesaError && !promesaMes ? theme.danger : theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}>
                    <Text style={[styles.dateSegmentLabel, { color: theme.textSecondary }]}>MES</Text>
                    <TextInput
                      ref={mesRef}
                      style={[styles.dateSegmentInput, { color: theme.text }]}
                      value={promesaMes}
                      onChangeText={handleMesChange}
                      onKeyPress={(e) => {
                        if (e.nativeEvent.key === 'Backspace' && !promesaMes) diaRef.current?.focus();
                      }}
                      placeholder="MM"
                      placeholderTextColor={theme.textSecondary + '70'}
                      maxLength={10}
                      keyboardType="numeric"
                      textAlign="center"
                      selectTextOnFocus
                    />
                  </View>

                  {/* Botón Guardar */}
                  <TouchableOpacity
                    style={[styles.promesaSaveBtn, { backgroundColor: promesaGuardada ? theme.success ?? '#22C55E' : theme.primary, opacity: savingPromesa ? 0.7 : 1, flex: 1 }]}
                    onPress={guardarPromesa}
                    disabled={savingPromesa}
                  >
                    {savingPromesa ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name={promesaGuardada ? 'checkmark-done' : 'checkmark'} size={16} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{promesaGuardada ? 'Guardado' : 'Guardar'}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Botón Limpiar si hay fecha */}
                  {(!!promesaDia || !!promesaMes || !!promesaAno) && (
                    <TouchableOpacity
                      style={[styles.promesaClearBtn, { borderColor: theme.border }]}
                      onPress={() => {
                        setPromesaDia('');
                        setPromesaMes('');
                        setPromesaAno('');
                        setPromesaError('');
                        setPromesaGuardada(false);
                      }}
                      accessibilityLabel="Limpiar fecha"
                    >
                      <Ionicons name="close" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Accesos rápidos */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.quickChip, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                    onPress={() => setFechaRapida(0)}
                  >
                    <Text style={[styles.quickChipText, { color: theme.text }]}>Hoy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickChip, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                    onPress={() => setFechaRapida(1)}
                  >
                    <Text style={[styles.quickChipText, { color: theme.text }]}>Mañana</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickChip, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                    onPress={() => setFechaRapida(3)}
                  >
                    <Text style={[styles.quickChipText, { color: theme.text }]}>En 3 días</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickChip, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                    onPress={() => setFechaRapida(7)}
                  >
                    <Text style={[styles.quickChipText, { color: theme.text }]}>En 1 semana</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickChip, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                    onPress={() => setFechaRapida(15)}
                  >
                    <Text style={[styles.quickChipText, { color: theme.text }]}>En 15 días</Text>
                  </TouchableOpacity>
                </View>

                {/* Vista previa en texto claro */}
                {getPromesaPreview() ? (
                  <View style={[styles.promesaPreviewBadge, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)', borderColor: theme.primary + '30' }]}>
                    <Ionicons name="calendar" size={13} color={theme.primary} />
                    <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700', flex: 1 }}>
                      {getPromesaPreview()}
                    </Text>
                  </View>
                ) : null}

                {promesaError ? (
                  <Text style={{ color: theme.danger, fontSize: 12, marginTop: 4 }}>{promesaError}</Text>
                ) : null}

                <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 6 }}>
                  Te avisamos un día antes y el día que llegue esa fecha.
                </Text>
              </>
            )}
          </View>
        )}

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
                  {usaQrInquilinos && (
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
                    </>
                  )}

                  <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: isDark ? 'rgba(52,199,89,0.3)' : '#34C75960', opacity: confirmando ? 0.7 : 1, marginTop: usaQrInquilinos ? 10 : 0 }]}
                    onPress={confirmarDirecto}
                    disabled={confirmando}
                  >
                    {confirmando
                      ? <ActivityIndicator color={isDark ? '#34C759' : '#15803D'} size="small" />
                      : <Ionicons name="checkmark-circle-outline" size={20} color={isDark ? '#34C759' : '#15803D'} />
                    }
                    <Text style={[styles.confirmBtnText, { color: isDark ? '#34C759' : '#15803D' }]}>
                      {confirmando ? 'Confirmando…' : usaQrInquilinos ? 'Marcar como pagado (Manual)' : 'Marcar como pagado'}
                    </Text>
                  </TouchableOpacity>

                  {usaQrInquilinos && !pago?.qr_token && (
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
            <TouchableOpacity
              style={[styles.historialToggle, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: theme.border }]}
              onPress={() => setShowCargosExtra(v => !v)}
            >
              <Ionicons name="receipt-outline" size={18} color={theme.primary} />
              <Text style={[styles.historialToggleText, { color: theme.primary }]}>Cargos extra</Text>
              {cuotas.length > 0 && (
                <View style={[styles.pagadoBadge, { backgroundColor: '#EF444420', marginLeft: 'auto', marginRight: 8 }]}>
                  <Text style={[styles.pagadoText, { color: '#EF4444' }]}>
                    {cuotas.length} · +{fmtRenta(totalExtra)}
                  </Text>
                </View>
              )}
              <Ionicons name={showCargosExtra ? 'chevron-up' : 'chevron-down'} size={16} color={theme.primary} style={cuotas.length > 0 ? undefined : { marginLeft: 'auto' }} />
            </TouchableOpacity>

            {showCargosExtra && (
              <View style={{ marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.addCuotaBtn, { backgroundColor: theme.primary, alignSelf: 'flex-start', marginBottom: 8 }]}
                  onPress={() => { setCuotaConcepto(''); setCuotaMonto(''); setCuotaError(''); setShowCuota(true); }}
                >
                  <Ionicons name="add" size={14} color="#fff" />
                  <Text style={styles.addCuotaBtnText}>Agregar</Text>
                </TouchableOpacity>
                {cuotas.length === 0 ? (
                  <Text style={[styles.noCuotas, { color: theme.textSecondary }]}>Sin cargos adicionales este mes</Text>
                ) : (
                  cuotas.map(c => (
                    <View key={c.id} style={[styles.cuotaRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }]}>
                      <Ionicons name="receipt-outline" size={14} color={theme.textSecondary} />
                      <Text style={[styles.cuotaConcepto, { color: theme.text }]} numberOfLines={1}>{c.concepto}</Text>
                      <Text style={[styles.cuotaMonto, { color: '#EF4444' }]}>+{fmtRenta(c.monto)}</Text>
                      <TouchableOpacity onPress={() => removeCuota(c.id)}>
                        <Ionicons name="trash-outline" size={16} color={theme.danger} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
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
                      {!confirmado && p.fecha_promesa && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="calendar-outline" size={12} color="#7C3AED" />
                          <Text style={{ color: '#7C3AED', fontSize: 11, fontWeight: '600' }}>
                            Prometió pagar: {formatToDDMMAAAA(p.fecha_promesa)}
                          </Text>
                        </View>
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

        {/* ── Depósito (separado de la renta) ── */}
        {!!depositoSaldo && depositoSaldo.deposito_total > 0 && (
          <View>
            <TouchableOpacity
              style={[styles.historialToggle, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', borderColor: theme.border }]}
              onPress={() => setShowDeposito(v => !v)}
            >
              <Ionicons name="lock-closed-outline" size={18} color={theme.primary} />
              <Text style={[styles.historialToggleText, { color: theme.primary }]}>Depósito</Text>
              <View style={[styles.pagadoBadge, {
                backgroundColor: depositoSaldo.deposito_saldo > 0 ? '#F59E0B20' : '#34C75920',
                marginLeft: 'auto', marginRight: 8,
              }]}>
                <Ionicons
                  name={depositoSaldo.deposito_saldo > 0 ? 'time' : 'checkmark-circle'}
                  size={14}
                  color={depositoSaldo.deposito_saldo > 0 ? '#F59E0B' : '#34C759'}
                />
                <Text style={[styles.pagadoText, { color: depositoSaldo.deposito_saldo > 0 ? '#F59E0B' : '#34C759' }]}>
                  {depositoSaldo.deposito_saldo > 0 ? `Falta ${fmtRenta(depositoSaldo.deposito_saldo)}` : 'Pagado completo'}
                </Text>
              </View>
              <Ionicons name={showDeposito ? 'chevron-up' : 'chevron-down'} size={16} color={theme.primary} />
            </TouchableOpacity>

            {showDeposito && (
              <View style={{ marginTop: 12, gap: 10 }}>
                <View style={[styles.montoCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff', paddingVertical: 20 }]}>
                  {depositoSaldo.deposito_saldo > 0 ? (
                    <>
                      <Text style={[styles.montoLabel, { color: theme.textSecondary }]}>FALTA POR PAGAR (DEPÓSITO)</Text>
                      <Text style={[styles.montoAmount, { color: '#F59E0B', fontSize: 30 }]}>{fmtRenta(depositoSaldo.deposito_saldo)}</Text>
                      <Text style={[styles.montoSub, { color: theme.textSecondary }]}>
                        Depósito total {fmtRenta(depositoSaldo.deposito_total)} · Pagado {fmtRenta(depositoSaldo.deposito_pagado)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.montoLabel, { color: theme.textSecondary }]}>DEPÓSITO</Text>
                      <Text style={[styles.montoAmount, { color: theme.text, fontSize: 30 }]}>{fmtRenta(depositoSaldo.deposito_total)}</Text>
                      <View style={styles.pagadoBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                        <Text style={styles.pagadoText}>Pagado</Text>
                      </View>
                    </>
                  )}
                </View>

                {depositoSaldo.deposito_saldo > 0 && (
                  <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
                    onPress={abrirNuevoDeposito}
                  >
                    <Ionicons name="cash-outline" size={20} color="#fff" />
                    <Text style={styles.confirmBtnText}>Registrar abono a depósito</Text>
                  </TouchableOpacity>
                )}

                {depositoAbonos.length > 0 && (
                  <View>
                    <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Historial de abonos al depósito</Text>
                    {depositoAbonos.map(a => (
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
                        <TouchableOpacity onPress={() => abrirEditarDeposito(a)}>
                          <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => eliminarDeposito(a.id)}>
                          <Ionicons name="trash-outline" size={16} color={theme.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
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
      {/* Modal registrar/editar abono a depósito */}
      <Modal visible={showDepositoModal} transparent animationType="fade" onRequestClose={() => setShowDepositoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDark ? '#1E2235' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {editingDepositoAbonoId ? 'Editar abono a depósito' : 'Registrar abono a depósito'}
            </Text>
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Monto ($)</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: depositoError ? theme.danger : theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
              value={depositoMonto}
              onChangeText={t => { setDepositoMonto(t.replace(/[^0-9.]/g, '')); setDepositoError(''); }}
              placeholder="500.00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Fecha (AAAA-MM-DD)</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: depositoError ? theme.danger : theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
              value={depositoFecha}
              onChangeText={t => { setDepositoFecha(t); setDepositoError(''); }}
              placeholder="2026-08-16"
              placeholderTextColor={theme.textSecondary}
              maxLength={10}
            />
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Nota (opcional)</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
              value={depositoNota}
              onChangeText={setDepositoNota}
              placeholder="Ej: Abono inicial, segundo pago..."
              placeholderTextColor={theme.textSecondary}
              maxLength={200}
            />
            {depositoError ? (
              <Text style={[styles.cuotaErr, { color: theme.danger }]}>{depositoError}</Text>
            ) : null}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalCancelBtn, { borderColor: theme.border }]} onPress={() => setShowDepositoModal(false)} disabled={savingDeposito}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: theme.primary, opacity: savingDeposito ? 0.7 : 1 }]} onPress={guardarDeposito} disabled={savingDeposito}>
                {savingDeposito ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar</Text>}
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

  promesaCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  promesaSaveBtn: { paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center', alignItems: 'center', height: 46 },
  promesaClearBtn: { width: 36, height: 46, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  calendarioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateSegmentBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  dateSegmentLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  dateSegmentInput: {
    fontSize: 15,
    fontWeight: '700',
    padding: 0,
    margin: 0,
    width: '100%',
    textAlign: 'center',
  },
  quickChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  promesaPreviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },

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
