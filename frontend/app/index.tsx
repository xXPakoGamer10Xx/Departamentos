import { Redirect } from 'expo-router';
import { getItem } from '../services/storage';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

function getInitialRoute(): string {
  const token = getItem(TOKEN_KEY);
  if (!token) return '/(auth)/login';
  try {
    const user = JSON.parse(getItem(USER_KEY) || 'null');
    if (user?.rol === 'inquilino') return '/(inquilino)';
    // Los colaboradores (cobrador) usan la app de admin, limitada por permisos.
    return '/(admin)';
  } catch {
    return '/(admin)';
  }
}

export default function Index() {
  return <Redirect href={getInitialRoute() as any} />;
}
