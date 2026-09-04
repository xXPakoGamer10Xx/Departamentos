import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, useColorScheme,
  Switch, Platform, useWindowDimensions, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { GlassCard } from '../../../components/ui/GlassCard';
import { SurfaceCard } from '../../../components/ui/SurfaceCard';
import RichHtmlEditor from '../../../components/ui/RichHtmlEditor';
import { DEFAULT_CONTRATO_HTML } from '../../../components/ui/contractVariables';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useCallback, useEffect } from 'react';
import api from '../../../services/api';
import { getItem, setItem, removeItem } from '../../../services/storage';
import { activateWebPush } from '../../../services/webNotifications';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

function getStoredUser() {
  try { return JSON.parse(getItem(USER_KEY) || 'null'); } catch { return null; }
}

function getNotifPref(): boolean {
  return getItem('notif_enabled') !== 'false';
}

function setNotifPref(val: boolean) {
  setItem('notif_enabled', val ? 'true' : 'false');
}

export default function ConfiguracionScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  const user = getStoredUser();
  const displayName = user?.nombre_completo || 'Administrador Principal';
  const email = user?.email || '—';
  const initials = displayName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();

  const [notifEnabled, setNotifEnabled] = useState(getNotifPref());
  const [notifBlocked, setNotifBlocked] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [backups, setBackups] = useState<any[]>([]);

  // Edit config modal
  const [editModal, setEditModal] = useState<{ clave: string; label: string; value: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const FIELD_LIMITS: Record<string, { maxLength: number; numericOnly?: boolean }> = {
    banco_clabe:          { maxLength: 18, numericOnly: true },
    banco_nombre:         { maxLength: 50 },
    banco_titular:        { maxLength: 100 },
    arrendador_nombre:    { maxLength: 100 },
    arrendador_direccion: { maxLength: 200 },
    admin_invite_code:    { maxLength: 64 },
    app_url:              { maxLength: 200 },
    dias_gracia_retraso:  { maxLength: 2, numericOnly: true },
  };

  // Backups modal
  const [showBackups, setShowBackups] = useState(false);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creandoBackup, setCreandoBackup] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');

  // Admins modal
  const [showAdmins, setShowAdmins] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  const [cambiandoRolId, setCambiandoRolId] = useState<string | null>(null);
  const [rolModalUser, setRolModalUser] = useState<any | null>(null);

  // Códigos de invitación
  const [showCodigos, setShowCodigos] = useState(false);
  const [codigos, setCodigos] = useState<any[]>([]);
  const [loadingCodigos, setLoadingCodigos] = useState(false);
  const [showGenerarCodigo, setShowGenerarCodigo] = useState(false);
  const [generandoCodigo, setGenerandoCodigo] = useState(false);
  const [codigoGenerado, setCodigoGenerado] = useState<any | null>(null);
  const [rolCodigo, setRolCodigo] = useState<'inquilino' | 'cobrador'>('inquilino');
  const [expiraDias, setExpiraDias] = useState<number | null>(7);
  const [codigoCopiado, setCodigoCopiado] = useState(false);

  // Vincular modal
  const [vincularModal, setVincularModal] = useState<{ userId: string; userName: string } | null>(null);
  const [inquilinosLista, setInquilinosLista] = useState<any[]>([]);
  const [loadingInquilinos, setLoadingInquilinos] = useState(false);
  const [vinculando, setVinculando] = useState(false);

  // Plantilla de contrato DOCX — flujo IA
  const [showPlantilla, setShowPlantilla] = useState(false);
  const [plantillaStep, setPlantillaStep] = useState<'inicio' | 'procesando' | 'preview'>('inicio');
  const [htmlTemplate, setHtmlTemplate] = useState<string | null>(null);
  const [subiendoPlantilla, setSubiendoPlantilla] = useState(false);
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [borrandoPlantilla, setBorrandoPlantilla] = useState(false);
  const [plantillaError, setPlantillaError] = useState('');

  // Editor de contrato
  const [showEditor, setShowEditor] = useState(false);
  const [editorHtml, setEditorHtml] = useState('');
  const [guardandoEditor, setGuardandoEditor] = useState(false);
  const [editorError, setEditorError] = useState('');

  // Cuentas bancarias
  const [showCuentas, setShowCuentas] = useState(false);
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState(false);
  const [cuentaForm, setCuentaForm] = useState<{ id?: string; alias: string; banco_nombre: string; banco_clabe: string; banco_titular: string } | null>(null);
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  const [cuentaError, setCuentaError] = useState('');

  // Nuevo usuario form
  const [showNuevoUsuario, setShowNuevoUsuario] = useState(false);
  const [nuNombre, setNuNombre] = useState('');
  const [nuEmail, setNuEmail] = useState('');
  const [nuPassword, setNuPassword] = useState('');
  const [nuRol, setNuRol] = useState<'admin' | 'cobrador' | 'inquilino'>('admin');
  const [creandoUsuario, setCreandoUsuario] = useState(false);
  const [nuError, setNuError] = useState('');

  useFocusEffect(useCallback(() => {
    api.getConfig()
      .then(r => setConfig(r.data || {}))
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
    api.getUsuarios().then(r => setAdmins(r.data || [])).catch(() => {});
  }, []));

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      setNotifBlocked(Notification.permission === 'denied');
    }
  }, []);

  const handleNotifToggle = async (val: boolean) => {
    if (val && Platform.OS === 'web') {
      const activated = await activateWebPush();
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotifBlocked(Notification.permission === 'denied');
      }
      if (!activated) {
        setNotifEnabled(false);
        setNotifPref(false);
        return;
      }
    }
    setNotifEnabled(val);
    setNotifPref(val);
  };

  const handleUsaQrToggle = async (val: boolean) => {
    const prev = config['usa_qr_inquilinos'];
    setConfig(c => ({ ...c, usa_qr_inquilinos: val ? 'true' : 'false' }));
    try {
      await api.updateConfig({ usa_qr_inquilinos: val ? 'true' : 'false' });
    } catch {
      setConfig(c => ({ ...c, usa_qr_inquilinos: prev }));
    }
  };

  const openEdit = (clave: string, label: string) => {
    setEditValue(config[clave] || '');
    setEditError('');
    setEditModal({ clave, label, value: config[clave] || '' });
  };

  const saveEdit = async () => {
    if (!editModal) return;
    if (!editValue.trim()) { setEditError('Este campo es requerido'); return; }
    const limits = FIELD_LIMITS[editModal.clave];
    if (limits?.numericOnly && editModal.clave === 'banco_clabe' && editValue.length !== 18) {
      setEditError('La CLABE interbancaria debe tener exactamente 18 dígitos'); return;
    }
    setSavingEdit(true);
    setEditError('');
    try {
      await api.updateConfig({ [editModal.clave]: editValue.trim() });
      setConfig(prev => ({ ...prev, [editModal.clave]: editValue.trim() }));
      setEditModal(null);
    } catch (e: any) {
      setEditError(e.message || 'No se pudo guardar');
    } finally {
      setSavingEdit(false);
    }
  };

  const openBackups = async () => {
    setShowBackups(true);
    setLoadingBackups(true);
    setBackupMsg('');
    try {
      const res = await api.getBackups();
      setBackups(res.data || []);
    } catch { setBackups([]); }
    finally { setLoadingBackups(false); }
  };

  const crearBackup = async () => {
    setCreandoBackup(true);
    setBackupMsg('');
    try {
      await api.createManualBackup();
      setBackupMsg('Backup creado exitosamente');
      const res = await api.getBackups();
      setBackups(res.data || []);
    } catch (e: any) {
      setBackupMsg(e.message || 'Error al crear backup');
    } finally {
      setCreandoBackup(false);
    }
  };

  const openAdmins = async () => {
    setShowAdmins(true);
    setLoadingAdmins(true);
    try {
      const res = await api.getUsuarios();
      setAdmins(res.data || []);
    } catch { setAdmins([]); }
    finally { setLoadingAdmins(false); }
  };

  const openVincular = async (userId: string, userName: string) => {
    setVincularModal({ userId, userName });
    setLoadingInquilinos(true);
    try {
      const res = await api.getInquilinos({ estado: 'activo' });
      setInquilinosLista(res.data || []);
    } catch { setInquilinosLista([]); }
    finally { setLoadingInquilinos(false); }
  };

  const vincularA = async (inquilinoId: string) => {
    if (!vincularModal) return;
    setVinculando(true);
    try {
      await api.vincularUsuario(inquilinoId, vincularModal.userId);
      setVincularModal(null);
    } catch (e: any) {
      // Ignore — just close
      setVincularModal(null);
    } finally {
      setVinculando(false);
    }
  };

  const toggleAdmin = async (id: string) => {
    setTogglingId(id);
    try {
      const res = await api.toggleUsuario(id);
      setAdmins(prev => prev.map(a => a.id === id ? { ...a, activo: res.data?.activo } : a));
    } catch { /* ignore */ }
    finally { setTogglingId(null); }
  };

  const eliminarUsuario = async (id: string, nombre: string) => {
    const { Platform, Alert } = await import('react-native');
    const doEliminar = async () => {
      try {
        await api.deleteUsuario(id);
        const res = await api.getUsuarios();
        setAdmins(res.data || []);
      } catch (e: any) {
        if (Platform.OS === 'web') {
          window.alert(e.message || 'No se pudo eliminar el usuario');
        } else {
          Alert.alert('Error', e.message || 'No se pudo eliminar el usuario');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`¿Seguro que deseas eliminar a ${nombre}? Esta acción no se puede deshacer.`)) {
        await doEliminar();
      }
    } else {
      Alert.alert(
        'Eliminar usuario',
        `¿Seguro que deseas eliminar a ${nombre}? Esta acción no se puede deshacer.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: doEliminar },
        ]
      );
    }
  };

  const cambiarRolUsuario = async (id: string, nuevoRol: string) => {
    setCambiandoRolId(id);
    try {
      const res = await api.cambiarRolUsuario(id, nuevoRol);
      setAdmins(prev => prev.map(a => a.id === id ? { ...a, rol: res.data?.rol } : a));
    } catch { /* ignore */ }
    finally { setCambiandoRolId(null); setRolModalUser(null); }
  };

  const openCodigos = async () => {
    setShowCodigos(true);
    setLoadingCodigos(true);
    setCodigoGenerado(null);
    try {
      const res = await api.getCodigosInvitacion();
      setCodigos(res.data || []);
    } catch { setCodigos([]); }
    finally { setLoadingCodigos(false); }
  };

  const generarCodigo = async () => {
    setGenerandoCodigo(true);
    try {
      const res = await api.generarCodigoInvitacion(rolCodigo, expiraDias);
      setCodigoGenerado(res.data);
      setCodigos(prev => [res.data, ...prev]);
    } catch (e: any) {
      // Mostrar error si ocurre
    } finally { setGenerandoCodigo(false); }
  };

  const copiarCodigo = async (codigo: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(codigo);
      }
      setCodigoCopiado(true);
      setTimeout(() => setCodigoCopiado(false), 2000);
    } catch { /* ignore */ }
  };

  const compartirCodigo = async (codigo: string) => {
    try {
      const { Share } = await import('react-native');
      await Share.share({
        message: `Tu código de invitación para NethRent: ${codigo}`,
        title: 'Código de Invitación NethRent',
      });
    } catch { /* ignore */ }
  };

  const revocarCodigo = async (id: string) => {
    try {
      await api.revocarCodigoInvitacion(id);
      setCodigos(prev => prev.filter(c => c.id !== id));
    } catch { /* ignore */ }
  };

  const subirPlantillaManual = async () => {
    try {
      let docxBase64: string | null = null;
      let docxNombre = 'Plantilla_Manual.docx';

      if (Platform.OS === 'web') {
        const result = await new Promise<{ base64: string; name: string } | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          input.onchange = (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = (ev) => resolve({ base64: ev.target?.result as string, name: file.name });
            reader.readAsDataURL(file);
          };
          input.click();
        });
        if (!result) return;
        docxBase64 = result.base64;
        docxNombre = result.name;
      } else {
        const DocumentPicker = await import('expo-document-picker');
        const picked = await DocumentPicker.getDocumentAsync({
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          copyToCacheDirectory: true,
        });
        if (picked.canceled || !picked.assets?.[0]) return;
        const asset = picked.assets[0];
        const FileSystem = await import('expo-file-system');
        const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' as any });
        docxBase64 = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${b64}`;
        docxNombre = asset.name;
      }

      if (!docxBase64) return;

      setSubiendoPlantilla(true);
      setPlantillaError('');

      try {
        await api.uploadContratoTemplate(docxBase64, docxNombre);
        const cfgRes = await api.getConfig();
        setConfig(cfgRes.data || {});
        setShowPlantilla(false);
        const { Alert } = await import('react-native');
        if (Platform.OS === 'web') {
          window.alert('Plantilla manual subida correctamente');
        } else {
          Alert.alert('Éxito', 'Plantilla manual subida correctamente');
        }
      } catch (e: any) {
        setPlantillaError(e.message || 'Error al subir la plantilla');
      } finally {
        setSubiendoPlantilla(false);
      }
    } catch {
      setSubiendoPlantilla(false);
    }
  };

  const subirPlantilla = async () => {
    try {
      let docxBase64: string | null = null;

      if (Platform.OS === 'web') {
        const result = await new Promise<{ base64: string } | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          input.onchange = (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = (ev) => resolve({ base64: ev.target?.result as string });
            reader.readAsDataURL(file);
          };
          input.click();
        });
        if (!result) return;
        docxBase64 = result.base64;
      } else {
        const DocumentPicker = await import('expo-document-picker');
        const picked = await DocumentPicker.getDocumentAsync({
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          copyToCacheDirectory: true,
        });
        if (picked.canceled || !picked.assets?.[0]) return;
        const asset = picked.assets[0];
        const FileSystem = await import('expo-file-system');
        const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' as any });
        docxBase64 = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${b64}`;
      }

      if (!docxBase64) return;

      // Paso 2: procesando con IA
      setPlantillaError('');
      setPlantillaStep('procesando');
      setSubiendoPlantilla(true);

      try {
        const res = await api.procesarContratoIA(docxBase64);
        if (res.data?.htmlTemplate) {
          setHtmlTemplate(res.data.htmlTemplate);
          setPlantillaStep('preview');
        } else {
          throw new Error('La IA no devolvió resultado');
        }
      } catch (e: any) {
        setPlantillaError(e.message || 'Error al procesar el documento');
        setPlantillaStep('inicio');
      } finally {
        setSubiendoPlantilla(false);
      }
    } catch {
      setSubiendoPlantilla(false);
      setPlantillaStep('inicio');
    }
  };

  const verPreviewPdf = async () => {
    if (!htmlTemplate) return;
    try {
      if (Platform.OS === 'web') {
        // POST con fetch directo para abrir en nueva pestaña
        const token = api.getToken();
        const resp = await fetch(api.getPreviewContratoPdfUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ htmlTemplate }),
        });
        if (!resp.ok) throw new Error('Error al generar preview');
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    } catch (e: any) {
      setPlantillaError(e.message || 'No se pudo generar el preview');
    }
  };

  const descargarParaEditar = async () => {
    if (!htmlTemplate) return;
    try {
      if (Platform.OS === 'web') {
        const token = api.getToken();
        const resp = await fetch(api.getDescargarContratoDocxUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ htmlTemplate }),
        });
        if (!resp.ok) throw new Error('Error al generar .docx');
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'plantilla_con_variables.docx'; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      setPlantillaError(e.message || 'No se pudo descargar el archivo');
    }
  };

  const guardarPlantilla = async () => {
    if (!htmlTemplate) return;
    setGuardandoPlantilla(true);
    setPlantillaError('');
    try {
      await api.guardarHtmlTemplate(htmlTemplate);
      setConfig(prev => ({ ...prev, contrato_html_template: '__existe__' }));
      setShowPlantilla(false);
      setPlantillaStep('inicio');
      setHtmlTemplate(null);
    } catch (e: any) {
      setPlantillaError(e.message || 'No se pudo guardar la plantilla');
    } finally {
      setGuardandoPlantilla(false);
    }
  };

  const eliminarPlantilla = async () => {
    const { Alert } = await import('react-native');
    const doBorrar = async () => {
      setBorrandoPlantilla(true);
      try {
        await api.deleteContratoTemplate();
        setConfig(prev => {
          const next = { ...prev };
          delete next['contrato_docx_template'];
          delete next['contrato_docx_nombre'];
          delete next['contrato_html_template'];
          return next;
        });
        if (Platform.OS === 'web') window.alert('Plantilla eliminada — se usará la plantilla por defecto.');
      } catch (e: any) {
        const msg = e?.message || 'No se pudo eliminar la plantilla';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
      } finally {
        setBorrandoPlantilla(false);
      }
    };

    const mensaje = '¿Seguro? Se usará la plantilla por defecto del sistema.';
    if (Platform.OS === 'web') {
      if (window.confirm(mensaje)) await doBorrar();
    } else {
      Alert.alert('Eliminar plantilla', mensaje, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: doBorrar },
      ]);
    }
  };

  // ── Editor de contrato ──────────────────────────────────────────────
  const abrirEditor = (initialHtml: string) => {
    setEditorHtml(initialHtml || '');
    setEditorError('');
    setShowEditor(true);
  };

  const previewEditorPdf = async () => {
    if (!editorHtml.trim()) { setEditorError('El contrato está vacío'); return; }
    if (Platform.OS !== 'web') {
      setEditorError('La vista previa PDF está disponible en la versión web');
      return;
    }
    try {
      const token = api.getToken();
      const resp = await fetch(api.getPreviewContratoPdfUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ htmlTemplate: editorHtml }),
      });
      if (!resp.ok) throw new Error('Error al generar preview');
      const blob = await resp.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e: any) {
      setEditorError(e.message || 'No se pudo generar el preview');
    }
  };

  const guardarEditor = async () => {
    if (!editorHtml.trim()) { setEditorError('El contrato está vacío'); return; }
    setGuardandoEditor(true);
    setEditorError('');
    try {
      await api.guardarHtmlTemplate(editorHtml);
      setConfig(prev => ({ ...prev, contrato_html_template: editorHtml }));
      setShowEditor(false);
      setShowPlantilla(false);
      setPlantillaStep('inicio');
      setHtmlTemplate(null);
    } catch (e: any) {
      setEditorError(e.message || 'No se pudo guardar el contrato');
    } finally {
      setGuardandoEditor(false);
    }
  };

  // ── Cuentas bancarias ───────────────────────────────────────────────
  const openCuentas = async () => {
    setShowCuentas(true);
    setLoadingCuentas(true);
    try {
      const res = await api.getCuentasBancarias();
      setCuentas(res.data || []);
    } catch { setCuentas([]); }
    finally { setLoadingCuentas(false); }
  };

  const nuevaCuenta = () => {
    setCuentaError('');
    setCuentaForm({ alias: '', banco_nombre: '', banco_clabe: '', banco_titular: '' });
  };

  const editarCuenta = (c: any) => {
    setCuentaError('');
    setCuentaForm({
      id: c.id, alias: c.alias || '', banco_nombre: c.banco_nombre || '',
      banco_clabe: c.banco_clabe || '', banco_titular: c.banco_titular || '',
    });
  };

  const guardarCuenta = async () => {
    if (!cuentaForm) return;
    if (cuentaForm.banco_clabe.length !== 18) { setCuentaError('La CLABE debe tener 18 dígitos'); return; }
    setGuardandoCuenta(true);
    setCuentaError('');
    try {
      if (cuentaForm.id) {
        await api.updateCuentaBancaria(cuentaForm.id, {
          alias: cuentaForm.alias, banco_nombre: cuentaForm.banco_nombre,
          banco_clabe: cuentaForm.banco_clabe, banco_titular: cuentaForm.banco_titular,
        });
      } else {
        await api.createCuentaBancaria({
          alias: cuentaForm.alias, banco_nombre: cuentaForm.banco_nombre,
          banco_clabe: cuentaForm.banco_clabe, banco_titular: cuentaForm.banco_titular,
        });
      }
      const res = await api.getCuentasBancarias();
      setCuentas(res.data || []);
      setCuentaForm(null);
    } catch (e: any) {
      setCuentaError(e.message || 'No se pudo guardar la cuenta');
    } finally {
      setGuardandoCuenta(false);
    }
  };

  const marcarDefaultCuenta = async (id: string) => {
    try {
      await api.setCuentaDefault(id);
      const res = await api.getCuentasBancarias();
      setCuentas(res.data || []);
    } catch { /* ignore */ }
  };

  const eliminarCuenta = async (id: string) => {
    const { Alert } = await import('react-native');
    Alert.alert('Eliminar cuenta', '¿Seguro que deseas eliminar esta cuenta bancaria?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteCuentaBancaria(id);
            const res = await api.getCuentasBancarias();
            setCuentas(res.data || []);
          } catch { /* ignore */ }
        },
      },
    ]);
  };

  const abrirNuevoUsuario = () => {
    setNuNombre(''); setNuEmail(''); setNuPassword('');
    setNuRol('admin'); setNuError('');
    setShowNuevoUsuario(true);
  };

  const crearUsuario = async () => {
    if (!nuNombre.trim()) { setNuError('El nombre es requerido'); return; }
    if (!nuEmail.trim() || !nuEmail.includes('@')) { setNuError('Ingresa un email válido'); return; }
    if (nuPassword.length < 8) { setNuError('La contraseña debe tener al menos 8 caracteres'); return; }
    setNuError('');
    setCreandoUsuario(true);
    try {
      await api.createUsuario({ nombre_completo: nuNombre.trim(), email: nuEmail.trim(), password: nuPassword, rol: nuRol });
      setShowNuevoUsuario(false);
      // Refresh list
      const res = await api.getUsuarios();
      setAdmins(res.data || []);
    } catch (e: any) {
      setNuError(e.message || 'No se pudo crear el usuario');
    } finally {
      setCreandoUsuario(false);
    }
  };

  const handleLogout = () => {
    removeItem(TOKEN_KEY);
    removeItem(USER_KEY);
    api.setToken(null);
    router.replace('/(auth)/login');
  };

  const fmtBytes = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const fmtDate = (str: string) =>
    str ? new Date(str).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const SettingRow = ({ icon, title, subtitle, hasSwitch, switchValue, onSwitchChange, onPress, iconColor }: any) => (
    <TouchableOpacity
      style={[styles.settingRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
      onPress={onPress}
      disabled={hasSwitch}
      activeOpacity={hasSwitch ? 1 : 0.6}
    >
      <View style={[styles.settingIconContainer, { backgroundColor: (iconColor || theme.primary) + '20' }]}>
        <Ionicons name={icon} size={20} color={iconColor || theme.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {hasSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ true: theme.primary, false: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }}
          thumbColor="#fff"
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      )}
    </TouchableOpacity>
  );

  const Section = ({ icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <SurfaceCard style={styles.sectionCard} padding={0}>
      <View style={[styles.sectionHead, { borderBottomColor: theme.border }]}>
        <Text style={[styles.sectionHeadTitle, { color: theme.textMuted }]}>{title}</Text>
        <Ionicons name={icon} size={15} color={theme.textMuted} />
      </View>
      {children}
    </SurfaceCard>
  );

  const rolesActivos = admins.length
    ? {
        admin: admins.filter(a => a.rol === 'admin').length,
        cobrador: admins.filter(a => a.rol === 'cobrador').length,
        inquilino: admins.filter(a => a.rol === 'inquilino').length,
      }
    : null;

  const leftSections = (
    <>
      <Section icon="business-outline" title="DATOS DE LA PROPIEDAD Y ADMINISTRADOR">
        <SettingRow
          icon="person"
          title="Nombre del Arrendador"
          subtitle={loadingConfig ? 'Cargando…' : (config['arrendador_nombre'] || 'Sin configurar')}
          onPress={() => openEdit('arrendador_nombre', 'Nombre del Arrendador')}
        />
        <SettingRow
          icon="location"
          title="Dirección de la Propiedad"
          subtitle={loadingConfig ? 'Cargando…' : (config['arrendador_direccion'] || 'Sin configurar')}
          onPress={() => openEdit('arrendador_direccion', 'Dirección de la Propiedad')}
        />
        <SettingRow
          icon="qr-code"
          iconColor="#3B82F6"
          title="URL de la App"
          subtitle={loadingConfig ? 'Cargando…' : (config['app_url'] || 'Sin configurar — necesaria para QR de pagos')}
          onPress={() => openEdit('app_url', 'URL de la App')}
        />
      </Section>

      <Section icon="cash-outline" title="PARÁMETROS DE COBRANZA Y FACTURACIÓN">
        <SettingRow
          icon="time"
          iconColor={theme.warning}
          title="Días de gracia para retraso"
          subtitle={loadingConfig
            ? 'Cargando…'
            : `${config['dias_gracia_retraso'] || '0'} día${(config['dias_gracia_retraso'] || '0') === '1' ? '' : 's'} después de la fecha de pago`}
          onPress={() => openEdit('dias_gracia_retraso', 'Días de gracia para retraso')}
        />
        <SettingRow
          icon="card"
          iconColor="#10B981"
          title="Cuentas Bancarias (SPEI)"
          subtitle="Administra varias cuentas y asígnalas a cada departamento"
          onPress={openCuentas}
        />
      </Section>

      <Section icon="document-text-outline" title="PROPIEDAD Y CONTRATOS">
        <SettingRow
          icon="document-text"
          title="Ver Contratos"
          subtitle="Generar e imprimir contratos"
          onPress={() => router.push('/(admin)/contratos' as any)}
        />
        <SettingRow
          icon="document-attach"
          iconColor="#3B82F6"
          title="Plantilla de Contrato"
          subtitle={
            loadingConfig ? 'Cargando…'
            : (config['contrato_html_template'] || config['contrato_docx_template'])
              ? '✓ Plantilla personalizada activa'
              : 'Toca para subir tu contrato Word'
          }
          onPress={() => setShowPlantilla(true)}
        />
      </Section>
    </>
  );

  const rightSections = (
    <>
      <Section icon="flash-outline" title="AUTOMATIZACIONES Y NOTIFICACIONES">
        <SettingRow
          icon="notifications"
          title="Notificaciones Push"
          subtitle={
            notifBlocked
              ? 'Bloqueadas por el navegador — actívalas en Ajustes del sitio'
              : notifEnabled ? 'Activadas' : 'Desactivadas'
          }
          hasSwitch
          switchValue={notifEnabled && !notifBlocked}
          onSwitchChange={handleNotifToggle}
        />
        <SettingRow
          icon="qr-code"
          title="¿Usas la app con tus inquilinos?"
          subtitle={
            loadingConfig ? 'Cargando…'
              : (config['usa_qr_inquilinos'] !== 'false'
                  ? 'Sí — flujo de QR y Escanear activo'
                  : 'No — solo registro manual de pagos')
          }
          hasSwitch
          switchValue={config['usa_qr_inquilinos'] !== 'false'}
          onSwitchChange={handleUsaQrToggle}
        />
      </Section>

      <Section icon="shield-checkmark-outline" title="SEGURIDAD Y ACCESO">
        {rolesActivos && (
          <View style={styles.rolesGrid}>
            {[
              { n: rolesActivos.admin, l: 'ADMIN' },
              { n: rolesActivos.cobrador, l: 'MANTEN.' },
              { n: rolesActivos.inquilino, l: 'INQUILINOS' },
            ].map(r => (
              <View key={r.l} style={[styles.roleCell, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)' }]}>
                <Text style={[styles.roleNum, { color: theme.text }]}>{r.n}</Text>
                <Text style={[styles.roleLabel, { color: theme.textMuted }]}>{r.l}</Text>
              </View>
            ))}
          </View>
        )}
        <SettingRow
          icon="ticket"
          iconColor="#3B82F6"
          title="Códigos de Invitación"
          subtitle="Genera códigos para invitar inquilinos o cobradores"
          onPress={openCodigos}
        />
        <SettingRow
          icon="key"
          iconColor={theme.warning}
          title="Código de Invitación (Admin)"
          subtitle={loadingConfig
            ? 'Cargando…'
            : config['admin_invite_code'] ? '••••••••  (configurado)' : 'Sin configurar'}
          onPress={() => openEdit('admin_invite_code', 'Código de Invitación de Administrador')}
        />
        <SettingRow
          icon="people"
          title="Gestión de Usuarios"
          subtitle="Ver y gestionar cuentas y roles"
          onPress={openAdmins}
        />
      </Section>

      <Section icon="server-outline" title="SISTEMA">
        <SettingRow
          icon="server"
          title="Backups e Historial"
          subtitle="Respaldos de la base de datos"
          onPress={openBackups}
        />
      </Section>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#0E1321', '#1A1F2E'] : ['#F8FAFC', '#F1F5F9']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && { maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: 40, paddingTop: 24 },
          { paddingBottom: isDesktop ? 40 : insets.bottom + Theme.layout.dockHeight },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, isDesktop && styles.headerDesktop, !isDesktop && { paddingTop: insets.top + 20 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Configuración y Parámetros</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Reglas de negocio, notificaciones y accesos</Text>
          </View>
        </View>

        {/* Perfil */}
        <SurfaceCard style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
            <Text style={[styles.profileEmail, { color: theme.textSecondary }]} numberOfLines={1}>{email}</Text>
          </View>
        </SurfaceCard>

        {isDesktop ? (
          <View style={styles.bento}>
            <View style={styles.bentoCol}>{leftSections}</View>
            <View style={styles.bentoCol}>{rightSections}</View>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {leftSections}
            {rightSections}
          </View>
        )}

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.danger + '10', borderColor: theme.danger + '30' }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.danger} style={styles.logoutIcon} />
          <Text style={[styles.logoutText, { color: theme.danger }]}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: theme.textSecondary }]}>NethRent v1.0</Text>
      </ScrollView>

      {/* Modal editar config */}
      <Modal visible={!!editModal} transparent animationType="fade" onRequestClose={() => setEditModal(null)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalBox} borderRadius={Theme.borderRadius.xl} padding={28}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{editModal?.label}</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: editError ? theme.danger : theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
              value={editValue}
              onChangeText={t => {
                const limits = editModal ? FIELD_LIMITS[editModal.clave] : undefined;
                let next = limits?.numericOnly ? t.replace(/\D/g, '') : t;
                if (limits?.maxLength) next = next.slice(0, limits.maxLength);
                setEditValue(next);
                setEditError('');
              }}
              placeholder={`Ingresa ${editModal?.label?.toLowerCase()}...`}
              placeholderTextColor={theme.textSecondary}
              autoFocus
              multiline={editModal?.clave === 'arrendador_direccion'}
              numberOfLines={editModal?.clave === 'arrendador_direccion' ? 3 : 1}
              keyboardType={editModal && FIELD_LIMITS[editModal.clave]?.numericOnly ? 'numeric' : 'default'}
              maxLength={editModal ? FIELD_LIMITS[editModal.clave]?.maxLength : undefined}
            />
            {editModal && FIELD_LIMITS[editModal.clave] && (
              <Text style={[styles.charCounter, {
                color: editValue.length >= (FIELD_LIMITS[editModal.clave]?.maxLength ?? Infinity)
                  ? theme.danger
                  : theme.textSecondary
              }]}>
                {editValue.length}/{FIELD_LIMITS[editModal.clave]?.maxLength}
                {FIELD_LIMITS[editModal.clave]?.numericOnly ? ' · Solo dígitos' : ''}
              </Text>
            )}
            {editError ? (
              <View style={[styles.errorBox, { backgroundColor: theme.danger + '15', borderColor: theme.danger + '30' }]}>
                <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>{editError}</Text>
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderWidth: 1, borderColor: theme.border }]}
                onPress={() => setEditModal(null)}
                disabled={savingEdit}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.primary, opacity: savingEdit ? 0.7 : 1 }]}
                onPress={saveEdit}
                disabled={savingEdit}
              >
                {savingEdit
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar</Text>
                }
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Modal backups */}
      <Modal visible={showBackups} transparent animationType="fade" onRequestClose={() => setShowBackups(false)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalBox, { maxHeight: '80%' }]} borderRadius={Theme.borderRadius.xl} padding={0}>
            <View style={[styles.sheetHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Backups e Historial</Text>
              <TouchableOpacity onPress={() => setShowBackups(false)}>
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.sheetBody}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: creandoBackup ? 0.7 : 1 }]}
                onPress={crearBackup}
                disabled={creandoBackup}
              >
                {creandoBackup
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                }
                <Text style={styles.primaryBtnText}>{creandoBackup ? 'Creando backup…' : 'Crear Backup Manual'}</Text>
              </TouchableOpacity>

              {backupMsg ? (
                <Text style={[styles.backupMsg, { color: backupMsg.includes('Error') ? theme.danger : theme.success }]}>
                  {backupMsg}
                </Text>
              ) : null}

              {loadingBackups ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />
              ) : backups.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Sin backups registrados</Text>
              ) : (
                <ScrollView style={styles.backupList} showsVerticalScrollIndicator={false}>
                  {backups.map((b, i) => (
                    <View key={i} style={[styles.backupItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                      <View style={[styles.backupTypeIcon, { backgroundColor: b.tipo === 'manual' ? theme.primary + '20' : theme.success + '20' }]}>
                        <Ionicons name={b.tipo === 'manual' ? 'person' : 'time'} size={16} color={b.tipo === 'manual' ? theme.primary : theme.success} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.backupName, { color: theme.text }]} numberOfLines={1}>{b.archivo || 'backup'}</Text>
                        <Text style={[styles.backupMeta, { color: theme.textSecondary }]}>
                          {fmtDate(b.created_at)} · {fmtBytes(b.tamano_bytes)}
                        </Text>
                      </View>
                      <View style={[styles.backupTypeBadge, { backgroundColor: b.tipo === 'manual' ? theme.primary + '20' : theme.success + '20' }]}>
                        <Text style={[styles.backupTypeText, { color: b.tipo === 'manual' ? theme.primary : theme.success }]}>
                          {b.tipo?.toUpperCase() || 'AUTO'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Modal administradores */}
      <Modal visible={showAdmins} transparent animationType="fade" onRequestClose={() => setShowAdmins(false)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalBox, { maxHeight: '80%' }]} borderRadius={Theme.borderRadius.xl} padding={0}>
            <View style={[styles.sheetHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Usuarios</Text>
              <View style={styles.sheetHeaderActions}>
                <TouchableOpacity
                  style={[styles.addUserBtn, { backgroundColor: theme.primary }]}
                  onPress={abrirNuevoUsuario}
                >
                  <Ionicons name="person-add-outline" size={16} color="#fff" />
                  <Text style={styles.addUserBtnText}>Nuevo</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowAdmins(false)}>
                  <Ionicons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sheetBody}>
              {/* Buscador */}
              <View style={[styles.searchRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}>
                <Ionicons name="search-outline" size={16} color={theme.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  value={busquedaUsuario}
                  onChangeText={setBusquedaUsuario}
                  placeholder="Buscar por nombre o correo…"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                />
                {busquedaUsuario.length > 0 && (
                  <TouchableOpacity onPress={() => setBusquedaUsuario('')}>
                    <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {loadingAdmins ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />
              ) : admins.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Sin usuarios registrados</Text>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
                  {admins
                    .filter(a => {
                      const q = busquedaUsuario.toLowerCase();
                      if (!q) return true;
                      return (a.nombre_completo || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q);
                    })
                    .map((a) => {
                      const ini = (a.nombre_completo || 'A').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                      const isToggling = togglingId === a.id;
                      const rolColor = a.rol === 'admin' ? theme.primary : a.rol === 'cobrador' ? '#10B981' : '#F59E0B';
                      const rolLabel = a.rol === 'admin' ? 'ADMIN' : a.rol === 'cobrador' ? 'COBRADOR' : 'INQUILINO';
                      const isSelf = a.id === getStoredUser()?.id;
                      return (
                        <View key={a.id} style={[styles.adminItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                          <View style={[styles.adminAvatar, { backgroundColor: rolColor }]}>
                            <Text style={styles.adminAvatarText}>{ini}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.adminNameRow}>
                              <Text style={[styles.adminName, { color: theme.text }]} numberOfLines={1}>{a.nombre_completo}</Text>
                              <TouchableOpacity
                                style={[styles.rolBadge, { backgroundColor: rolColor + '25', opacity: isSelf ? 0.5 : 1 }]}
                                onPress={() => { if (!isSelf) setRolModalUser(a); }}
                                disabled={isSelf}
                              >
                                <Text style={[styles.rolBadgeText, { color: rolColor }]}>{rolLabel} {isSelf ? '' : '▾'}</Text>
                              </TouchableOpacity>
                            </View>
                            <Text style={[styles.adminEmail, { color: theme.textSecondary }]}>{a.email}</Text>
                          </View>
                          <View style={{ gap: 6 }}>
                            {a.rol === 'inquilino' && (
                              <TouchableOpacity
                                style={[styles.toggleBtn, { backgroundColor: theme.primary + '20' }]}
                                onPress={() => openVincular(a.id, a.nombre_completo)}
                              >
                                <Ionicons name="link-outline" size={16} color={theme.primary} />
                                <Text style={[styles.toggleBtnText, { color: theme.primary }]}>Vincular</Text>
                              </TouchableOpacity>
                            )}
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                              <TouchableOpacity
                                style={[
                                  styles.toggleBtn,
                                  { flex: 1, backgroundColor: a.activo ? theme.success + '20' : theme.danger + '20', opacity: isSelf ? 0.5 : 1 }
                                ]}
                                onPress={() => toggleAdmin(a.id)}
                                disabled={isToggling || isSelf}
                              >
                                {isToggling
                                  ? <ActivityIndicator size="small" color={a.activo ? theme.success : theme.danger} />
                                  : <Ionicons
                                      name={a.activo ? 'checkmark-circle' : 'close-circle'}
                                      size={18}
                                      color={a.activo ? theme.success : theme.danger}
                                    />
                                }
                                <Text style={[styles.toggleBtnText, { color: a.activo ? theme.success : theme.danger }]}>
                                  {a.activo ? 'Activo' : 'Inactivo'}
                                </Text>
                              </TouchableOpacity>

                              {a.id !== getStoredUser()?.id && (
                                <TouchableOpacity
                                  style={[styles.toggleBtn, { paddingHorizontal: 12, backgroundColor: theme.danger + '20' }]}
                                  onPress={() => eliminarUsuario(a.id, a.nombre_completo)}
                                >
                                  <Ionicons name="trash-outline" size={18} color={theme.danger} />
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                </ScrollView>
              )}
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Modal vincular inquilino */}
      <Modal visible={!!vincularModal} transparent animationType="fade" onRequestClose={() => setVincularModal(null)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalBox, { maxHeight: '70%' }]} borderRadius={Theme.borderRadius.xl} padding={0}>
            <View style={[styles.sheetHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Vincular a departamento</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary, marginTop: 4 }]} numberOfLines={1}>
                  {vincularModal?.userName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setVincularModal(null)}>
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.sheetBody}>
              {loadingInquilinos ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 12 }} />
              ) : inquilinosLista.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Sin inquilinos activos disponibles</Text>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {inquilinosLista.map(inq => (
                    <TouchableOpacity
                      key={inq.id}
                      style={[styles.backupItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
                      onPress={() => vincularA(inq.id)}
                      disabled={vinculando}
                    >
                      <View style={[styles.backupTypeIcon, { backgroundColor: theme.primary + '20' }]}>
                        <Ionicons name="home-outline" size={16} color={theme.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.backupName, { color: theme.text }]}>{inq.nombre_completo}</Text>
                        <Text style={[styles.backupMeta, { color: theme.textSecondary }]}>
                          Depto {inq.depto_numero} · ${Number(inq.renta).toLocaleString('es-MX')}/mes
                        </Text>
                      </View>
                      {vinculando
                        ? <ActivityIndicator size="small" color={theme.primary} />
                        : <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                      }
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Modal cambiar rol */}
      <Modal visible={!!rolModalUser} transparent animationType="fade" onRequestClose={() => setRolModalUser(null)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalBox, { maxWidth: 340 }]} borderRadius={Theme.borderRadius.xl} padding={24}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Cambiar rol</Text>
            <Text style={[{ color: theme.textSecondary, fontSize: 13, marginBottom: 16 }]}>
              {rolModalUser?.nombre_completo}
            </Text>
            {(['admin', 'cobrador', 'inquilino'] as const).map(r => {
              const color = r === 'admin' ? theme.primary : r === 'cobrador' ? '#10B981' : '#F59E0B';
              const icons = { admin: 'shield-checkmark', cobrador: 'cash', inquilino: 'person' } as const;
              const labels = { admin: 'Administrador', cobrador: 'Cobrador', inquilino: 'Inquilino' };
              const isCurrent = rolModalUser?.rol === r;
              const isSelf = rolModalUser?.id === getStoredUser()?.id;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.rolOption, {
                    marginBottom: 8,
                    backgroundColor: isCurrent ? color + '20' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                    borderColor: isCurrent ? color : theme.border,
                    opacity: (isSelf || cambiandoRolId === rolModalUser?.id) ? 0.5 : 1,
                  }]}
                  onPress={() => !isCurrent && !isSelf && cambiarRolUsuario(rolModalUser!.id, r)}
                  disabled={isCurrent || !!isSelf || !!cambiandoRolId}
                >
                  <Ionicons name={icons[r]} size={16} color={isCurrent ? color : theme.textSecondary} />
                  <Text style={[styles.rolOptionText, { color: isCurrent ? color : theme.text }]}>{labels[r]}</Text>
                  {isCurrent && <Ionicons name="checkmark" size={14} color={color} style={{ marginLeft: 'auto' as any }} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.modalBtn, { borderWidth: 1, borderColor: theme.border, marginTop: 4 }]}
              onPress={() => setRolModalUser(null)}
            >
              <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      {/* Modal códigos de invitación */}
      <Modal visible={showCodigos} transparent animationType="fade" onRequestClose={() => setShowCodigos(false)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalBox, { maxHeight: '85%' }]} borderRadius={Theme.borderRadius.xl} padding={0}>
            <View style={[styles.sheetHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Códigos de Invitación</Text>
              <View style={styles.sheetHeaderActions}>
                <TouchableOpacity
                  style={[styles.addUserBtn, { backgroundColor: '#3B82F6' }]}
                  onPress={() => { setCodigoGenerado(null); setRolCodigo('inquilino'); setExpiraDias(7); setShowGenerarCodigo(true); }}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.addUserBtnText}>Generar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowCodigos(false)}>
                  <Ionicons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sheetBody}>
              {loadingCodigos ? (
                <ActivityIndicator size="small" color="#3B82F6" style={{ marginTop: 20 }} />
              ) : codigos.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Sin códigos generados aún</Text>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                  {codigos.map(c => {
                    const rolColor = c.rol === 'cobrador' ? '#10B981' : '#F59E0B';
                    const vencido = c.expira_en && new Date(c.expira_en) < new Date();
                    const diasRestantes = c.expira_en
                      ? Math.ceil((new Date(c.expira_en).getTime() - Date.now()) / 86400000)
                      : null;
                    return (
                      <View key={c.id} style={[styles.backupItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', opacity: (c.usado || vencido) ? 0.5 : 1 }]}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={[{ fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: 1, color: theme.text }]}>
                              {c.codigo}
                            </Text>
                            <View style={[styles.rolBadge, { backgroundColor: rolColor + '20' }]}>
                              <Text style={[styles.rolBadgeText, { color: rolColor }]}>{c.rol.toUpperCase()}</Text>
                            </View>
                            {c.usado && (
                              <View style={[styles.rolBadge, { backgroundColor: theme.success + '20' }]}>
                                <Text style={[styles.rolBadgeText, { color: theme.success }]}>USADO</Text>
                              </View>
                            )}
                            {!c.usado && vencido && (
                              <View style={[styles.rolBadge, { backgroundColor: theme.danger + '20' }]}>
                                <Text style={[styles.rolBadgeText, { color: theme.danger }]}>EXPIRADO</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.backupMeta, { color: theme.textSecondary }]}>
                            {c.usado
                              ? `Usado por ${c.usado_por_nombre || 'usuario'}`
                              : c.expira_en
                                ? vencido ? 'Expirado' : `Vence en ${diasRestantes}d`
                                : 'Sin vencimiento'}
                          </Text>
                        </View>
                        {!c.usado && !vencido && (
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              style={[styles.toggleBtn, { backgroundColor: '#3B82F620' }]}
                              onPress={() => copiarCodigo(c.codigo)}
                            >
                              <Ionicons name="copy-outline" size={14} color="#3B82F6" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.toggleBtn, { backgroundColor: theme.danger + '20' }]}
                              onPress={() => revocarCodigo(c.id)}
                            >
                              <Ionicons name="trash-outline" size={14} color={theme.danger} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Modal generar nuevo código */}
      <Modal visible={showGenerarCodigo} transparent animationType="fade" onRequestClose={() => setShowGenerarCodigo(false)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalBox} borderRadius={Theme.borderRadius.xl} padding={24}>
            {codigoGenerado ? (
              // ── Vista del código generado ──
              <>
                <Text style={[styles.modalTitle, { color: theme.text, textAlign: 'center' }]}>¡Código generado!</Text>
                <View style={[{
                  alignItems: 'center', backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
                  borderRadius: 16, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: '#3B82F640',
                }]}>
                  <Text style={{ fontSize: 32, fontWeight: '900', letterSpacing: 4, color: '#3B82F6', fontVariant: ['tabular-nums'] }}>
                    {codigoGenerado.codigo}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <View style={[styles.rolBadge, { backgroundColor: (codigoGenerado.rol === 'cobrador' ? '#10B981' : '#F59E0B') + '25' }]}>
                      <Text style={[styles.rolBadgeText, { color: codigoGenerado.rol === 'cobrador' ? '#10B981' : '#F59E0B' }]}>
                        {codigoGenerado.rol.toUpperCase()}
                      </Text>
                    </View>
                    <View style={[styles.rolBadge, { backgroundColor: theme.primary + '20' }]}>
                      <Text style={[styles.rolBadgeText, { color: theme.primary }]}>
                        {codigoGenerado.expira_en
                          ? `Vence ${new Date(codigoGenerado.expira_en).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}`
                          : 'Sin vencimiento'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { borderWidth: 1, borderColor: '#3B82F660', backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)' }]}
                    onPress={() => copiarCodigo(codigoGenerado.codigo)}
                  >
                    <Ionicons name={codigoCopiado ? 'checkmark' : 'copy-outline'} size={16} color="#3B82F6" />
                    <Text style={{ color: '#3B82F6', fontWeight: '700' }}>{codigoCopiado ? '¡Copiado!' : 'Copiar'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#3B82F6' }]}
                    onPress={() => compartirCodigo(codigoGenerado.codigo)}
                  >
                    <Ionicons name="share-outline" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Compartir</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[{ alignItems: 'center', marginTop: 12 }]}
                  onPress={() => setShowGenerarCodigo(false)}
                >
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Cerrar</Text>
                </TouchableOpacity>
              </>
            ) : (
              // ── Formulario de configuración ──
              <>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Nuevo Código de Invitación</Text>

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Rol del invitado</Text>
                <View style={[styles.rolSelector, { marginBottom: 16 }]}>
                  {(['inquilino', 'cobrador'] as const).map(r => {
                    const color = r === 'cobrador' ? '#10B981' : '#F59E0B';
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[styles.rolOption, {
                          backgroundColor: rolCodigo === r ? color + '20' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                          borderColor: rolCodigo === r ? color : theme.border,
                        }]}
                        onPress={() => setRolCodigo(r)}
                      >
                        <Ionicons name={r === 'cobrador' ? 'cash' : 'person'} size={16} color={rolCodigo === r ? color : theme.textSecondary} />
                        <Text style={[styles.rolOptionText, { color: rolCodigo === r ? color : theme.textSecondary }]}>
                          {r === 'cobrador' ? 'Cobrador' : 'Inquilino'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Vigencia</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  {[
                    { label: '1 día', dias: 1 },
                    { label: '7 días', dias: 7 },
                    { label: '1 mes', dias: 30 },
                    { label: 'Indefinido', dias: null },
                  ].map(opt => (
                    <TouchableOpacity
                      key={String(opt.dias)}
                      style={[{
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
                        backgroundColor: expiraDias === opt.dias ? '#3B82F620' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                        borderColor: expiraDias === opt.dias ? '#3B82F6' : theme.border,
                      }]}
                      onPress={() => setExpiraDias(opt.dias)}
                    >
                      <Text style={{ color: expiraDias === opt.dias ? '#3B82F6' : theme.text, fontWeight: '600', fontSize: 13 }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { borderWidth: 1, borderColor: theme.border }]}
                    onPress={() => setShowGenerarCodigo(false)}
                    disabled={generandoCodigo}
                  >
                    <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#3B82F6', opacity: generandoCodigo ? 0.7 : 1 }]}
                    onPress={generarCodigo}
                    disabled={generandoCodigo}
                  >
                    {generandoCodigo
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={{ color: '#fff', fontWeight: '700' }}>Generar Código</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}
          </GlassCard>
        </View>
      </Modal>

      {/* Modal nuevo usuario */}
      <Modal visible={showNuevoUsuario} transparent animationType="fade" onRequestClose={() => setShowNuevoUsuario(false)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalBox} borderRadius={Theme.borderRadius.xl} padding={28}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Nuevo Usuario</Text>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Nombre completo *</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
              value={nuNombre}
              onChangeText={t => { setNuNombre(t); setNuError(''); }}
              placeholder="Nombre completo"
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Correo electrónico *</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
              value={nuEmail}
              onChangeText={t => { setNuEmail(t); setNuError(''); }}
              placeholder="correo@ejemplo.com"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Contraseña * (mín. 8 caracteres)</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
              value={nuPassword}
              onChangeText={t => { setNuPassword(t); setNuError(''); }}
              placeholder="Contraseña"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Rol</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {([
                { r: 'admin',    label: 'Administrador', icon: 'shield-checkmark', color: theme.primary },
                { r: 'cobrador', label: 'Cobrador',       icon: 'cash',             color: '#10B981' },
                { r: 'inquilino',label: 'Inquilino',      icon: 'person',           color: '#F59E0B' },
              ] as const).map(({ r, label, icon, color }) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.rolOption, { flex: 0, paddingHorizontal: 12 },
                    {
                      backgroundColor: nuRol === r ? color + '20' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                      borderColor: nuRol === r ? color : theme.border,
                    }
                  ]}
                  onPress={() => setNuRol(r)}
                >
                  <Ionicons name={icon} size={15} color={nuRol === r ? color : theme.textSecondary} />
                  <Text style={[styles.rolOptionText, { color: nuRol === r ? color : theme.textSecondary }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {nuError ? (
              <View style={[styles.errorBox, { backgroundColor: theme.danger + '15', borderColor: theme.danger + '30' }]}>
                <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>{nuError}</Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderWidth: 1, borderColor: theme.border }]}
                onPress={() => setShowNuevoUsuario(false)}
                disabled={creandoUsuario}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.primary, opacity: creandoUsuario ? 0.7 : 1 }]}
                onPress={crearUsuario}
                disabled={creandoUsuario}
              >
                {creandoUsuario
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '700' }}>Crear Usuario</Text>
                }
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* ── Modal: Plantilla de Contrato con IA ───────────────────────── */}
      <Modal visible={showPlantilla} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalBox, { maxHeight: '90%' }]} padding={0}>

            {/* Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Plantilla de Contrato</Text>
                {/* Pasos */}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  {(['inicio', 'procesando', 'preview'] as const).map((s, i) => (
                    <View key={s} style={[styles.stepDot, {
                      backgroundColor: plantillaStep === s
                        ? '#7C3AED'
                        : ((['inicio','procesando','preview'].indexOf(plantillaStep) > i)
                            ? '#7C3AED60' : theme.border),
                      width: plantillaStep === s ? 20 : 8,
                    }]} />
                  ))}
                </View>
              </View>
              <TouchableOpacity onPress={() => {
                setShowPlantilla(false);
                setPlantillaStep('inicio');
                setPlantillaError('');
              }}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* ── PASO 1: Inicio ───────────────────────────────────────────── */}
            {plantillaStep === 'inicio' && (
              <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={styles.sheetBody}>
                {/* Estado actual */}
                <View style={[styles.plantillaBanner, {
                  backgroundColor: (config['contrato_html_template'] || config['contrato_docx_template'])
                    ? '#7C3AED15' : theme.card,
                  borderColor: (config['contrato_html_template'] || config['contrato_docx_template'])
                    ? '#7C3AED40' : theme.border,
                }]}>
                  <Ionicons
                    name={(config['contrato_html_template'] || config['contrato_docx_template'])
                      ? 'checkmark-circle' : 'document-outline'}
                    size={28}
                    color={(config['contrato_html_template'] || config['contrato_docx_template'])
                      ? '#7C3AED' : theme.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.plantillaBannerTitle, { color: theme.text }]}>
                      {(config['contrato_html_template'] || config['contrato_docx_template'])
                        ? 'Plantilla personalizada activa'
                        : 'Usando plantilla por defecto'}
                    </Text>
                    <Text style={[styles.plantillaBannerSub, { color: theme.textSecondary }]}>
                      {(config['contrato_html_template'] || config['contrato_docx_template'])
                        ? 'La IA ya procesó tu contrato'
                        : 'Edítalo aquí mismo, o sube tu contrato Word para que la IA inserte los datos'}
                    </Text>
                  </View>
                  {(config['contrato_html_template'] || config['contrato_docx_template']) && (
                    <TouchableOpacity
                      style={[styles.plantillaDeleteBtn, { borderColor: theme.danger + '40' }]}
                      onPress={eliminarPlantilla}
                      disabled={borrandoPlantilla}
                    >
                      {borrandoPlantilla
                        ? <ActivityIndicator size="small" color={theme.danger} />
                        : <Ionicons name="trash-outline" size={18} color={theme.danger} />}
                    </TouchableOpacity>
                  )}
                </View>

                {/* Error */}
                {!!plantillaError && (
                  <View style={[styles.errorBox, { backgroundColor: theme.danger + '15', borderColor: theme.danger + '30', marginBottom: 12 }]}>
                    <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
                    <Text style={[styles.errorText, { color: theme.danger }]}>{plantillaError}</Text>
                  </View>
                )}

                {/* CTA principal */}
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#7C3AED' }]}
                  onPress={subirPlantilla}
                >
                  <Ionicons name="sparkles-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>
                    {(config['contrato_html_template'] || config['contrato_docx_template'])
                      ? 'Subir nuevo contrato y re-procesar con IA'
                      : 'Subir mi contrato Word — la IA inserta las variables'}
                  </Text>
                </TouchableOpacity>

                {/* Editar/crear el contrato directamente en la app (sin subir Word) */}
                {(() => {
                  const tieneHtml = !!config['contrato_html_template'] && config['contrato_html_template'] !== '__existe__';
                  return (
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: '#0EA5E9' }]}
                      onPress={() => abrirEditor(tieneHtml ? config['contrato_html_template'] : DEFAULT_CONTRATO_HTML)}
                    >
                      <Ionicons name="create-outline" size={18} color="#fff" />
                      <Text style={styles.primaryBtnText}>
                        {tieneHtml ? 'Editar la plantilla de contrato' : 'Editar el contrato actual'}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}
                  onPress={subirPlantillaManual}
                >
                  <Ionicons name="document-text-outline" size={18} color={theme.text} />
                  <Text style={[styles.primaryBtnText, { color: theme.text }]}>
                    Subir plantilla DOCX manual (con tus propias variables)
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.inputLabel, { color: theme.textSecondary, marginBottom: 6 }]}>
                  ¿Cómo funciona con IA?
                </Text>
                {[
                  { icon: 'cloud-upload-outline', text: 'Sube tu contrato Word (.docx) tal como lo tienes' },
                  { icon: 'sparkles-outline',     text: 'La IA detecta nombres, fechas, montos y los reemplaza con variables automáticamente' },
                  { icon: 'eye-outline',           text: 'Ves el resultado y puedes descargarlo para revisar o editar en Word' },
                  { icon: 'save-outline',          text: 'Guardas la plantilla y cada nuevo contrato se llena solo' },
                ].map((step, i) => (
                  <View key={i} style={styles.howStep}>
                    <View style={[styles.howStepNum, { backgroundColor: '#7C3AED20' }]}>
                      <Ionicons name={step.icon as any} size={14} color="#7C3AED" />
                    </View>
                    <Text style={[styles.howStepText, { color: theme.textSecondary }]}>{step.text}</Text>
                  </View>
                ))}

                <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 12, marginBottom: 6 }]}>
                  Variables para subir contrato manual:
                </Text>
                <View style={{ backgroundColor: theme.border + '40', padding: 12, borderRadius: 8, gap: 4 }}>
                  {[
                    '{{nombre_completo}}', '{{depto_numero}}', '{{renta}}', '{{renta_letra}}',
                    '{{deposito}}', '{{fecha_inicio}}', '{{fecha_termino}}', '{{fecha_pago}}',
                    '{{tel_arrendatario}}', '{{fiador_nombre}}', '{{fiador_telefono}}',
                    '{{arrendador_nombre}}', '{{arrendador_direccion}}', '{{metodo_pago}}',
                    '{{observaciones}}', '{{inventario}}'
                  ].map(v => (
                    <Text key={v} style={{ color: theme.text, fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
                      {v}
                    </Text>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* ── PASO 2: Procesando ───────────────────────────────────────── */}
            {plantillaStep === 'procesando' && (
              <View style={[styles.sheetBody, { alignItems: 'center', paddingVertical: 48 }]}>
                <View style={[styles.processingIcon, { backgroundColor: '#7C3AED15' }]}>
                  <ActivityIndicator size="large" color="#7C3AED" />
                </View>
                <Text style={[{ fontSize: 18, fontWeight: '700', color: theme.text, marginTop: 20 }]}>
                  Analizando contrato…
                </Text>
                <Text style={[{ fontSize: 13, color: theme.textSecondary, marginTop: 8, textAlign: 'center' }]}>
                  La IA está leyendo tu documento e{'\n'}insertando las variables automáticamente
                </Text>
              </View>
            )}

            {/* ── PASO 3: Preview ──────────────────────────────────────────── */}
            {plantillaStep === 'preview' && htmlTemplate && (
              <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={styles.sheetBody}>
                {/* Banner éxito */}
                <View style={[styles.plantillaBanner, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}>
                  <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.plantillaBannerTitle, { color: theme.text }]}>
                      ¡Variables insertadas!
                    </Text>
                    <Text style={[styles.plantillaBannerSub, { color: theme.textSecondary }]}>
                      Revisa el resultado antes de guardar
                    </Text>
                  </View>
                </View>

                {/* Contador de variables encontradas */}
                <View style={[styles.varsFoundBadge, { backgroundColor: '#7C3AED12', borderColor: '#7C3AED30' }]}>
                  <Ionicons name="code-slash-outline" size={14} color="#7C3AED" />
                  <Text style={{ color: '#7C3AED', fontSize: 12, fontWeight: '700' }}>
                    {(htmlTemplate.match(/\{\{[^}]+\}\}/g) || []).length} variables detectadas
                  </Text>
                </View>

                {/* Editar contrato en la app (web + móvil) */}
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#0EA5E9', marginBottom: 12 }]}
                  onPress={() => abrirEditor(htmlTemplate)}
                >
                  <Ionicons name="create-outline" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Editar contrato en la app</Text>
                </TouchableOpacity>

                {/* Acciones de revisión */}
                {Platform.OS === 'web' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <TouchableOpacity
                      style={[styles.previewBtn, { backgroundColor: '#0EA5E915', borderColor: '#0EA5E930', flex: 1 }]}
                      onPress={verPreviewPdf}
                    >
                      <Ionicons name="eye-outline" size={16} color="#0EA5E9" />
                      <Text style={[styles.previewBtnText, { color: '#0EA5E9' }]}>Ver PDF demo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.previewBtn, { backgroundColor: '#10B98115', borderColor: '#10B98130', flex: 1 }]}
                      onPress={descargarParaEditar}
                    >
                      <Ionicons name="download-outline" size={16} color="#10B981" />
                      <Text style={[styles.previewBtnText, { color: '#10B981' }]}>Descargar .docx</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Variables encontradas */}
                <Text style={[styles.inputLabel, { color: theme.textSecondary, marginBottom: 6 }]}>
                  Variables insertadas por la IA:
                </Text>
                <View style={styles.varsGrid}>
                  {[...new Set((htmlTemplate.match(/\{\{[^}]+\}\}/g) || []))].map(v => (
                    <View key={v} style={[styles.varChip, { backgroundColor: '#7C3AED12', borderColor: '#7C3AED30' }]}>
                      <Text style={[styles.varChipText, { color: '#7C3AED' }]}>{v}</Text>
                    </View>
                  ))}
                </View>

                {!!plantillaError && (
                  <View style={[styles.errorBox, { backgroundColor: theme.danger + '15', borderColor: theme.danger + '30', marginTop: 8 }]}>
                    <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
                    <Text style={[styles.errorText, { color: theme.danger }]}>{plantillaError}</Text>
                  </View>
                )}

                {/* Botones finales */}
                <View style={[styles.modalActions, { marginTop: 16 }]}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { borderWidth: 1, borderColor: theme.border }]}
                    onPress={() => { setPlantillaStep('inicio'); setHtmlTemplate(null); }}
                  >
                    <Text style={{ color: theme.text, fontWeight: '600' }}>← Volver</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#7C3AED', opacity: guardandoPlantilla ? 0.7 : 1 }]}
                    onPress={guardarPlantilla}
                    disabled={guardandoPlantilla}
                  >
                    {guardandoPlantilla
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar plantilla ✓</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

          </GlassCard>
        </View>
      </Modal>

      {/* ── Modal: Editor de contrato ─────────────────────────────────── */}
      <Modal visible={showEditor} transparent animationType="slide" onRequestClose={() => setShowEditor(false)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalBox, { maxHeight: '92%', maxWidth: 640 }]} padding={0}>
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Editar contrato</Text>
              <TouchableOpacity onPress={() => setShowEditor(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 540 }} contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={[styles.plantillaBannerSub, { color: theme.textSecondary, marginBottom: 12 }]}>
                Edita el texto y usa los botones para insertar variables como {'{{renta}}'} o {'{{nombre_completo}}'}. Cada contrato se llenará con los datos reales del inquilino.
              </Text>

              <RichHtmlEditor html={editorHtml} onChange={setEditorHtml} isDark={isDark} theme={theme} />

              {!!editorError && (
                <View style={[styles.errorBox, { backgroundColor: theme.danger + '15', borderColor: theme.danger + '30', marginTop: 12 }]}>
                  <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
                  <Text style={[styles.errorText, { color: theme.danger }]}>{editorError}</Text>
                </View>
              )}

              {Platform.OS === 'web' && (
                <TouchableOpacity
                  style={[styles.previewBtn, { backgroundColor: '#0EA5E915', borderColor: '#0EA5E930', marginTop: 12 }]}
                  onPress={previewEditorPdf}
                >
                  <Ionicons name="eye-outline" size={16} color="#0EA5E9" />
                  <Text style={[styles.previewBtnText, { color: '#0EA5E9' }]}>Ver PDF demo</Text>
                </TouchableOpacity>
              )}

              <View style={[styles.modalActions, { marginTop: 16 }]}>
                <TouchableOpacity
                  style={[styles.modalBtn, { borderWidth: 1, borderColor: theme.border }]}
                  onPress={() => setShowEditor(false)}
                  disabled={guardandoEditor}
                >
                  <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#7C3AED', opacity: guardandoEditor ? 0.7 : 1 }]}
                  onPress={guardarEditor}
                  disabled={guardandoEditor}
                >
                  {guardandoEditor
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar contrato ✓</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </GlassCard>
        </View>
      </Modal>

      {/* ── Modal: Cuentas bancarias ──────────────────────────────────── */}
      <Modal visible={showCuentas} transparent animationType="slide" onRequestClose={() => setShowCuentas(false)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={[styles.modalBox, { maxHeight: '88%' }]} padding={0}>
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Cuentas Bancarias</Text>
              <View style={styles.sheetHeaderActions}>
                <TouchableOpacity style={[styles.addUserBtn, { backgroundColor: '#10B981' }]} onPress={nuevaCuenta}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.addUserBtnText}>Nueva</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowCuentas(false)}>
                  <Ionicons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sheetBody}>
              {loadingCuentas ? (
                <ActivityIndicator size="small" color="#10B981" style={{ marginTop: 20 }} />
              ) : cuentas.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  Aún no tienes cuentas. Toca “Nueva” para agregar la primera.
                </Text>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
                  {cuentas.map(c => (
                    <View key={c.id} style={[styles.backupItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                      <View style={[styles.backupTypeIcon, { backgroundColor: '#10B98120' }]}>
                        <Ionicons name="card" size={16} color="#10B981" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text style={[styles.backupName, { color: theme.text }]}>
                            {c.alias || c.banco_nombre || 'Cuenta'}
                          </Text>
                          {c.es_predeterminada && (
                            <View style={[styles.rolBadge, { backgroundColor: '#10B98125' }]}>
                              <Text style={[styles.rolBadgeText, { color: '#10B981' }]}>PREDET.</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.backupMeta, { color: theme.textSecondary }]}>
                          {c.banco_nombre ? `${c.banco_nombre} · ` : ''}{c.banco_clabe}
                        </Text>
                        {Array.isArray(c.departamentos) && c.departamentos.length > 0 && (
                          <Text style={[styles.backupMeta, { color: theme.textSecondary }]}>
                            Deptos: {c.departamentos.join(', ')}
                          </Text>
                        )}
                      </View>
                      <View style={{ gap: 6 }}>
                        {!c.es_predeterminada && (
                          <TouchableOpacity style={[styles.toggleBtn, { backgroundColor: '#10B98120' }]} onPress={() => marcarDefaultCuenta(c.id)}>
                            <Ionicons name="star-outline" size={15} color="#10B981" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[styles.toggleBtn, { backgroundColor: theme.primary + '20' }]} onPress={() => editarCuenta(c)}>
                          <Ionicons name="create-outline" size={15} color={theme.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.toggleBtn, { backgroundColor: theme.danger + '20' }]} onPress={() => eliminarCuenta(c.id)}>
                          <Ionicons name="trash-outline" size={15} color={theme.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
              <Text style={[styles.plantillaBannerSub, { color: theme.textSecondary, marginTop: 12 }]}>
                Asigna qué cuenta usa cada departamento desde la pantalla del departamento. El inquilino verá automáticamente la cuenta de su depto (o la predeterminada).
              </Text>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Modal alta/edición de cuenta */}
      <Modal visible={!!cuentaForm} transparent animationType="fade" onRequestClose={() => setCuentaForm(null)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalBox} borderRadius={Theme.borderRadius.xl} padding={28}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {cuentaForm?.id ? 'Editar cuenta' : 'Nueva cuenta'}
            </Text>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Alias (opcional)</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
              value={cuentaForm?.alias}
              onChangeText={t => setCuentaForm(f => f ? { ...f, alias: t.slice(0, 60) } : f)}
              placeholder="Ej. Cuenta Torre A"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Banco</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
              value={cuentaForm?.banco_nombre}
              onChangeText={t => setCuentaForm(f => f ? { ...f, banco_nombre: t.slice(0, 60) } : f)}
              placeholder="Ej. BBVA"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>CLABE (18 dígitos)</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: cuentaError ? theme.danger : theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
              value={cuentaForm?.banco_clabe}
              onChangeText={t => { setCuentaForm(f => f ? { ...f, banco_clabe: t.replace(/\D/g, '').slice(0, 18) } : f); setCuentaError(''); }}
              placeholder="18 dígitos"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              maxLength={18}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Titular</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}
              value={cuentaForm?.banco_titular}
              onChangeText={t => setCuentaForm(f => f ? { ...f, banco_titular: t.slice(0, 120) } : f)}
              placeholder="Nombre del titular"
              placeholderTextColor={theme.textSecondary}
            />

            {cuentaError ? (
              <View style={[styles.errorBox, { backgroundColor: theme.danger + '15', borderColor: theme.danger + '30', marginTop: 8 }]}>
                <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>{cuentaError}</Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderWidth: 1, borderColor: theme.border }]}
                onPress={() => setCuentaForm(null)}
                disabled={guardandoCuenta}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#10B981', opacity: guardandoCuenta ? 0.7 : 1 }]}
                onPress={guardarCuenta}
                disabled={guardandoCuenta}
              >
                {guardandoCuenta
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40, paddingHorizontal: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  headerDesktop: { paddingTop: 4 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 4 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  profileEmail: { fontSize: 12.5, opacity: 0.8 },

  bento: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  bentoCol: { flex: 1, minWidth: 0, gap: 14 },
  sectionCard: { overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1 },
  sectionHeadTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  rolesGrid: { flexDirection: 'row', gap: 8, padding: 14, paddingBottom: 6 },
  roleCell: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  roleNum: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  roleLabel: { fontSize: 8.5, fontWeight: '700', letterSpacing: 0.4, marginTop: 3 },

  sectionsContainer: { gap: 24, marginBottom: 32 },
  section: { marginHorizontal: 16, overflow: 'hidden' },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, padding: 16, paddingBottom: 8,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingIconContainer: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  settingContent: { flex: 1, gap: 2 },
  settingTitle: { fontSize: 15, fontWeight: '600' },
  settingSubtitle: { fontSize: 12, opacity: 0.7 },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 4, marginBottom: 12, padding: 14, borderRadius: Theme.borderRadius.md, borderWidth: 1,
  },
  logoutIcon: { marginRight: 8 },
  logoutText: { fontSize: 16, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 12, marginBottom: 40, opacity: 0.5 },
  // Modals
  modalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 24,
  },
  modalBox: { width: '100%', maxWidth: 480 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalInput: {
    borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15,
    marginBottom: 8,
  },
  charCounter: { fontSize: 11, textAlign: 'right', marginBottom: 8, opacity: 0.8 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  errorText: { flex: 1, fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalBtn: { flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  // Sheet modals
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetBody: { padding: 20 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 48, borderRadius: 14, marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  backupMsg: { textAlign: 'center', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  backupList: { maxHeight: 280 },
  backupItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backupTypeIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  backupName: { fontSize: 13, fontWeight: '600' },
  backupMeta: { fontSize: 11, opacity: 0.7, marginTop: 2 },
  backupTypeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  backupTypeText: { fontSize: 10, fontWeight: '800' },
  adminItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  adminAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  adminAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  adminNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  adminName: { fontSize: 14, fontWeight: '600' },
  adminEmail: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  rolBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  rolBadgeText: { fontSize: 9, fontWeight: '800' },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, flexShrink: 0,
  },
  toggleBtnText: { fontSize: 12, fontWeight: '700' },
  sheetHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addUserBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  addUserBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, marginTop: 4 },
  rolSelector: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  rolOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 44, borderRadius: 12, borderWidth: 1,
  },
  rolOptionText: { fontSize: 13, fontWeight: '600' },
  emptyText: { textAlign: 'center', fontSize: 14, marginTop: 20, opacity: 0.7 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  // Plantilla DOCX
  plantillaBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16,
  },
  plantillaBannerTitle: { fontSize: 14, fontWeight: '700' },
  plantillaBannerSub: { fontSize: 12, marginTop: 2 },
  plantillaDeleteBtn: {
    padding: 8, borderRadius: 10, borderWidth: 1,
  },
  varsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  varChip: {
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
  },
  varChipText: { fontSize: 10, fontWeight: '700', fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier' },
  stepDot: { height: 6, borderRadius: 3 },
  processingIcon: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  howStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  howStepNum: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  howStepText: { flex: 1, fontSize: 13, lineHeight: 18 },
  varsFoundBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12,
    alignSelf: 'flex-start',
  },
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 42, borderRadius: 12, borderWidth: 1,
  },
  previewBtnText: { fontSize: 13, fontWeight: '600' },
});
