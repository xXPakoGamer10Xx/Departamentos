import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, useColorScheme, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '../../components/ui/GlassCard';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        router.replace('/(admin)');
      } else {
        setError('Respuesta inesperada del servidor');
      }
    } catch (e: any) {
      setError(e.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isDark ? ['#1a1a1a', '#000000'] : ['#f0f0f7', '#ffffff']}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <GlassCard intensity={40} borderRadius={32} style={styles.card} border={true}>
          <View style={styles.header}>
            <LinearGradient
              colors={[theme.primary, theme.primary + 'CC']}
              style={styles.iconContainer}
            >
              <Ionicons name="business" size={32} color="#fff" />
            </LinearGradient>
            <Text style={[styles.title, { color: theme.text }]}>Admin Depas</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Gestión de Arrendamientos</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Correo electrónico</Text>
              <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                <Ionicons name="mail-outline" size={20} color={theme.icon} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="admin@departamentos.local"
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={(t) => { setError(''); setEmail(t); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onSubmitEditing={handleLogin}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Contraseña</Text>
              <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.icon} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={(t) => { setError(''); setPassword(t); }}
                  secureTextEntry={!showPassword}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={theme.icon}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.danger + '15', borderColor: theme.danger + '40' }]}>
                <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Ingresar</Text>
              }
            </TouchableOpacity>

            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              admin@departamentos.local · Admin2024!
            </Text>
          </View>
        </GlassCard>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, padding: 32 },
  header: { alignItems: 'center', marginBottom: 40 },
  iconContainer: {
    width: 72, height: 72, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    shadowColor: Colors.dark.primary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 15,
  },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontWeight: '500', opacity: 0.7 },
  form: { width: '100%' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, height: 54,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  eyeIcon: { padding: 4 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '500' },
  button: {
    height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 4,
    shadowColor: Colors.dark.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 12,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  hint: { textAlign: 'center', fontSize: 12, marginTop: 16, opacity: 0.6 },
});
