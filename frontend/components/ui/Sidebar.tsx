import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, Platform } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
  { name: 'index', label: 'Dashboard', icon: 'grid', activeColor: '#5B8DEF' },
  { name: 'inquilinos', label: 'Inquilinos', icon: 'people', activeColor: '#F59E0B' },
  { name: 'departamentos', label: 'Departamentos', icon: 'business', activeColor: '#10B981' },
  { name: 'contratos', label: 'Contratos', icon: 'document-text', activeColor: '#8B5CF6' },
  { name: 'pagos', label: 'Pagos', icon: 'card', activeColor: '#3B82F6' },
  { name: 'tickets', label: 'Tickets', icon: 'chatbox-ellipses', activeColor: '#EF4444' },
  { name: 'configuracion', label: 'Configuración', icon: 'settings', activeColor: '#6B7280' },
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
    if (name === 'index') return pathname === '/' || pathname === '/(admin)' || pathname === '';
    return pathname.includes(name);
  };

  return (
    <View style={[
      styles.container,
      {
        borderRightColor: theme.border,
        backgroundColor: isDark ? 'rgba(13, 15, 24, 0.98)' : 'rgba(255, 255, 255, 0.97)',
        shadowColor: '#000',
        shadowOpacity: isDark ? 0.5 : 0.08,
        shadowRadius: 24,
        shadowOffset: { width: 4, height: 0 },
        elevation: 12,
      }
    ]}>
      <BlurView
        intensity={isDark ? Theme.blur.intensityDark : Theme.blur.intensityHigh}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />

      {/* Logo header */}
      <View style={styles.header}>
        <LinearGradient
          colors={['#6366F1', '#4F46E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logo}
        >
          <Ionicons name="home" size={18} color="#fff" />
        </LinearGradient>
        <View>
          <Text style={[styles.brand, { color: theme.text }]}>VertexRent</Text>
          <Text style={[styles.brandSub, { color: theme.textMuted }]}>Gestión de renta</Text>
        </View>
      </View>

      {/* Separador */}
      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* Nav items */}
      <View style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = isCurrentRoute(item.name);

          return (
            <TouchableOpacity
              key={item.name}
              style={[
                styles.navItem,
                active && {
                  backgroundColor: isDark
                    ? `${item.activeColor}18`
                    : `${item.activeColor}14`,
                },
                Platform.OS === 'web' && !active && ({ ':hover': { backgroundColor: theme.surface } } as any),
              ]}
              onPress={() =>
                router.push(`/(admin)/${item.name === 'index' ? '' : item.name}` as any)
              }
              activeOpacity={0.75}
            >
              {active && (
                <View style={[styles.activeBar, { backgroundColor: item.activeColor }]} />
              )}
              <View style={[
                styles.iconBox,
                {
                  backgroundColor: active ? item.activeColor : 'transparent',
                }
              ]}>
                <Ionicons
                  name={active ? (item.icon as any) : (`${item.icon}-outline` as any)}
                  size={18}
                  color={active ? '#fff' : theme.textSecondary}
                />
              </View>
              <Text style={[
                styles.navLabel,
                {
                  color: active ? theme.text : theme.textSecondary,
                  fontWeight: active ? '700' : '500',
                }
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer — perfil y logout */}
      <View style={styles.footer}>
        <View style={[styles.footerDivider, { backgroundColor: theme.border }]} />
        <TouchableOpacity
          style={[
            styles.profileBox,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
              borderColor: theme.border,
            }
          ]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.profileRole, { color: theme.textMuted }]}>
              Cerrar sesión
            </Text>
          </View>
          <Ionicons name="log-out-outline" size={16} color={theme.textMuted} />
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
    paddingTop: 32,
    paddingBottom: 20,
    flexShrink: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  brand: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
    marginBottom: 16,
    opacity: 0.8,
  },
  nav: {
    flex: 1,
    paddingHorizontal: 10,
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 12,
    gap: 11,
    position: 'relative',
    overflow: 'hidden',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  navLabel: {
    fontSize: 14,
    letterSpacing: -0.1,
  },
  footer: {
    paddingHorizontal: 10,
  },
  footerDivider: {
    height: 1,
    marginBottom: 12,
    opacity: 0.7,
  },
  profileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  profileName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  profileRole: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
});
