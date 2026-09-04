import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TextInput, ScrollView, TouchableOpacity,
  useColorScheme, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, Alert, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { api } from '../../../services/api';
import { numberToWords } from '../../../utils/numberToWords';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface InputGroupProps {
  label: string;
  value: string;
  onChange?: (text: any) => void;
  placeholder?: string;
  icon?: any;
  keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'email-address';
  editable?: boolean;
  isRequired?: boolean;
  isAction?: boolean;
  onPressAction?: () => void;
  theme: any;
  maxLength?: number;
  isDark?: boolean;
}

const InputGroup = ({
  label, value, onChange, placeholder, icon, keyboardType = 'default',
  editable = true, isRequired = false, isAction = false, onPressAction,
  theme, maxLength, isDark = false,
}: InputGroupProps) => {
  const isWebDateField = Platform.OS === 'web' && isAction && /fecha/i.test(label);

  const innerContent = (
    <>
      {icon && <Ionicons name={icon} size={20} color={theme.icon} style={styles.inputIcon} />}
      {isWebDateField ? (
        <input
          type="date"
          value={value || ''}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: theme.text,
            fontSize: 16,
            cursor: 'pointer',
            fontFamily: 'inherit',
            colorScheme: isDark ? 'dark' : 'light',
          } as any}
          onChange={(e) => {
            if (!e.target.value) return;
            const date = new Date(e.target.value + 'T12:00:00');
            onChange?.(date);
          }}
        />
      ) : isAction ? (
        <Text style={[styles.inputText, { flex: 1, color: value ? theme.text : theme.textSecondary }]}>
          {value || placeholder}
        </Text>
      ) : (
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary + '80'}
          value={value}
          onChangeText={(text) => onChange?.(text)}
          keyboardType={keyboardType}
          editable={editable}
          maxLength={maxLength}
        />
      )}
      {isAction && <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />}
    </>
  );

  return (
    <View style={styles.inputGroup}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
        {isRequired && <Text style={{ color: theme.danger, marginLeft: 4 }}>*</Text>}
      </View>
      {isWebDateField ? (
        <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.card }]}>
          {innerContent}
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={isAction ? 0.6 : 1}
          onPress={onPressAction}
          disabled={!isAction}
          style={[
            styles.inputContainer,
            { borderColor: theme.border, backgroundColor: theme.card },
            !editable && { opacity: 0.8 },
          ]}
        >
          {innerContent}
        </TouchableOpacity>
      )}
    </View>
  );
};

const formatDateParts = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return { dateString: `${year}-${month}-${day}`, day };
};

const addOneYear = (date: Date) => {
  const next = new Date(date);
  next.setFullYear(date.getFullYear() + 1);
  return next;
};

const SectionCard = ({ title, children, theme }: { title: string; children: any; theme: any }) => (
  <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
    <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>{title}</Text>
    {children}
  </View>
);

const buildFechaPago = (day: string) => `${day} de cada mes`;

const normalizeFechaPago = (value: string) => {
  if (!value) return value;
  const trimmed = value.trim();
  if (/de cada mes/i.test(trimmed)) return trimmed;
  const match = trimmed.match(/(\d{1,2})/);
  if (!match) return trimmed;
  return `${match[1].padStart(2, '0')} de cada mes`;
};

