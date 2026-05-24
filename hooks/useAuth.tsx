import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Platform } from 'react-native';
import api from '../services/api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

const storage = {
  get: (key: string): string | null => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  },
  set: (key: string, value: string) => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  },
  remove: (key: string) => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  },
};

interface User {
  id: string;
  email: string;
  nombre_completo: string;
  rol: 'admin' | 'inquilino';
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on startup
  useEffect(() => {
    const savedToken = storage.get(TOKEN_KEY);
    const savedUser = storage.get(USER_KEY);
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
        api.setToken(savedToken);
      } catch {
        storage.remove(TOKEN_KEY);
        storage.remove(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.data) {
        const { token: newToken, user: newUser } = res.data;
        setToken(newToken);
        setUser(newUser);
        api.setToken(newToken);
        storage.set(TOKEN_KEY, newToken);
        storage.set(USER_KEY, JSON.stringify(newUser));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    api.setToken(null);
    storage.remove(TOKEN_KEY);
    storage.remove(USER_KEY);
  };

  return (
    // @ts-ignore
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
