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

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      // Restore token from localStorage on web
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(TOKEN_KEY);
        if (saved) {
          api.setToken(saved);
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
        }
      }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}
