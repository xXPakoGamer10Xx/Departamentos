import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  useColorScheme,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { setItem, removeItem } from '../../services/storage';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const authBg = require('../../assets/auth-bg.jpg');

type RoleTab = 'admin' | 'inquilino';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roleTab, setRoleTab] = useState<RoleTab>('admin');
  const [remember, setRemember] = useState(true);
  const [showForgot, setShowForgot] = useState(false);

  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isSplit = width >= Theme.breakpoints.desktop;

  const handleLogin = async () => {
    const emailTrim = email.trim();
    if (!emailTrim || !password) {
      setError('Ingresa tu correo y contraseña');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.login(emailTrim, password);
      if (!res.data?.token) {
        setError('Respuesta inesperada del servidor');
        return;
      }
      const user = res.data.user;
      const rol: string = user.rol;
      const allowed = roleTab === 'admin' ? ['admin', 'cobrador'] : ['inquilino'];
      if (!allowed.includes(rol)) {
        const rolLabel = rol === 'inquilino' ? 'Inquilino' : rol === 'cobrador' ? 'Cobrador' : 'Administrador';
        const tabLabel = roleTab === 'admin' ? 'Administrador' : 'Inquilino';
        setError(`Esta cuenta es de tipo "${rolLabel}". Elegiste la pestaña "${tabLabel}" — cámbiala para continuar.`);
        api.setToken(null);
        return;
      }
      api.setToken(res.data.token);
      if (remember) {
        setItem(TOKEN_KEY, res.data.token);
        setItem(USER_KEY, JSON.stringify(user));
      } else {
        removeItem(TOKEN_KEY);
        removeItem(USER_KEY);
      }
      const dest = rol === 'inquilino' ? '/(inquilino)' : rol === 'cobrador' ? '/(cobrador)/scan' : '/(admin)';
      router.replace(dest as any);
    } catch (e: any) {
      setError(e.message || 'Credenciales incorrectas. Verifica e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const clearError = (fn: () => void) => () => { setError(''); fn(); };

  const formBody = (
    <>
      {/* Toggle de rol */}
      <View style={[styles.toggle, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)', borderColor: theme.border }]}>
        {(['admin', 'inquilino'] as RoleTab[]).map((t) => {
          const active = roleTab === t;
          return (
            <TouchableOpacity
              key={t}
              style={[styles.toggleBtn, active && { backgroundColor: theme.primary }]}
              onPress={clearError(() => setRoleTab(t))}
              activeOpacity={0.85}
            >
              <Text style={[styles.toggleText, { color: active ? '#fff' : theme.textSecondary }]}>
                {t === 'admin' ? 'Administrador' : 'Inquilino'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Input
        label="Correo electrónico"
        icon="mail-outline"
        placeholder="correo@ejemplo.com"
        value={email}
        onChangeText={(t) => { setError(''); setEmail(t); }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        onSubmitEditing={handleLogin}
        returnKeyType="next"
      />

      <Input
        label="Contraseña"
        icon="lock-closed-outline"
        placeholder="••••••••"
        value={password}
        onChangeText={(t) => { setError(''); setPassword(t); }}
        isPassword
        onSubmitEditing={handleLogin}
        returnKeyType="go"
      />

      {/* Recordar sesión + olvidé contraseña */}
      <View style={styles.metaRow}>
        <TouchableOpacity style={styles.remember} onPress={() => setRemember((v) => !v)} activeOpacity={0.7}>
          <View style={[
            styles.checkbox,
            {
              borderColor: remember ? theme.primary : theme.borderStrong,
              backgroundColor: remember ? theme.primary : 'transparent',
            },
          ]}>
            {remember && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
          <Text style={[styles.rememberText, { color: theme.textSecondary }]} numberOfLines={1}>Recordar sesión</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowForgot((v) => !v)} activeOpacity={0.7} style={styles.forgotBtn}>
          <Text style={[styles.forgotText, { color: theme.primary }]} numberOfLines={1}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>
      </View>
      {showForgot && (
        <Text style={[styles.forgotHint, { color: theme.textMuted }]}>
          Contacta al administrador del edificio para restablecer tu acceso.
        </Text>
      )}

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: theme.dangerLight, borderColor: theme.danger + '50' }]}>
          <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
        </View>
      ) : null}

      <Button
        title={loading ? 'Ingresando...' : 'Entrar al Sistema'}
        onPress={handleLogin}
        loading={loading}
        variant="primary"
        size="lg"
        fullWidth
        icon="arrow-forward"
        iconPosition="right"
        style={{ marginTop: Theme.spacing.sm }}
      />

      <TouchableOpacity onPress={() => router.push('/(auth)/register' as any)} style={styles.registerLink}>
        <Text style={[styles.registerLinkText, { color: theme.textSecondary }]}>
          ¿No tienes cuenta?{' '}
          <Text style={{ color: theme.primary, fontWeight: '700' }}>Crear cuenta</Text>
        </Text>
      </TouchableOpacity>

      <View style={[styles.sslFooter, { borderTopColor: theme.border }]}>
        <Ionicons name="lock-closed" size={12} color={theme.textMuted} />
        <Text style={[styles.sslText, { color: theme.textMuted }]}>
          NethRent Security · Cifrado SSL de 256 bits
        </Text>
      </View>
    </>
  );

  /* ---------- Layout ancho: split-screen ---------- */
  if (isSplit) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={isDark ? ['#0E1321', '#1A1F2E', '#232842'] : ['#F8FAFC', '#F1F5F9', '#E2E8F0']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.splitRow}>
          {/* Panel izquierdo — showcase */}
          <View style={styles.showcase}>
            <Image source={authBg} style={styles.showcaseImg} resizeMode="cover" />
            <LinearGradient
              colors={isDark
                ? ['rgba(14,19,33,0.35)', 'rgba(14,19,33,0.82)', '#0E1321']
                : ['rgba(15,23,42,0.20)', 'rgba(15,23,42,0.48)', 'rgba(15,23,42,0.75)']}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.showcaseContent}>
              <View style={styles.showcaseLogoRow}>
                <LinearGradient colors={['#10B981', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoMark}>
                  <Ionicons name="home" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.showcaseBrand}>NethRent</Text>
              </View>

              <View style={{ maxWidth: 480 }}>
                <Text style={styles.showcaseTitle}>Gestión Inmobiliaria Inteligente, Simplificada.</Text>
                <Text style={styles.showcaseSub}>
                  La plataforma líder para administración de departamentos, cobro automatizado de rentas y contratos digitales.
                </Text>
                <View style={styles.metricBadge}>
                  <View style={styles.metricDot} />
                  <Text style={styles.metricText}>99.4% COBRANZA A TIEMPO · 100% DIGITAL</Text>
                </View>
              </View>

              <LinearGradient colors={['#3B82F6', '#10B981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.showcaseBar} />
            </View>
          </View>

          {/* Panel derecho — formulario */}
          <View style={styles.formPane}>
            <View style={[styles.formCardSplit, {
              backgroundColor: theme.cardElevated,
              borderColor: theme.border,
            }]}>
              <View style={styles.splitHeader}>
                <Text style={[styles.splitTitle, { color: theme.text }]}>Iniciar Sesión</Text>
                <Text style={[styles.splitSub, { color: theme.textSecondary }]}>
                  Ingresa tus credenciales para acceder a tu panel de administración o portal de inquilino.
                </Text>
              </View>
              {formBody}
            </View>
          </View>
        </View>
      </View>
    );
  }

  /* ---------- Layout angosto: tarjeta centrada ---------- */
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#0E1321', '#1A1F2E', '#232842'] : ['#F8FAFC', '#F1F5F9', '#E2E8F0']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb1, { backgroundColor: isDark ? 'rgba(59,130,246,0.14)' : 'rgba(59,130,246,0.08)' }]} />
      <View style={[styles.orb2, { backgroundColor: isDark ? 'rgba(16,185,129,0.10)' : 'rgba(16,185,129,0.06)' }]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        style={styles.kbWrapper}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
        >
          <GlassCard
            intensity={isDark ? 25 : 60}
            borderRadius={Theme.borderRadius.xxl}
            style={styles.card}
            padding={0}
            variant="elevated"
            border
          >
            <LinearGradient
              colors={['#10B981', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cardTop}
            >
              <View style={styles.logoWrap}>
                <Ionicons name="home" size={28} color="#fff" />
              </View>
              <Text style={styles.cardTopTitle}>NethRent</Text>
              <Text style={styles.cardTopSub}>Gestión de arrendamientos</Text>
            </LinearGradient>

            <View style={styles.form}>{formBody}</View>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* --- split --- */
  splitRow: { flex: 1, flexDirection: 'row' },
  showcase: {
    flex: 1,
    overflow: 'hidden',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
  },
  showcaseImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  showcaseContent: {
    flex: 1,
    padding: 48,
    justifyContent: 'space-between',
  },
  showcaseLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showcaseBrand: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  showcaseTitle: {
    color: '#F8FAFC',
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 48,
    marginBottom: 16,
  },
  showcaseSub: {
    color: 'rgba(226,232,240,0.82)',
    fontSize: 16,
    lineHeight: 25,
    marginBottom: 28,
  },
  metricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  metricDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4EDEA3' },
  metricText: { color: '#6FFBBE', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  showcaseBar: { height: 4, width: 96, borderRadius: 999 },

  formPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  formCardSplit: {
    width: '100%',
    maxWidth: 440,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: 32,
    ...Theme.shadows.xl,
  },
  splitHeader: { alignItems: 'center', marginBottom: 24 },
  splitTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, marginBottom: 6 },
  splitSub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },

  /* --- orbes / tarjeta centrada --- */
  orb1: { position: 'absolute', width: 400, height: 400, borderRadius: 200, top: -100, right: -100 },
  orb2: { position: 'absolute', width: 300, height: 300, borderRadius: 150, bottom: -80, left: -80 },
  kbWrapper: { flex: 1 },
  scrollContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
    paddingVertical: Theme.spacing.xxxl,
  },
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', overflow: 'hidden' },
  cardTop: { padding: 36, paddingBottom: 32, alignItems: 'center', gap: 10 },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cardTopTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.6 },
  cardTopSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  form: { padding: 28, paddingTop: 28 },

  /* --- toggle de rol --- */
  toggle: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: 20,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: Theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: { fontSize: 13, fontWeight: '600' },

  /* --- recordar / olvidé --- */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 8,
    columnGap: 10,
    rowGap: 8,
    flexWrap: 'wrap',
  },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1, minWidth: 0 },
  forgotBtn: { flexShrink: 1, minWidth: 0 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberText: { fontSize: 12.5, fontWeight: '500' },
  forgotText: { fontSize: 12.5, fontWeight: '600' },
  forgotHint: { fontSize: 12, lineHeight: 17, marginBottom: 8 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    marginTop: 4,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  registerLink: { marginTop: Theme.spacing.md, alignItems: 'center', paddingVertical: 4 },
  registerLinkText: { fontSize: 14 },

  sslFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    borderTopWidth: 1,
  },
  sslText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
});
