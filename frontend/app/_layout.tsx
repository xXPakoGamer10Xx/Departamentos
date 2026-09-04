import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import api from '../services/api';
import { hydrateStorage, getItem, setItem, removeItem } from '../services/storage';

// ── Esquema de color estable ─────────────────────────────────────────────────
// En RN-web `useColorScheme()` puede devolver valores distintos entre
// componentes si el SO cambia en caliente (shell oscuro + cards claras).
// Leemos la preferencia del sistema UNA vez al arranque y la fijamos para toda
// la sesión: todos los componentes resuelven el mismo esquema. Para cambiar de
// modo claro/oscuro se ajusta el SO y se recarga la app.
const _systemDark =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : Appearance.getColorScheme() === 'dark';
const _lockedScheme: 'light' | 'dark' = _systemDark ? 'dark' : 'light';
Appearance.getColorScheme = () => _lockedScheme;
// @ts-ignore — congelamos el listener para que no haya flips inconsistentes
Appearance.addChangeListener = () => ({ remove: () => {} });

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
      try {
        // Precargar el almacenamiento (token/usuario) — necesario en nativo para
        // poder leerlo de forma síncrona en el resto de la app.
        await hydrateStorage();

        const saved = getItem(TOKEN_KEY);
        if (saved) {
          api.setToken(saved);
          try {
            const meRes = await api.me();
            // Actualizar datos de usuario con la info más reciente del servidor
            if (meRes.data) {
              setItem(USER_KEY, JSON.stringify(meRes.data));
            }
            // Token válido — app/index.tsx se encarga del routing según el rol almacenado
          } catch {
            // Token expirado, inválido o backend no disponible — limpiar sesión
            // app/index.tsx detectará que no hay token y redirigirá al login
            removeItem(TOKEN_KEY);
            removeItem(USER_KEY);
            api.setToken(null);
          }
        }
      } finally {
        // Siempre marcar listo y ocultar el splash, aunque algo falle, para no
        // dejar la app colgada en la pantalla de carga.
        setReady(true);
        SplashScreen.hideAsync();
      }
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
