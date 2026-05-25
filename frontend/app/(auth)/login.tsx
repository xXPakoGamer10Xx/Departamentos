import { useState } from 'react';
import { StyleSheet, View, Text, useColorScheme, Platform, KeyboardAvoidingView, ScrollView, TouchableOpacity, Dimensions } from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

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
      if (res.data?.token) {
        api.setToken(res.data.token);
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          localStorage.setItem(TOKEN_KEY, res.data.token);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
        }
        const dest = res.data.user.rol === 'inquilino' ? '/(inquilino)' : '/(admin)';
        router.replace(dest as any);
      } else {
        setError('Respuesta inesperada del servidor');
      }
    } catch (e: any) {
      setError(e.message || 'Credenciales incorrectas. Verifica e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Fondo degradado */}
      <LinearGradient
        colors={isDark
          ? ['#0D0F18', '#161929', '#1E2235']
          : ['#EEF2FF', '#F1F5F9', '#E8EDF5']
        }
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Orbe decorativo de fondo */}
      <View style={[styles.orb1, { backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)' }]} />
      <View style={[styles.orb2, { backgroundColor: isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.06)' }]} />

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
            {/* Franja superior de color */}
            <LinearGradient
              colors={['#4F46E5', '#6366F1', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cardTop}
            >
              <View style={styles.logoWrap}>
                <Ionicons name="home" size={28} color="#fff" />
              </View>
              <Text style={styles.cardTopTitle}>Admin Depas</Text>
              <Text style={styles.cardTopSub}>Gestión de arrendamientos</Text>
            </LinearGradient>

            {/* Formulario */}
            <View style={styles.form}>
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

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: theme.dangerLight, borderColor: theme.danger + '50' }]}>
                  <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
                  <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
                </View>
              ) : null}

              <Button
                title={loading ? 'Ingresando...' : 'Ingresar'}
                onPress={handleLogin}
                loading={loading}
                variant="primary"
                size="lg"
                fullWidth
                style={{ marginTop: Theme.spacing.sm }}
              />

              <View style={[styles.hintBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)', borderColor: theme.border }]}>
                <Ionicons name="information-circle-outline" size={14} color={theme.textMuted} />
                <Text style={[styles.hintText, { color: theme.textMuted }]}>
                  admin@departamentos.local · Admin2024!
                </Text>
              </View>

              <TouchableOpacity onPress={() => router.push('/(auth)/register' as any)} style={styles.registerLink}>
                <Text style={[styles.registerLinkText, { color: theme.textSecondary }]}>
                  ¿No tienes cuenta?{' '}
                  <Text style={{ color: theme.primary, fontWeight: '700' }}>Crear cuenta</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>

          <Text style={[styles.footer, { color: theme.textMuted }]}>
            Sistema privado — solo usuarios autorizados
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  orb1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    top: -100,
    right: -100,
  },
  orb2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    bottom: -80,
    left: -80,
  },
  kbWrapper: { flex: 1 },
  scrollContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
    paddingVertical: Theme.spacing.xxxl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    overflow: 'hidden',
  },
  cardTop: {
    padding: 36,
    paddingBottom: 32,
    alignItems: 'center',
    gap: 10,
  },
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
  cardTopTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.6,
  },
  cardTopSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  form: {
    padding: 28,
    paddingTop: 28,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Theme.spacing.lg,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    marginTop: Theme.spacing.xxl,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  registerLink: {
    marginTop: Theme.spacing.md,
    alignItems: 'center',
    paddingVertical: 4,
  },
  registerLinkText: {
    fontSize: 14,
  },
});
