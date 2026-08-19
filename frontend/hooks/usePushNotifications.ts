import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Expo Go (SDK 53+) eliminó push remotos — solo funciona en dev build o APK
const isExpoGo = Constants.appOwnership === 'expo';

export function usePushNotifications() {
  const registered = useRef(false);

  useEffect(() => {
    if (isExpoGo || Platform.OS === 'web' || registered.current) return;
    registered.current = true;
    void registerDevice();
  }, []);
}

async function registerDevice() {
  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');
    const api = (await import('../services/api')).default;

    if (!Device.isDevice) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'VertexRent',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    // En builds standalone (APK/EAS) expo-notifications no siempre puede
    // deducir el projectId por su cuenta — hay que pasarlo explícito o
    // getExpoPushTokenAsync() lanza y el registro queda silenciosamente
    // sin hacerse en cada arranque de la app.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('[push] No se encontró el projectId de EAS — no se puede obtener el token');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.registerPushToken(tokenData.data);
  } catch (err) {
    console.warn('[push] No se pudo registrar el dispositivo para notificaciones:', err);
  }
}
