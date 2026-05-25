import { Redirect } from 'expo-router';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

function getInitialRoute(): string {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return '/(auth)/login';
    try {
      const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      return user?.rol === 'inquilino' ? '/(inquilino)' : '/(admin)';
    } catch {
      return '/(admin)';
    }
  }
  return '/(auth)/login';
}

export default function Index() {
  return <Redirect href={getInitialRoute() as any} />;
}