export default function NuevoInquilinoScreen() {
  const router = useRouter();
  const { editId, fromId } = useLocalSearchParams<{ editId?: string; fromId?: string }>();
  const isEdit = !!editId;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;

  const [loading, setLoading] = useState(false);
  const [fetchingDeptos, setFetchingDeptos] = useState(true);
  const [availableDeptos, setAvailableDeptos] = useState<any[]>([]);
  const [showDeptoPicker, setShowDeptoPicker] = useState(false);

  const [formData, setFormData] = useState(() => {
    const today = new Date();
    const { dateString: todayString, day } = formatDateParts(today);
    const { dateString: nextYearString } = formatDateParts(addOneYear(today));

    return {
      nombre: '',
      depto: '',
      telArrendatario: '',
      renta: '',
      rentaLetra: '',
      deposito: '',
      fechaPago: buildFechaPago(day),
      fechaInicio: todayString,
      fechaTermino: nextYearString,
      fiador: '',
      telFiador: '',
      observaciones: '',
    };
  });

  const [metodo_pago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'ambos'>('efectivo');
  const [depositoTipo, setDepositoTipo] = useState<'ninguno' | 'quincenas' | 'personalizado'>('ninguno');

  // INE OCR
  const [extrayendoINE, setExtrayendoINE] = useState(false);
  const [depositoFechas, setDepositoFechas] = useState<string[]>([]);
  const [depositoManuallyEdited, setDepositoManuallyEdited] = useState(false);

  const resetForm = () => {
    const today = new Date();
    const { dateString: todayString, day } = formatDateParts(today);
    const { dateString: nextYearString } = formatDateParts(addOneYear(today));
    setFormData({
      nombre: '', depto: '', telArrendatario: '',
      renta: '', rentaLetra: '', deposito: '',
      fechaPago: buildFechaPago(day),
      fechaInicio: todayString,
      fechaTermino: nextYearString,
      fiador: '', telFiador: '', observaciones: '',
    });
    setMetodoPago('efectivo');
    setDepositoTipo('ninguno');
    setDepositoFechas([]);
    setDepositoDia('');
    setDepositoPagos(2);
    setDepositoManuallyEdited(false);
  };

  useEffect(() => {
    loadDeptos();
    if (isEdit && editId) {
      api.getInquilinoById(editId).then(r => {
        const d = r.data;
        const fechaInicio = d.fecha_inicio ? String(d.fecha_inicio).substring(0, 10) : '';
        const fechaTermino = d.fecha_termino ? String(d.fecha_termino).substring(0, 10) : '';
        setMetodoPago(d.metodo_pago || 'efectivo');
        const tipo = d.deposito_tipo || 'ninguno';
        // deposito_fechas son fechas ISO YYYY-MM-DD.
        const fechas: string[] = Array.isArray(d.deposito_fechas)
          ? d.deposito_fechas.map((x: any) => {
              const s = String(x);
              const m = s.match(/^\d{4}-\d{2}-\d{2}/);
              if (m) return m[0];
              // compat: valor viejo guardado como día del mes
              const n = parseInt(s, 10);
              if (!n || n < 1 || n > 31) return '';
              const now = new Date();
              return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
            }).filter(Boolean)
          : [];
        setDepositoTipo(tipo);
        setDepositoFechas(fechas);
        if (tipo === 'personalizado' && fechas.length > 0) {
          setDepositoDia(String(new Date(fechas[0] + 'T12:00:00').getDate()));
          setDepositoPagos(fechas.length);
        }
        setDepositoManuallyEdited(true);
        setFormData({
          nombre: d.nombre_completo || '',
          depto: String(d.depto_numero || ''),
          telArrendatario: d.tel_arrendatario || '',
          renta: String(d.renta || ''),
          rentaLetra: d.renta_letra || '',
          deposito: String(d.deposito || ''),
          fechaPago: d.fecha_pago || '',
          fechaInicio,
          fechaTermino,
          fiador: d.fiador_nombre || '',
          telFiador: d.fiador_telefono || '',
          observaciones: d.observaciones || '',
        });
      }).catch(() => Alert.alert('Error', 'No se pudo cargar el inquilino'));
    } else if (fromId) {
      // Pre-llenar datos personales desde inquilino archivado (nuevo contrato)
      api.getInquilinoById(fromId).then(r => {
        const d = r.data;
        resetForm();
        setFormData(prev => ({
          ...prev,
          nombre: d.nombre_completo || '',
          telArrendatario: d.tel_arrendatario || '',
          renta: String(d.renta || ''),
          rentaLetra: d.renta_letra || '',
          fiador: d.fiador_nombre || '',
          telFiador: d.fiador_telefono || '',
        }));
        setMetodoPago(d.metodo_pago || 'efectivo');
      }).catch(() => {});
    } else {
      resetForm();
    }
  }, [editId, fromId]);

  useFocusEffect(useCallback(() => {
    loadDeptos();
    // Resetear siempre que se entra en modo creación (no edición ni copia)
    if (!isEdit && !fromId) {
      resetForm();
    }
  }, [isEdit, fromId]));

  const [showDatePicker, setShowDatePicker] = useState<'inicio' | 'termino' | null>(null);
  // Depósito diferido "personalizado": N pagos el mismo día de cada mes.
  const [depositoDia, setDepositoDia] = useState('');
  const [depositoPagos, setDepositoPagos] = useState(2);

  // Genera las fechas ISO concretas (el backend las usa para recordatorios y
  // para el contrato): el día `dia` en `nPagos` meses consecutivos a partir
  // del mes de inicio del contrato (o el siguiente si el día ya pasó).
  const computeDepositoFechas = (dia: number, nPagos: number, startISO?: string): string[] => {
    if (!dia || dia < 1 || dia > 31 || !nPagos || nPagos < 1) return [];
    const base = startISO || formData.fechaInicio;
    const start = base ? new Date(base + 'T12:00:00') : new Date();
    let m = start.getMonth() + (dia < start.getDate() ? 1 : 0);
    const y = start.getFullYear();
    const out: string[] = [];
    for (let i = 0; i < nPagos; i++) {
      const mm = m + i;
      const year = y + Math.floor(mm / 12);
      const month = ((mm % 12) + 12) % 12;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const d = Math.min(dia, lastDay);
      out.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return out;
  };

  const applyDepositoDiferido = (dia: string, nPagos: number, startISO?: string) => {
    const fechas = computeDepositoFechas(parseInt(dia, 10), nPagos, startISO);
    setDepositoFechas(fechas);
    setFormData(prev => ({ ...prev, observaciones: buildDepositoObs('personalizado', fechas) }));
  };

  const handleDateChange = (
    type: 'inicio' | 'termino',
    event: DateTimePickerEvent | undefined,
    selectedDate?: Date
  ) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(null);
    }

    if (!selectedDate) return;

    const { dateString, day } = formatDateParts(selectedDate);

    if (type === 'inicio') {
      const { dateString: dateTermino } = formatDateParts(addOneYear(selectedDate));
      setFormData(prev => ({
        ...prev,
        fechaInicio: dateString,
        fechaTermino: dateTermino,
        fechaPago: buildFechaPago(day),
      }));
      // Recalcular fechas del depósito diferido con el nuevo mes de inicio
      if (depositoTipo === 'quincenas') {
        const f = quincenaFechas(dateString);
        setDepositoFechas(f);
        setFormData(prev => ({ ...prev, observaciones: buildDepositoObs('quincenas', f) }));
      } else if (depositoTipo === 'personalizado') {
        applyDepositoDiferido(depositoDia || day, depositoPagos, dateString);
      }
      return;
    }

    setFormData(prev => ({ ...prev, fechaTermino: dateString }));
  };

  const loadDeptos = async () => {
    try {
      const res = await api.getDepartamentos();
      const deptos = isEdit
        ? res.data || []
        : res.data?.filter((d: any) => d.estado === 'disponible') || [];
      setAvailableDeptos(deptos);
    } catch (error) {
      console.error('Error loading deptos:', error);
    } finally {
      setFetchingDeptos(false);
    }
  };

  const escanearINE = async () => {
    try {
      let imagen_base64: string | null = null;

      if (Platform.OS === 'web') {
        // Web: abrir cámara directamente (capture=environment = cámara trasera en móvil)
        imagen_base64 = await new Promise<string | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.setAttribute('capture', 'environment'); // cámara trasera
          input.onchange = (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target?.result as string);
            reader.readAsDataURL(file);
          };
          input.click();
        });
      } else {
        // Móvil nativo: cámara directa
        const ImagePicker = await import('expo-image-picker');
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso requerido', 'Necesitas permitir el acceso a la cámara para escanear el INE.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          base64: true,
          allowsEditing: true,   // recorte opcional para centrar el INE
          aspect: [16, 10],      // relación de aspecto similar a una credencial
        });
        if (!result.canceled && result.assets?.[0]?.base64) {
          imagen_base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
        }
      }

      if (!imagen_base64) return;

      setExtrayendoINE(true);
      try {
        const res = await api.extraerDatosINE(imagen_base64);
        const d = res.data;
        if (d) {
          setFormData(prev => ({
            ...prev,
            nombre: d.nombre_completo || prev.nombre,
            observaciones: prev.observaciones || [
              d.domicilio, d.colonia, d.municipio, d.estado, d.cp
            ].filter(Boolean).join(', '),
          }));
        }
        Alert.alert(
          '✅ Datos extraídos',
          'Se pre-llenó el formulario con los datos del INE. Revisa y edita si es necesario.',
          [{ text: 'Entendido' }]
        );
      } catch (e: any) {
        Alert.alert('Error al analizar INE', e.message || 'No se pudo leer el INE. Intenta con una imagen más clara.');
      } finally {
        setExtrayendoINE(false);
      }
    } catch (e) {
      setExtrayendoINE(false);
    }
  };

  const fmtFechaCorta = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

  const buildDepositoObs = (tipo: string, fechas: string[]): string => {
    if (tipo === 'ninguno') return '';
    if (!Array.isArray(fechas) || fechas.length === 0) {
      return tipo === 'quincenas' ? 'Se pagará el depósito en 2 quincenas, los días 15 y 30 del mes en curso.' : '';
    }
    if (tipo === 'quincenas') {
      return `Se pagará el depósito en 2 quincenas: ${fechas.map(fmtFechaCorta).join(' y ')}.`;
    }
    // personalizado: N pagos el mismo día de cada mes
    const dia = new Date(fechas[0] + 'T12:00:00').getDate();
    return `Se pagará el depósito en ${fechas.length} pago${fechas.length > 1 ? 's' : ''}, el día ${dia} de cada mes: ${fechas.map(fmtFechaCorta).join(', ')}.`;
  };

  const quincenaFechas = (startISO: string): string[] => {
    const start = startISO ? new Date(startISO + 'T12:00:00') : new Date();
    const y = start.getFullYear();
    const m = start.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const mm = String(m + 1).padStart(2, '0');
    return [`${y}-${mm}-15`, `${y}-${mm}-${String(Math.min(30, lastDay)).padStart(2, '0')}`];
  };

  const handleDepositoTipo = (tipo: 'ninguno' | 'quincenas' | 'personalizado') => {
    setDepositoTipo(tipo);
    if (tipo === 'quincenas') {
      const f = quincenaFechas(formData.fechaInicio);
      setDepositoFechas(f);
      setFormData(prev => ({ ...prev, observaciones: buildDepositoObs('quincenas', f) }));
    } else if (tipo === 'personalizado') {
      const diaRenta = formData.fechaPago.match(/^(\d{1,2})/)?.[1] || '1';
      setDepositoDia(diaRenta);
      setDepositoPagos(2);
      applyDepositoDiferido(diaRenta, 2);
    } else {
      setDepositoFechas([]);
      setDepositoDia('');
      setDepositoPagos(2);
      setFormData(prev => ({ ...prev, observaciones: '' }));
    }
  };

  const handleRentaChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    setFormData(prev => ({
      ...prev,
      renta: cleaned,
      rentaLetra: !isNaN(num) ? numberToWords(num) : '',
      deposito: depositoManuallyEdited ? prev.deposito : cleaned,
    }));
  };

  const handleSave = async () => {
    const { nombre, depto, telArrendatario, renta, deposito, fechaInicio, fechaTermino } = formData;

    if (!nombre || !depto || !telArrendatario || !renta || !deposito || !fechaInicio || !fechaTermino) {
      Alert.alert('Campos Obligatorios', 'Por favor completa todos los campos obligatorios del contrato.');
      return;
    }

    try {
      const fechaPagoNormalizada = normalizeFechaPago(formData.fechaPago);
      setLoading(true);
      const payload = {
        ...formData,
        fechaPago: fechaPagoNormalizada,
        renta: Number(renta),
        deposito: Number(deposito),
        depto: Number(depto),
        depositoTipo,
        depositoFechas,
        metodoPago: metodo_pago,
      };
      if (isEdit && editId) {
        await api.updateInquilino(editId, payload);
      } else {
        await api.createInquilino(payload);
      }
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo guardar el inquilino');
    } finally {
      setLoading(false);
    }
  };

  const actionButtons = (
    <>
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.discardBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
        disabled={loading}
      >
        <Ionicons name="close" size={16} color={theme.textSecondary} />
        <Text style={[styles.discardBtnText, { color: theme.text }]}>Descartar Cambios</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: theme.primary }, loading && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.primaryBtnText}>
              {isEdit ? 'Guardar Cambios' : 'Guardar Inquilino y Generar Contrato'}
            </Text>
            {!isEdit && <Ionicons name="arrow-forward" size={18} color="#fff" />}
          </>
        )}
      </TouchableOpacity>
    </>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: isDesktop ? 110 : 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, !isDesktop && { paddingTop: insets.top + 16 }]}>
          {/* Encabezado */}
          <View style={styles.headerBlock}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
              <Ionicons name="arrow-back" size={18} color={theme.textSecondary} />
              <Text style={[styles.backLinkText, { color: theme.textSecondary }]}>Volver a la lista</Text>
            </TouchableOpacity>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: theme.text }, !isDesktop && { fontSize: 23 }]}>
                {isEdit ? 'Editar Inquilino' : fromId ? 'Nuevo Contrato' : 'Registro de Inquilino'}
              </Text>
              <View style={[styles.badge, { backgroundColor: theme.primary + '1F', borderColor: theme.primary + '4D' }]}>
                <Text style={[styles.badgeText, { color: theme.primary }]}>
                  {isEdit ? 'MODO EDICIÓN' : 'MODO CREACIÓN'}
                </Text>
              </View>
            </View>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Asigna departamento, datos del arrendatario y condiciones del contrato.
            </Text>
          </View>

          {/* Banner de escaneo INE */}
          {!isEdit && (
            <View
              style={[
                styles.ineBanner,
                { backgroundColor: theme.primary + '12', borderColor: theme.primary + '33' },
                !isDesktop && { flexDirection: 'column', alignItems: 'stretch' },
              ]}
            >
              <View style={styles.ineBannerInfo}>
                <View style={[styles.ineIconBox, { backgroundColor: theme.primary + '1F', borderColor: theme.primary + '3D' }]}>
                  <Ionicons name="scan-outline" size={22} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ineTitle, { color: theme.text }]}>
                    Autocompletar con INE (Visión Artificial / IA)
                  </Text>
                  <Text style={[styles.ineDesc, { color: theme.textSecondary }]}>
                    Escanea la credencial para rellenar automáticamente los datos del arrendatario.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.ineBtn, { backgroundColor: theme.card, borderColor: theme.border }, extrayendoINE && { opacity: 0.7 }]}
                onPress={escanearINE}
                disabled={extrayendoINE}
              >
                {extrayendoINE ? (
                  <>
                    <ActivityIndicator color={theme.primary} size="small" />
                    <Text style={[styles.ineBtnText, { color: theme.text }]}>Analizando…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={18} color={theme.primary} />
                    <Text style={[styles.ineBtnText, { color: theme.text }]}>Escanear INE</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Rejilla de dos columnas */}
          <View style={[styles.grid, isDesktop && styles.gridRow]}>
            {/* Columna izquierda */}
            <View style={[styles.col, isDesktop && styles.colLeftDesktop]}>
              <SectionCard title="Datos del Arrendatario" theme={theme}>
                <InputGroup
                  label="Nombre Completo"
                  isRequired
                  value={formData.nombre}
                  onChange={(text: string) => setFormData({ ...formData, nombre: text })}
                  placeholder="Ej. Juan Pérez García"
                  icon="person-outline"
                  theme={theme}
                />
                <InputGroup
                  label="Departamento Asignado"
                  isRequired
                  value={formData.depto ? `Departamento ${formData.depto}` : ''}
                  isAction
                  onPressAction={() => setShowDeptoPicker(true)}
                  placeholder="Selecciona un departamento…"
                  icon="business-outline"
                  theme={theme}
                />
                <InputGroup
                  label="Teléfono Arrendatario"
                  isRequired
                  value={formData.telArrendatario}
                  onChange={(text: string) => setFormData({ ...formData, telArrendatario: text.replace(/[^0-9]/g, '') })}
                  placeholder="10 dígitos"
                  keyboardType="phone-pad"
                  icon="call-outline"
                  theme={theme}
                  maxLength={10}
                />
              </SectionCard>

              <SectionCard title="Obligado Solidario / Fiador (opcional)" theme={theme}>
                <View style={styles.row}>
                  <View style={styles.rowItemL}>
                    <InputGroup
                      label="Nombre del Fiador"
                      value={formData.fiador}
                      onChange={(text: string) => setFormData({ ...formData, fiador: text })}
                      placeholder="Ej. María López"
                      icon="people-outline"
                      theme={theme}
                    />
                  </View>
                  <View style={styles.rowItemR}>
                    <InputGroup
                      label="Teléfono del Fiador"
                      value={formData.telFiador}
                      onChange={(text: string) => setFormData({ ...formData, telFiador: text.replace(/[^0-9]/g, '') })}
                      placeholder="10 dígitos"
                      keyboardType="phone-pad"
                      icon="call-outline"
                      theme={theme}
                      maxLength={10}
                    />
                  </View>
                </View>
              </SectionCard>

              <SectionCard title="Observaciones y Notas" theme={theme}>
                <InputGroup
                  label="Notas"
                  value={formData.observaciones}
                  onChange={(text: string) => setFormData({ ...formData, observaciones: text })}
                  placeholder="Notas adicionales sobre el contrato o inquilino…"
                  icon="document-text-outline"
                  theme={theme}
                />
              </SectionCard>
            </View>

            {/* Columna derecha */}
            <View style={[styles.col, isDesktop && styles.colRightDesktop]}>
              <SectionCard title="Condiciones Financieras" theme={theme}>
                <View style={styles.row}>
                  <View style={styles.rowItemL}>
                    <InputGroup
                      label="Renta Mensual"
                      isRequired
                      value={formData.renta}
                      onChange={handleRentaChange}
                      placeholder="3500"
                      keyboardType="numeric"
                      icon="cash-outline"
                      theme={theme}
                      maxLength={6}
                    />
                  </View>
                  <View style={styles.rowItemR}>
                    <InputGroup
                      label="Depósito"
                      isRequired
                      value={formData.deposito}
                      onChange={(text: string) => {
                        setDepositoManuallyEdited(true);
                        setFormData(prev => ({ ...prev, deposito: text.replace(/[^0-9]/g, '') }));
                      }}
                      placeholder="3500"
                      keyboardType="numeric"
                      icon="wallet-outline"
                      theme={theme}
                      maxLength={6}
                    />
                  </View>
                </View>

                <InputGroup
                  label="Renta (Letra)"
                  value={formData.rentaLetra}
                  editable={false}
                  placeholder="Se genera automáticamente…"
                  icon="text-outline"
                  theme={theme}
                />

                <View style={[styles.divider, { borderTopColor: theme.border }]} />

                <View style={styles.row}>
                  <View style={styles.rowItemL}>
                    <View style={styles.inputGroup}>
                      <View style={styles.labelRow}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Día de Corte</Text>
                      </View>
                      <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.card }]}>
                        <Ionicons name="calendar-outline" size={20} color={theme.icon} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: theme.text, flex: 0, width: 30, textAlign: 'center' }]}
                          value={formData.fechaPago.match(/^(\d{1,2})/)?.[1] || ''}
                          onChangeText={(text) => {
                            const num = text.replace(/[^0-9]/g, '').slice(0, 2);
                            const n = parseInt(num, 10);
                            if (num && n > 31) return;
                            setFormData(prev => ({
                              ...prev,
                              fechaPago: num ? buildFechaPago(num.padStart(2, '0')) : '',
                            }));
                          }}
                          keyboardType="numeric"
                          maxLength={2}
                          placeholder="15"
                          placeholderTextColor={theme.textSecondary + '80'}
                        />
                        <Text style={[styles.inputText, { color: theme.textSecondary, flex: 1, paddingLeft: 4 }]}>de cada mes</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.rowItemR}>
                    <InputGroup
                      label="Fecha Inicio"
                      isRequired
                      value={formData.fechaInicio}
                      isAction
                      onPressAction={() => setShowDatePicker('inicio')}
                      onChange={(date: Date) => handleDateChange('inicio', undefined, date)}
                      placeholder="Seleccionar…"
                      icon="today-outline"
                      theme={theme}
                      isDark={isDark}
                    />
                  </View>
                </View>

                <InputGroup
                  label="Fecha Término"
                  isRequired
                  value={formData.fechaTermino}
                  isAction
                  onPressAction={() => setShowDatePicker('termino')}
                  onChange={(date: Date) => handleDateChange('termino', undefined, date)}
                  placeholder="Seleccionar…"
                  icon="calendar-clear-outline"
                  theme={theme}
                  isDark={isDark}
                />
              </SectionCard>

              <SectionCard title="Método de Pago & Depósito" theme={theme}>
                {/* Método de pago — selección múltiple */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Método Preferido</Text>
                  <Text style={[styles.sublabel, { color: theme.textMuted }]}>Puedes seleccionar uno o ambos</Text>
                  <View style={styles.depositoSelector}>
                    {([
                      { key: 'efectivo', label: 'Efectivo', icon: 'cash-outline', color: theme.primary },
                      { key: 'transferencia', label: 'Transferencia', icon: 'card-outline', color: theme.success },
                    ] as const).map(opt => {
                      const isActive = metodo_pago === opt.key || metodo_pago === 'ambos';
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          style={[
                            styles.depositoOption,
                            {
                              backgroundColor: isActive ? opt.color : theme.card,
                              borderColor: isActive ? opt.color : theme.border,
                            }
                          ]}
                          onPress={() => {
                            if (metodo_pago === 'ambos') {
                              // Deseleccionar este → dejar solo el otro
                              setMetodoPago(opt.key === 'efectivo' ? 'transferencia' : 'efectivo');
                            } else if (metodo_pago === opt.key) {
                              // Ya activo → no deseleccionar (siempre debe haber al menos 1)
                            } else {
                              // El otro estaba activo → activar ambos
                              setMetodoPago('ambos');
                            }
                          }}
                        >
                          <Ionicons name={isActive ? opt.icon.replace('-outline', '') as any : opt.icon} size={15} color={isActive ? '#fff' : theme.textSecondary} />
                          <Text style={[styles.depositoOptionText, { color: isActive ? '#fff' : theme.text }]}>
                            {opt.label}
                          </Text>
                          {isActive && (
                            <Ionicons name="checkmark-circle" size={14} color="rgba(255,255,255,0.85)" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {metodo_pago === 'ambos' && (
                    <Text style={[styles.metodoPagoHint, { color: theme.success }]}>
                      ✓ Acepta efectivo y transferencia
                    </Text>
                  )}
                </View>

                {/* Depósito diferido */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Esquema de Depósito</Text>
                  <View style={styles.depositoSelector}>
                    {([
                      { key: 'ninguno', label: 'Pago Único', icon: 'close-circle-outline' },
                      { key: 'quincenas', label: '2 Quincenas', icon: 'calendar-outline' },
                      { key: 'personalizado', label: 'En mensualidades', icon: 'repeat-outline' },
                    ] as const).map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.depositoOption,
                          {
                            backgroundColor: depositoTipo === opt.key ? theme.primary : theme.card,
                            borderColor: depositoTipo === opt.key ? theme.primary : theme.border,
                          }
                        ]}
                        onPress={() => handleDepositoTipo(opt.key)}
                      >
                        <Ionicons name={opt.icon} size={15} color={depositoTipo === opt.key ? '#fff' : theme.textSecondary} />
                        <Text style={[styles.depositoOptionText, { color: depositoTipo === opt.key ? '#fff' : theme.text }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {depositoTipo === 'personalizado' && (
                    <View style={{ marginTop: 12 }}>
                      <View style={styles.row}>
                        <View style={styles.rowItemL}>
                          <Text style={[styles.label, { color: theme.textSecondary, marginBottom: 8 }]}>N.º de pagos</Text>
                          <View style={[styles.stepper, { borderColor: theme.border, backgroundColor: theme.card }]}>
                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() => {
                                const n = Math.max(2, depositoPagos - 1);
                                setDepositoPagos(n);
                                applyDepositoDiferido(depositoDia, n);
                              }}
                            >
                              <Ionicons name="remove" size={18} color={theme.text} />
                            </TouchableOpacity>
                            <Text style={[styles.stepVal, { color: theme.text }]}>{depositoPagos}</Text>
                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() => {
                                const n = Math.min(6, depositoPagos + 1);
                                setDepositoPagos(n);
                                applyDepositoDiferido(depositoDia, n);
                              }}
                            >
                              <Ionicons name="add" size={18} color={theme.text} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.rowItemR}>
                          <Text style={[styles.label, { color: theme.textSecondary, marginBottom: 8 }]}>Día de cada mes</Text>
                          <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.card }]}>
                            <Ionicons name="calendar-outline" size={18} color={theme.icon} style={styles.inputIcon} />
                            <TextInput
                              style={[styles.input, { color: theme.text }]}
                              value={depositoDia}
                              onChangeText={(t) => {
                                const n = t.replace(/[^0-9]/g, '').slice(0, 2);
                                if (n && parseInt(n, 10) > 31) return;
                                setDepositoDia(n);
                                applyDepositoDiferido(n, depositoPagos);
                              }}
                              keyboardType="numeric"
                              maxLength={2}
                              placeholder="15"
                              placeholderTextColor={theme.textSecondary + '80'}
                            />
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                  {depositoTipo !== 'ninguno' && (
                    <View style={[styles.depositoPreview, { backgroundColor: theme.success + '14', borderColor: theme.success + '3D' }]}>
                      <Ionicons name="checkmark-circle" size={15} color={theme.success} />
                      <Text style={[styles.depositoPreviewText, { color: theme.success }]}>
                        {formData.observaciones || (depositoTipo === 'personalizado' ? 'Indica el día del mes para calcular las fechas' : 'Selecciona un esquema')}
                      </Text>
                    </View>
                  )}
                </View>
              </SectionCard>
            </View>
          </View>

          {/* Acciones (móvil, en flujo) */}
          {!isDesktop && <View style={styles.mobileActions}>{actionButtons}</View>}
        </View>
      </ScrollView>

      {/* Footer fijo (escritorio) */}
      {isDesktop && (
        <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <View style={styles.footerInner}>{actionButtons}</View>
        </View>
      )}

      {Platform.OS !== 'web' && showDatePicker && (
        <>
          <DateTimePicker
            value={
              showDatePicker === 'inicio'
                ? (formData.fechaInicio ? new Date(formData.fechaInicio + 'T12:00:00') : new Date())
                : showDatePicker === 'termino'
                ? (formData.fechaTermino ? new Date(formData.fechaTermino + 'T12:00:00') : new Date())
                : new Date()
            }
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => handleDateChange(showDatePicker, event, date)}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={{ alignSelf: 'center', padding: 12 }}
              onPress={() => setShowDatePicker(null)}
            >
              <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Cerrar Calendario</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Selector de Departamentos */}
      <Modal visible={showDeptoPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Seleccionar Departamento</Text>
              <TouchableOpacity onPress={() => setShowDeptoPicker(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.deptoList}>
              {fetchingDeptos ? (
                <ActivityIndicator style={{ padding: 20 }} color={theme.primary} />
              ) : availableDeptos.length > 0 ? (
                availableDeptos.map(depto => (
                  <TouchableOpacity
                    key={depto.id}
                    style={[styles.deptoItem, { borderBottomColor: theme.border }]}
                    onPress={() => {
                      setFormData({...formData, depto: depto.numero.toString()});
                      setShowDeptoPicker(false);
                    }}
                  >
                    <Ionicons name="business" size={20} color={theme.primary} />
                    <View style={styles.deptoItemInfo}>
                      <Text style={[styles.deptoItemNum, { color: theme.text }]}>Departamento {depto.numero}</Text>
                      {depto.descripcion && <Text style={[styles.deptoItemDesc, { color: theme.textSecondary }]}>{depto.descripcion}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Ionicons name="alert-circle-outline" size={48} color={theme.textSecondary} />
                  <Text style={{ color: theme.textSecondary, marginTop: 12, textAlign: 'center' }}>No hay departamentos disponibles.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 20,
    maxWidth: 1180,
    alignSelf: 'center',
    width: '100%',
  },
  headerBlock: {
    marginBottom: 20,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
  },
  ineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  ineBannerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  ineIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ineTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  ineDesc: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  grid: {
    gap: 16,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  col: {
    gap: 16,
  },
  colLeftDesktop: {
    flex: 7,
  },
  colRightDesktop: {
    flex: 5,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowItemL: {
    flex: 1,
    marginRight: 8,
  },
  rowItemR: {
    flex: 1,
    marginLeft: 8,
  },
  divider: {
    borderTopWidth: 1,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
  },
  sublabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: -4,
  },
  metodoPagoHint: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  depositoSelector: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  depositoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  depositoOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 4,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepVal: {
    fontSize: 16,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'center',
  },
  depositoPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  depositoPreviewText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  footerInner: {
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mobileActions: {
    marginTop: 24,
    gap: 10,
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 18,
  },
  discardBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 10,
    paddingHorizontal: 22,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  ineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  ineBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  deptoList: {
    padding: 8,
  },
  deptoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  deptoItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  deptoItemNum: {
    fontSize: 16,
    fontWeight: '600',
  },
  deptoItemDesc: {
    fontSize: 12,
    opacity: 0.6,
  },
});
