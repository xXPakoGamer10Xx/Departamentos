import { Redirect } from 'expo-router';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';

function hasToken(): boolean {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    return !!localStorage.getItem(TOKEN_KEY);
  }
  return false;
}

export default function Index() {
  return <Redirect href={hasToken() ? '/(admin)' : '/(auth)/login'} />;
}
