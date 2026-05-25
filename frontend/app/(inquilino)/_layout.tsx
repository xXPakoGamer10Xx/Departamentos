import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { connectSSE, disconnectSSE } from '../../services/sseClient';
import { requestWebNotificationPermission } from '../../services/webNotifications';
import api from '../../services/api';

export default function InquilinoLayout() {
  usePushNotifications();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    requestWebNotificationPermission();
    const token = api.getToken();
    if (token) connectSSE(token, api.getBaseUrl());
    return () => disconnectSSE();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 250,
      }}
    />
  );
}
