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
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useCallback } from 'react';
import api from '../../../services/api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

function getStoredUser() {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  }
  return null;
}

function getNotifPref(): boolean {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    return localStorage.getItem('notif_enabled') !== 'false';
  }
  return true;
}

function setNotifPref(val: boolean) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem('notif_enabled', val ? 'true' : 'false');
  }
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

  // Vincular modal
  const [vincularModal, setVincularModal] = useState<{ userId: string; userName: string } | null>(null);
  const [inquilinosLista, setInquilinosLista] = useState<any[]>([]);
  const [loadingInquilinos, setLoadingInquilinos] = useState(false);
  const [vinculando, setVinculando] = useState(false);

  // Nuevo usuario form
  const [showNuevoUsuario, setShowNuevoUsuario] = useState(false);
  const [nuNombre, setNuNombre] = useState('');
  const [nuEmail, setNuEmail] = useState('');
  const [nuPassword, setNuPassword] = useState('');
  const [nuRol, setNuRol] = useState<'admin' | 'inquilino'>('admin');
  const [creandoUsuario, setCreandoUsuario] = useState(false);
  const [nuError, setNuError] = useState('');

  useFocusEffect(useCallback(() => {
    api.getConfig()
      .then(r => setConfig(r.data || {}))
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
  }, []));

  const handleNotifToggle = async (val: boolean) => {
    if (val && Platform.OS === 'web' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setNotifEnabled(false);
        setNotifPref(false);
        return;
      }
      new Notification('Admin Depas', { body: 'Notificaciones activadas ✓', icon: '/favicon.ico' });
    }
    setNotifEnabled(val);
    setNotifPref(val);
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
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%', paddingHorizontal: 40 },
          { paddingBottom: isDesktop ? 40 : insets.bottom + Theme.layout.dockHeight },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, isDesktop && styles.headerDesktop, !isDesktop && { paddingTop: insets.top + 20 }]}>
          <Text style={[styles.title, { color: theme.text }]}>Configuración</Text>
        </View>

        {/* Perfil */}
        <GlassCard style={styles.profileCard} borderRadius={Theme.borderRadius.xl}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
            <Text style={[styles.profileEmail, { color: theme.textSecondary }]} numberOfLines={1}>{email}</Text>
          </View>
        </GlassCard>

        <View style={styles.sectionsContainer}>
          {/* Preferencias */}
          <GlassCard style={styles.section} borderRadius={Theme.borderRadius.xl} padding={0}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Preferencias</Text>
            <SettingRow
              icon="notifications"
              title="Notificaciones Push"
              subtitle={notifEnabled ? 'Activadas' : 'Desactivadas'}
              hasSwitch
              switchValue={notifEnabled}
              onSwitchChange={handleNotifToggle}
            />
          </GlassCard>

          {/* Propiedades y Contratos */}
          <GlassCard style={styles.section} borderRadius={Theme.borderRadius.xl} padding={0}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Propiedades y Contratos</Text>
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
              icon="document-text"
              title="Ver Contratos"
              subtitle="Generar e imprimir contratos"
              onPress={() => router.push('/(admin)/contratos' as any)}
            />
            <SettingRow
              icon="qr-code"
              iconColor="#6366F1"
              title="URL de la App"
              subtitle={loadingConfig
                ? 'Cargando…'
                : (config['app_url'] || 'Sin configurar — necesaria para QR de pagos')}
              onPress={() => openEdit('app_url', 'URL de la App')}
            />
          </GlassCard>

          {/* Datos bancarios */}
          <GlassCard style={styles.section} borderRadius={Theme.borderRadius.xl} padding={0}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Datos Bancarios (Transferencias)</Text>
            <SettingRow
              icon="business"
              iconColor="#34C759"
              title="Banco"
              subtitle={loadingConfig ? 'Cargando…' : (config['banco_nombre'] || 'Sin configurar')}
              onPress={() => openEdit('banco_nombre', 'Banco')}
            />
            <SettingRow
              icon="card"
              iconColor="#34C759"
              title="CLABE / Cuenta"
              subtitle={loadingConfig ? 'Cargando…' : (config['banco_clabe'] || 'Sin configurar')}
              onPress={() => openEdit('banco_clabe', 'CLABE / Número de cuenta')}
            />
            <SettingRow
              icon="person"
              iconColor="#34C759"
              title="Titular de la cuenta"
              subtitle={loadingConfig ? 'Cargando…' : (config['banco_titular'] || 'Sin configurar')}
              onPress={() => openEdit('banco_titular', 'Titular de la cuenta')}
            />
          </GlassCard>

          {/* Registro de administradores */}
          <GlassCard style={styles.section} borderRadius={Theme.borderRadius.xl} padding={0}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Registro de Usuarios</Text>
            <SettingRow
              icon="key"
              iconColor={theme.warning}
              title="Código de Invitación (Admin)"
              subtitle={loadingConfig
                ? 'Cargando…'
                : config['admin_invite_code']
                  ? '••••••••  (configurado)'
                  : 'Sin configurar — admins no pueden auto-registrarse'}
              onPress={() => openEdit('admin_invite_code', 'Código de Invitación de Administrador')}
            />
          </GlassCard>

          {/* Sistema */}
          <GlassCard style={styles.section} borderRadius={Theme.borderRadius.xl} padding={0}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Sistema</Text>
            <SettingRow
              icon="people"
              title="Gestión de Administradores"
              subtitle="Ver y gestionar cuentas de admin"
              onPress={openAdmins}
            />
            <SettingRow
              icon="server"
              title="Backups e Historial"
              subtitle="Respaldos de la base de datos"
              onPress={openBackups}
            />
          </GlassCard>
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.danger + '10', borderColor: theme.danger + '30' }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.danger} style={styles.logoutIcon} />
          <Text style={[styles.logoutText, { color: theme.danger }]}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: theme.textSecondary }]}>Admin Depas v1.0</Text>
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
              {loadingAdmins ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />
              ) : admins.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Sin usuarios registrados</Text>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {admins.map((a) => {
                    const ini = (a.nombre_completo || 'A').split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                    const isToggling = togglingId === a.id;
                    const rolColor = a.rol === 'admin' ? theme.primary : '#FF9500';
                    return (
                      <View key={a.id} style={[styles.adminItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                        <View style={[styles.adminAvatar, { backgroundColor: rolColor }]}>
                          <Text style={styles.adminAvatarText}>{ini}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.adminNameRow}>
                            <Text style={[styles.adminName, { color: theme.text }]} numberOfLines={1}>{a.nombre_completo}</Text>
                            <View style={[styles.rolBadge, { backgroundColor: rolColor + '20' }]}>
                              <Text style={[styles.rolBadgeText, { color: rolColor }]}>{a.rol.toUpperCase()}</Text>
                            </View>
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
                          <TouchableOpacity
                            style={[
                              styles.toggleBtn,
                              { backgroundColor: a.activo ? theme.success + '20' : theme.danger + '20' }
                            ]}
                            onPress={() => toggleAdmin(a.id)}
                            disabled={isToggling}
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
            <View style={styles.rolSelector}>
              {(['admin', 'inquilino'] as const).map(r => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.rolOption,
                    {
                      backgroundColor: nuRol === r
                        ? (r === 'admin' ? theme.primary : '#FF9500')
                        : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                      borderColor: nuRol === r
                        ? (r === 'admin' ? theme.primary : '#FF9500')
                        : theme.border,
                    }
                  ]}
                  onPress={() => setNuRol(r)}
                >
                  <Ionicons
                    name={r === 'admin' ? 'shield-checkmark' : 'person'}
                    size={16}
                    color={nuRol === r ? '#fff' : theme.textSecondary}
                  />
                  <Text style={[styles.rolOptionText, { color: nuRol === r ? '#fff' : theme.textSecondary }]}>
                    {r === 'admin' ? 'Administrador' : 'Inquilino'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  header: { padding: 24, paddingTop: Platform.OS === 'ios' ? 80 : 60 },
  headerDesktop: { paddingTop: 40 },
  title: { fontSize: 28, fontWeight: '700' },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', padding: 20,
    marginHorizontal: 16, marginBottom: 32,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', marginBottom: 3 },
  profileEmail: { fontSize: 13, opacity: 0.7 },
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
    marginHorizontal: 16, marginBottom: 20, padding: 16, borderRadius: 16, borderWidth: 1,
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
});
