import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import api from '../services/api';

SplashScreen.preventAutoHideAsync();

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Registrar callback global para cuando cualquier petición reciba 401
    api.onUnauthorized = () => {
      router.replace('/(auth)/login');
    };

    const init = async () => {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(TOKEN_KEY);
        if (saved) {
          api.setToken(saved);
          try {
            const meRes = await api.me();
            // Actualizar datos de usuario en localStorage con la info más reciente del servidor
            if (meRes.data) {
              localStorage.setItem(USER_KEY, JSON.stringify(meRes.data));
            }
            // Token válido — app/index.tsx se encarga del routing según el rol almacenado
          } catch {
            // Token expirado, inválido o backend no disponible — limpiar sesión
            // app/index.tsx detectará que no hay token y redirigirá al login
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            api.setToken(null);
          }
        }
      }
      setReady(true);
      SplashScreen.hideAsync();
    };

    init();
  }, []);

  if (!ready) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{
        headerStyle: {
          backgroundColor: colorScheme === 'dark' ? Colors.dark.card : Colors.light.card,
        },
        headerTintColor: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
        contentStyle: {
          backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
        },
        animation: 'fade',
        animationDuration: 220,
      }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="(inquilino)" options={{ headerShown: false }} />
        <Stack.Screen name="(cobrador)" options={{ headerShown: false }} />
        <Stack.Screen name="confirmar/[token]" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}
