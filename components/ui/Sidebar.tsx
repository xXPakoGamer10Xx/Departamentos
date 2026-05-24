import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, Platform } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter, usePathname } from 'expo-router';

const USER_KEY = 'auth_user';
const TOKEN_KEY = 'auth_token';

interface NavItem {
  name: string;
  label: string;
  icon: any;
  activeColor: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'index', label: 'Dashboard', icon: 'grid', activeColor: '#007AFF' },
  { name: 'inquilinos', label: 'Inquilinos', icon: 'people', activeColor: '#FF9500' },
  { name: 'departamentos', label: 'Departamentos', icon: 'business', activeColor: '#34C759' },
  { name: 'contratos', label: 'Contratos', icon: 'document-text', activeColor: '#AF52DE' },
  { name: 'pagos', label: 'Pagos', icon: 'card', activeColor: '#34C759' },
  { name: 'configuracion', label: 'Configuración', icon: 'settings', activeColor: '#8E8E93' },
];

export function Sidebar({ isDark: passedIsDark }: { isDark?: boolean }) {
  const colorScheme = useColorScheme();
  const isDark = passedIsDark !== undefined ? passedIsDark : colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const pathname = usePathname();
  const [userData, setUserData] = useState<{ nombre_completo?: string; email?: string } | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) {
        try { setUserData(JSON.parse(raw)); } catch {}
      }
    }
  }, []);

  const handleLogout = () => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    router.replace('/(auth)/login');
  };

  const displayName = userData?.nombre_completo || 'Admin User';
  const initials = displayName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();

  const isCurrentRoute = (name: string) => {
    if (name === 'index') return pathname === '/' || pathname === '/(admin)';
    return pathname.includes(name);
  };
  return (
    <View style={[
      styles.container, 
      { 
        borderRightColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        backgroundColor: isDark ? 'rgba(10,10,10,0.8)' : 'rgba(255,255,255,0.9)'
      }
    ]}>
      <BlurView intensity={isDark ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      
      <View style={styles.header}>
        <View style={[
          styles.logo, 
          { 
            backgroundColor: theme.primary, 
            shadowColor: theme.primary, 
            shadowOpacity: isDark ? 0.5 : 0.2,
            shadowRadius: 10,
            elevation: 8
          }
        ]}>
          <Ionicons name="home" size={24} color="#fff" />
        </View>
        <Text style={[styles.brand, { color: theme.text }]}>Admin Depas</Text>
      </View>

      <View style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = isCurrentRoute(item.name);
          
          return (
            <TouchableOpacity
              key={item.name}
              style={[
                styles.navItem,
                active && { 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,122,255,0.08)',
                }
              ]}
              onPress={() => router.push(`/(admin)/${item.name === 'index' ? '' : item.name}`)}
            >
              <View style={[
                styles.iconBox, 
                { 
                  backgroundColor: active ? item.activeColor : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)') 
                }
              ]}>
                <Ionicons 
                  name={active ? (item.icon as any) : (`${item.icon}-outline` as any)} 
                  size={20} 
                  color={active ? '#fff' : (isDark ? theme.textSecondary : 'rgba(0,0,0,0.4)')} 
                />
              </View>
              <Text style={[
                styles.navLabel, 
                { 
                  color: active ? (isDark ? theme.text : theme.primary) : theme.textSecondary,
                  fontWeight: active ? '700' : '500'
                }
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.profileBox,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              borderWidth: 1,
            }
          ]}
          onPress={handleLogout}
        >
          <View style={[styles.avatar, { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
            <Text style={[styles.profileRole, { color: theme.textSecondary }]}>Cerrar sesión</Text>
          </View>
          <Ionicons name="log-out-outline" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: Theme.layout.sidebarWidth,
    height: '100%',
    borderRightWidth: 1,
    paddingTop: 60,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 48,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  brand: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  nav: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 16,
    letterSpacing: -0.3,
  },
  footer: {
    paddingHorizontal: 16,
    marginTop: 'auto',
  },
  profileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  profileRole: {
    fontSize: 12,
    opacity: 0.5,
    fontWeight: '500',
  },
});

