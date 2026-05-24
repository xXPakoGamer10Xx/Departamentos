import React from 'react';
import { StyleSheet, TouchableOpacity, Text, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}

export function QuickAction({ icon, label, onPress, color }: QuickActionProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)' },
        isDark ? styles.borderDark : styles.borderLight
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: (color || theme.primary) + '15' }]}>
        <Ionicons name={icon} size={22} color={color || theme.primary} />
      </View>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
  },
  borderDark: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  borderLight: {
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
