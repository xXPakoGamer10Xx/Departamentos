import { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, ScrollView, TouchableOpacity,
  useColorScheme, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, Alert, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../../../services/api';
import { numberToWords } from '../../../utils/numberToWords';
import { GlassCard } from '../../../components/ui/GlassCard';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface InputGroupProps {
  label: string;
  value: string;
  onChange?: (text: string | Date) => void;
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
  const isWebDateField = Platform.OS === 'web' && isAction && label.includes('Fecha');

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
            onChange(date);
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
  const { editId } = useLocalSearchParams<{ editId?: string }>();
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

  const [metodo_pago, setMetodoPago] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [depositoTipo, setDepositoTipo] = useState<'ninguno' | 'quincenas' | 'personalizado'>('ninguno');
  const [depositoFechas, setDepositoFechas] = useState<number[]>([]);
  const [depositoFechasText, setDepositoFechasText] = useState('');

  useEffect(() => {
    loadDeptos();
    if (isEdit && editId) {
      api.getInquilinoById(editId).then(r => {
        const d = r.data;
        const fechaInicio = d.fecha_inicio ? String(d.fecha_inicio).substring(0, 10) : '';
        const fechaTermino = d.fecha_termino ? String(d.fecha_termino).substring(0, 10) : '';
        setMetodoPago(d.metodo_pago || 'efectivo');
        const tipo = d.deposito_tipo || 'ninguno';
        const fechas: number[] = Array.isArray(d.deposito_fechas) ? d.deposito_fechas : [];
        setDepositoTipo(tipo);
        setDepositoFechas(fechas);
        if (tipo === 'personalizado' && fechas.length > 0) {
          setDepositoFechasText(fechas.join(', '));
        }
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
    }
  }, [editId]);

  const [showDatePicker, setShowDatePicker] = useState<'inicio' | 'termino' | null>(null);

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

  const buildDepositoObs = (tipo: string, fechas: number[]): string => {
    if (tipo === 'ninguno') return '';
    if (tipo === 'quincenas') {
      return 'Se realizará el pago del depósito en 2 quincenas, los días 15 y 30 del mes en curso';
    }
    if (tipo === 'personalizado' && fechas.length > 0) {
      const sorted = [...fechas].sort((a, b) => a - b);
      const diasStr = sorted.length === 1
        ? `el día ${sorted[0]}`
        : `los días ${sorted.slice(0, -1).join(', ')} y ${sorted[sorted.length - 1]}`;
      return `Se realizará el pago del depósito en ${sorted.length} parte${sorted.length > 1 ? 's' : ''}, ${diasStr} del mes en curso`;
    }
    return '';
  };

  const handleDepositoTipo = (tipo: 'ninguno' | 'quincenas' | 'personalizado') => {
    setDepositoTipo(tipo);
    if (tipo === 'quincenas') {
      setDepositoFechas([15, 30]);
      setFormData(prev => ({ ...prev, observaciones: buildDepositoObs('quincenas', [15, 30]) }));
    } else if (tipo === 'ninguno') {
      setDepositoFechas([]);
      setFormData(prev => ({ ...prev, observaciones: '' }));
    } else {
      setDepositoFechas([]);
      setFormData(prev => ({ ...prev, observaciones: '' }));
    }
  };

  const handleDepositoFechasText = (text: string) => {
    setDepositoFechasText(text);
    const nums = text.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 31);
    setDepositoFechas(nums);
    setFormData(prev => ({ ...prev, observaciones: buildDepositoObs('personalizado', nums) }));
  };

  const handleRentaChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    setFormData({
      ...formData,
      renta: cleaned,
      rentaLetra: !isNaN(num) ? numberToWords(num) : ''
    });
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

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, !isDesktop && { paddingTop: insets.top + 20 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>{isEdit ? 'Editar Inquilino' : 'Nuevo Inquilino'}</Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Datos Personales</Text>
          <InputGroup 
            label="Nombre Completo" 
            isRequired
            value={formData.nombre} 
            onChange={(text: string) => setFormData({...formData, nombre: text})}
            placeholder="Ej. Juan Pérez"
            icon="person-outline"
            theme={theme}
          />
          
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <InputGroup 
                label="Depto No." 
                isRequired
                value={formData.depto ? `Departamento ${formData.depto}` : ''} 
                isAction
                onPressAction={() => setShowDeptoPicker(true)}
                placeholder="Seleccionar..."
                icon="business-outline"
                theme={theme}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <InputGroup 
                label="Teléfono" 
                isRequired
                value={formData.telArrendatario} 
                onChange={(text: string) => {
                  const cleaned = text.replace(/[^0-9]/g, '');
                  setFormData({...formData, telArrendatario: cleaned});
                }}
                placeholder="10 dígitos"
                keyboardType="phone-pad"
                icon="call-outline"
                theme={theme}
                maxLength={10}
              />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 16 }]}>Datos del Contrato</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <InputGroup 
                label="Renta (Números)" 
                isRequired
                value={formData.renta} 
                onChange={handleRentaChange}
                placeholder="3500"
                keyboardType="numeric"
                icon="cash-outline"
                theme={theme}
                maxLength={5}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <InputGroup 
                label="Depósito" 
                isRequired
                value={formData.deposito} 
                onChange={(text: string) => {
                  const cleaned = text.replace(/[^0-9]/g, '');
                  setFormData({...formData, deposito: cleaned});
                }}
                placeholder="3500"
                keyboardType="numeric"
                icon="wallet-outline"
                theme={theme}
                maxLength={5}
              />
            </View>
          </View>

          <InputGroup 
            label="Renta (Letra)" 
            value={formData.rentaLetra} 
            editable={false}
            placeholder="Se genera automáticamente..."
            icon="text-outline"
            theme={theme}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <InputGroup 
                label="Día de Pago" 
                value={formData.fechaPago} 
                onChange={(text: string) => setFormData({...formData, fechaPago: text})}
                placeholder="Ej. 15 de cada mes"
                icon="calendar-outline"
                theme={theme}
                maxLength={20}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <InputGroup
                label="Fecha Inicio"
                isRequired
                value={formData.fechaInicio}
                isAction
                onPressAction={() => setShowDatePicker('inicio')}
                onChange={(date: Date) => handleDateChange('inicio', undefined, date)}
                placeholder="Seleccionar..."
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
            placeholder="Seleccionar..."
            icon="calendar-clear-outline"
            theme={theme}
            isDark={isDark}
          />

          {Platform.OS !== 'web' && showDatePicker && (
            <DateTimePicker
              value={
                showDatePicker === 'inicio' 
                  ? (formData.fechaInicio ? new Date(formData.fechaInicio + 'T12:00:00') : new Date())
                  : (formData.fechaTermino ? new Date(formData.fechaTermino + 'T12:00:00') : new Date())
              }
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => handleDateChange(showDatePicker as 'inicio' | 'termino', event, date)}
            />
          )}

          {Platform.OS === 'ios' && showDatePicker && (
            <TouchableOpacity 
              style={{ alignSelf: 'center', padding: 10 }}
              onPress={() => setShowDatePicker(null)}
            >
              <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Cerrar Calendario</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 16 }]}>Fiador (Opcional)</Text>
          <InputGroup 
            label="Nombre del Fiador" 
            value={formData.fiador} 
            onChange={(text: string) => setFormData({...formData, fiador: text})}
            placeholder="Ej. María López"
            icon="people-outline"
            theme={theme}
          />
          <InputGroup 
            label="Teléfono del Fiador" 
            value={formData.telFiador} 
            onChange={(text: string) => {
              const cleaned = text.replace(/[^0-9]/g, '');
              setFormData({...formData, telFiador: cleaned});
            }}
            placeholder="10 dígitos"
            keyboardType="phone-pad"
            icon="call-outline"
            theme={theme}
            maxLength={10}
          />

          <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 16 }]}>Adicional</Text>

          {/* Método de pago */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Método de pago</Text>
            <View style={styles.depositoSelector}>
              {([
                { key: 'efectivo', label: 'Efectivo', icon: 'cash-outline' },
                { key: 'transferencia', label: 'Transferencia', icon: 'card-outline' },
              ] as const).map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.depositoOption,
                    {
                      backgroundColor: metodo_pago === opt.key ? (opt.key === 'transferencia' ? '#34C759' : theme.primary) : theme.card,
                      borderColor: metodo_pago === opt.key ? (opt.key === 'transferencia' ? '#34C759' : theme.primary) : theme.border,
                    }
                  ]}
                  onPress={() => setMetodoPago(opt.key)}
                >
                  <Ionicons name={opt.icon} size={15} color={metodo_pago === opt.key ? '#fff' : theme.textSecondary} />
                  <Text style={[styles.depositoOptionText, { color: metodo_pago === opt.key ? '#fff' : theme.text }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Depósito diferido */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Depósito diferido</Text>
            <View style={styles.depositoSelector}>
              {([
                { key: 'ninguno', label: 'Ninguno', icon: 'close-circle-outline' },
                { key: 'quincenas', label: '2 Quincenas', icon: 'calendar-outline' },
                { key: 'personalizado', label: 'Fechas propias', icon: 'create-outline' },
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
              <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.card, marginTop: 8 }]}>
                <Ionicons name="calendar-number-outline" size={20} color={theme.icon} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Días separados por coma: 10, 20"
                  placeholderTextColor={theme.textSecondary + '80'}
                  value={depositoFechasText}
                  onChangeText={handleDepositoFechasText}
                  keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
                />
              </View>
            )}
            {depositoTipo !== 'ninguno' && (
              <View style={[styles.depositoPreview, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '30' }]}>
                <Ionicons name="information-circle-outline" size={14} color={theme.primary} />
                <Text style={[styles.depositoPreviewText, { color: theme.primary }]}>
                  {formData.observaciones || 'Ingresa los días para generar el texto'}
                </Text>
              </View>
            )}
          </View>

          <InputGroup
            label="Observaciones"
            value={formData.observaciones}
            onChange={(text: string) => setFormData({...formData, observaciones: text})}
            placeholder="Detalles adicionales..."
            icon="document-text-outline"
            theme={theme}
          />

          <TouchableOpacity 
            style={[
              styles.saveButton, 
              { backgroundColor: theme.primary },
              loading && { opacity: 0.7 }
            ]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{isEdit ? 'Guardar Cambios' : 'Guardar Inquilino'}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Selector de Departamentos */}
      <Modal visible={showDeptoPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalContent} padding={0}>
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
          </GlassCard>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  form: {
    padding: 16,
    paddingBottom: 100,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  saveButton: {
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  depositoOptionText: {
    fontSize: 13,
    fontWeight: '600',
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
