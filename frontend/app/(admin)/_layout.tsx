import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme, View, Platform, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { connectSSE, disconnectSSE } from '../../services/sseClient';
import { resubscribeWebPushIfGranted, showWebNotification } from '../../services/webNotifications';
import { useSSEEvent } from '../../hooks/useSSE';
import api from '../../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Sidebar } from '../../components/ui/Sidebar';
import { TopBar } from '../../components/ui/TopBar';

const DOCK_ITEMS = [
  { name: 'index',         icon: 'grid',           iconFilled: 'grid',          color: '#3B82F6' },
  { name: 'inquilinos',    icon: 'people-outline',  iconFilled: 'people',        color: '#F59E0B' },
  { name: 'tickets',       icon: 'chatbox-ellipses-outline', iconFilled: 'chatbox-ellipses', color: '#EF4444' },
  { name: 'pagos',         icon: 'card-outline',    iconFilled: 'card',          color: '#10B981' },
  { name: 'scan',          icon: 'qr-code-outline', iconFilled: 'qr-code',       color: '#3B82F6' },
  { name: 'configuracion', icon: 'settings-outline', iconFilled: 'settings',    color: '#6B7280' },
];

function DockButton({
  focused,
  iconName,
  color,
  onPress,
  isDark,
}: {
  focused: boolean;
  iconName: string;
  color: string;
  onPress: () => void;
  isDark: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.dockItem} activeOpacity={0.7}>
      <View style={[
        styles.dockIcon,
        {
          backgroundColor: focused
            ? color
            : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
          transform: [{ scale: focused ? 1.08 : 1 }],
        }
      ]}>
        <Ionicons name={iconName as any} size={20} color={focused ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.45)')} />
      </View>
      {focused && (
        <View style={[styles.dockDot, { backgroundColor: color }]} />
      )}
    </TouchableOpacity>
  );
}

export default function AdminLayout() {
  usePushNotifications();

  const [usaQrInquilinos, setUsaQrInquilinos] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    void resubscribeWebPushIfGranted();
    const token = api.getToken();
    if (token) connectSSE(token, api.getBaseUrl());
    return () => disconnectSSE();
  }, []);

  useEffect(() => {
    api.getConfig()
      .then(r => setUsaQrInquilinos((r.data || {})['usa_qr_inquilinos'] !== 'false'))
      .catch(() => {});
  }, []);

  useSSEEvent('comprobante_subido', (data) => {
    const inq = data.inquilino;
    showWebNotification('📎 Comprobante recibido', `Depto ${inq?.depto_numero} — ${inq?.nombre_completo}`);
  });

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {isDesktop && <Sidebar isDark={isDark} />}
      <View style={[styles.mainContent, isDesktop && { borderLeftWidth: 0 }]}>
        {isDesktop && <TopBar isDark={isDark} />}
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: { display: 'none' },
          }}
          tabBar={(props) =>
            !isDesktop ? (
              <View style={[styles.dockWrapper, { bottom: Math.max(insets.bottom + 10, 18) }]}>
                <BlurView
                  intensity={isDark ? 30 : 50}
                  tint={isDark ? 'dark' : 'light'}
                  style={[
                    styles.dockContainer,
                    {
                      borderColor: theme.glassBorder,
                      backgroundColor: isDark
                        ? 'rgba(14,19,33,0.55)'
                        : 'rgba(255,255,255,0.7)',
                    }
                  ]}
                >
                  {props.state.routes.map((route, index) => {
                    const dockItem = DOCK_ITEMS.find(
                      d => route.name === d.name ||
                           route.name === `${d.name}/index` ||
                           route.name === d.name
                    );
                    if (!dockItem) return null;
                    if (dockItem.name === 'scan' && !usaQrInquilinos) return null;

                    const isFocused = props.state.index === index;
                    const iconName = isFocused ? dockItem.iconFilled : dockItem.icon;

                    return (
                      <DockButton
                        key={route.key}
                        focused={isFocused}
                        iconName={iconName}
                        color={dockItem.color}
                        isDark={isDark}
                        onPress={() => {
                          const event = props.navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                          });
                          if (!isFocused && !event.defaultPrevented) {
                            props.navigation.navigate(route.name);
                          }
                        }}
                      />
                    );
                  })}
                </BlurView>
              </View>
            ) : null
          }
        >
          <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
          <Tabs.Screen name="inquilinos" options={{ title: 'Inquilinos' }} />
          <Tabs.Screen name="tickets" options={{ title: 'Tickets' }} />
          <Tabs.Screen name="pagos" options={{ title: 'Pagos' }} />
          <Tabs.Screen name="scan" options={{ title: 'Escanear' }} />
          <Tabs.Screen name="departamentos" options={{ title: 'Departamentos' }} />
          <Tabs.Screen name="contratos" options={{ title: 'Contratos' }} />
          <Tabs.Screen name="reportes" options={{ title: 'Reportes' }} />
          <Tabs.Screen name="configuracion" options={{ title: 'Ajustes' }} />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContent: {
    flex: 1,
    minWidth: 0, // Evita que el contenido desborde la sidebar en flex
    overflow: 'hidden',
  },
  dockWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  dockContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  dockItem: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  dockIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dockDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
});
