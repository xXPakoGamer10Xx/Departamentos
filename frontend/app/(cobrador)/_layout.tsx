import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Platform, useColorScheme, View, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { connectSSE, disconnectSSE } from '../../services/sseClient';
import api from '../../services/api';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const DOCK_ITEMS = [
  { name: 'scan',          icon: 'qr-code-outline',         iconFilled: 'qr-code',          color: '#8B5CF6' },
  { name: 'comprobantes',  icon: 'document-attach-outline',  iconFilled: 'document-attach',   color: '#10B981' },
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
        <Ionicons
          name={iconName as any}
          size={20}
          color={focused ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.45)')}
        />
      </View>
      {focused && (
        <View style={[styles.dockDot, { backgroundColor: color }]} />
      )}
    </TouchableOpacity>
  );
}

export default function CobradorLayout() {
  usePushNotifications();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const token = api.getToken();
    if (token) connectSSE(token, api.getBaseUrl());
    return () => disconnectSSE();
  }, []);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={(props) => (
        <View style={[styles.dockWrapper, { bottom: Math.max(insets.bottom + 10, 18) }]}>
          <BlurView
            intensity={isDark ? 30 : 50}
            tint={isDark ? 'dark' : 'light'}
            style={[
              styles.dockContainer,
              {
                borderColor: theme.glassBorder,
                backgroundColor: isDark
                  ? 'rgba(13,15,24,0.5)'
                  : 'rgba(255,255,255,0.7)',
              }
            ]}
          >
            {props.state.routes.map((route, index) => {
              const dockItem = DOCK_ITEMS.find(d => route.name === d.name);
              if (!dockItem) return null;

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
      )}
    >
      <Tabs.Screen name="scan" options={{ title: 'Escanear' }} />
      <Tabs.Screen name="comprobantes" options={{ title: 'Comprobantes' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
    paddingHorizontal: 20,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  dockIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
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
