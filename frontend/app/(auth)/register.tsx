import { useState } from 'react';
import {
  StyleSheet, View, Text, useColorScheme, Platform,
  KeyboardAvoidingView, ScrollView, TouchableOpacity, Dimensions,
} from 'react-native';

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

export default function RegisterScreen() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  const handleRegister = async () => {
    const emailTrim = email.trim();
    const nombreTrim = nombre.trim();
    if (!nombreTrim) { setError('Ingresa tu nombre completo'); return; }
    if (!emailTrim || !emailTrim.includes('@')) { setError('Ingresa un correo electrónico válido'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }

    setError('');
    setLoading(true);
    try {
      const res = await api.register({
        email: emailTrim,
        password,
        nombre_completo: nombreTrim,
        rol: 'inquilino',
      });
      if (res.data?.token) {
        api.setToken(res.data.token);
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          localStorage.setItem(TOKEN_KEY, res.data.token);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
        }
        router.replace('/(inquilino)' as any);
      }
    } catch (e: any) {
      setError(e.message || 'No se pudo crear la cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#0D0F18', '#161929', '#1E2235'] : ['#EEF2FF', '#F1F5F9', '#E8EDF5']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
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
          <GlassCard intensity={isDark ? 25 : 60} borderRadius={Theme.borderRadius.xxl} style={styles.card} padding={0} variant="elevated" border>
            <LinearGradient
              colors={['#4F46E5', '#6366F1', '#818CF8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.cardTop}
            >
              <View style={styles.logoWrap}>
                <Ionicons name="person-add" size={26} color="#fff" />
              </View>
              <Text style={styles.cardTopTitle}>Crear cuenta</Text>
              <Text style={styles.cardTopSub}>NethRent</Text>
            </LinearGradient>

            <View style={styles.form}>
              <Input
                label="Nombre completo"
                icon="person-outline"
                placeholder="Tu nombre completo"
                value={nombre}
                onChangeText={t => { setError(''); setNombre(t); }}
                autoCapitalize="words"
                returnKeyType="next"
              />
              <Input
                label="Correo electrónico"
                icon="mail-outline"
                placeholder="correo@ejemplo.com"
                value={email}
                onChangeText={t => { setError(''); setEmail(t); }}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />
              <Input
                label="Contraseña"
                icon="lock-closed-outline"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChangeText={t => { setError(''); setPassword(t); }}
                isPassword
                returnKeyType="next"
              />
              <Input
                label="Confirmar contraseña"
                icon="lock-closed-outline"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChangeText={t => { setError(''); setConfirmPassword(t); }}
                isPassword
                returnKeyType="go"
                onSubmitEditing={handleRegister}
              />

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: theme.dangerLight, borderColor: theme.danger + '50' }]}>
                  <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
                  <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
                </View>
              ) : null}

              <Button
                title={loading ? 'Creando cuenta…' : 'Crear cuenta'}
                onPress={handleRegister}
                loading={loading}
                variant="primary"
                size="lg"
                fullWidth
                style={{ marginTop: Theme.spacing.sm }}
              />

              <TouchableOpacity onPress={() => router.back()} style={styles.loginLink}>
                <Text style={[styles.loginLinkText, { color: theme.textSecondary }]}>
                  ¿Ya tienes cuenta?{' '}
                  <Text style={{ color: theme.primary, fontWeight: '700' }}>Iniciar sesión</Text>
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
  orb1: { position: 'absolute', width: 400, height: 400, borderRadius: 200, top: -100, right: -100 },
  orb2: { position: 'absolute', width: 300, height: 300, borderRadius: 150, bottom: -80, left: -80 },
  kbWrapper: { flex: 1 },
  scrollContent: {
    justifyContent: 'center', alignItems: 'center',
    padding: Theme.spacing.xl, paddingVertical: Theme.spacing.xxxl,
  },
  card: { width: '100%', maxWidth: 420, overflow: 'hidden' },
  cardTop: { padding: 28, paddingBottom: 24, alignItems: 'center', gap: 8 },
  logoWrap: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  cardTopTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  cardTopSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  form: { padding: 24, gap: 4 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 4,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  loginLink: { marginTop: 12, alignItems: 'center', paddingVertical: 4 },
  loginLinkText: { fontSize: 14 },
  footer: { marginTop: Theme.spacing.xxl, fontSize: 12, fontWeight: '500', textAlign: 'center' },
});
