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
        name: 'Admin Depas',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    await api.registerPushToken(tokenData.data);
  } catch {
    // Push no disponible en este entorno — el polling de 20s cubre las actualizaciones
  }
}
