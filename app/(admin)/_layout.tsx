import { Tabs } from 'expo-router';
import { useColorScheme, View, Platform, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Sidebar } from '../../components/ui/Sidebar';
import { TopBar } from '../../components/ui/TopBar';

function TabBarIcon({ name, focused, bgColor }: { name: any, focused: boolean, bgColor: string }) {
  return (
    <View style={styles.iconWrapper}>
      <View style={[
        styles.dockIcon, 
        { 
          backgroundColor: focused ? bgColor : 'rgba(120, 120, 128, 0.12)',
          transform: [{ scale: focused ? 1.05 : 1 }]
        }
      ]}>
        <Ionicons name={name} size={20} color={focused ? "#fff" : "rgba(255,255,255,0.6)"} />
      </View>
      {focused && <View style={[styles.indicator, { backgroundColor: bgColor }]} />}
    </View>
  );
}

export default function AdminLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {isDesktop && <Sidebar isDark={isDark} />}
      <View style={styles.mainContent}>
        {isDesktop && <TopBar isDark={isDark} />}
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: {
              display: 'none',
            },
          }}
          tabBar={(props) => !isDesktop ? (
            <View style={[styles.dockWrapper, { bottom: Math.max(insets.bottom + 8, 20) }]}>
              <BlurView
                intensity={isDark ? 40 : 80}
                tint={isDark ? 'dark' : 'light'}
                style={styles.dockContainer}
              >
                {props.state.routes.map((route, index) => {
                  const { options } = props.descriptors[route.key];
                  const isFocused = props.state.index === index;

                  let isDockItem = false;
                  let iconName: any = 'grid';
                  let bgColor = theme.primary;

                  if (route.name === 'index') {
                    isDockItem = true;
                    iconName = isFocused ? 'grid' : 'grid-outline';
                    bgColor = '#007AFF'; 
                  } else if (route.name === 'inquilinos/index' || route.name === 'inquilinos') {
                    isDockItem = true;
                    iconName = isFocused ? 'people' : 'people-outline';
                    bgColor = '#FF9500';
                  } else if (route.name === 'departamentos/index' || route.name === 'departamentos') {
                    isDockItem = true;
                    iconName = isFocused ? 'business' : 'business-outline';
                    bgColor = '#34C759';
                  } else if (route.name === 'contratos/index' || route.name === 'contratos') {
                    isDockItem = true;
                    iconName = isFocused ? 'document-text' : 'document-text-outline';
                    bgColor = '#AF52DE';
                  } else if (route.name === 'configuracion/index' || route.name === 'configuracion') {
                    isDockItem = true;
                    iconName = isFocused ? 'settings' : 'settings-outline';
                    bgColor = '#8E8E93';
                  }

                  if (!isDockItem) return null;

                  const onPress = () => {
                    const event = props.navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                      props.navigation.navigate(route.name);
                    }
                  };

                  return (
                    <TouchableOpacity
                      key={route.key}
                      onPress={onPress}
                      style={styles.dockItem}
                      activeOpacity={0.7}
                    >
                      <TabBarIcon 
                        name={iconName} 
                        focused={isFocused}
                        bgColor={bgColor}
                      />
                    </TouchableOpacity>
                  );
                })}
              </BlurView>
            </View>
          ) : null}
        >
          <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
          <Tabs.Screen name="inquilinos" options={{ title: 'Inquilinos' }} />
          <Tabs.Screen name="departamentos" options={{ title: 'Departamentos' }} />
          <Tabs.Screen name="contratos" options={{ title: 'Contratos' }} />
          <Tabs.Screen name="pagos" options={{ title: 'Pagos' }} />
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
    backgroundColor: '#000', // Base fallback
  },
  mainContent: {
    flex: 1,
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
    paddingVertical: 8,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(120, 120, 128, 0.2)',
    overflow: 'hidden',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  dockItem: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  dockIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    position: 'absolute',
    bottom: -4,
  },
});

