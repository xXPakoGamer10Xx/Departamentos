import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '../../constants/Colors';

export interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'default';
  size?: 'sm' | 'md';
}

export function Badge({ label, variant = 'default', size = 'md' }: BadgeProps) {
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  const getColorSet = () => {
    switch (variant) {
      case 'primary': return { bg: theme.primaryLight, text: theme.primary };
      case 'success': return { bg: theme.successLight, text: theme.success };
      case 'warning': return { bg: theme.warningLight, text: theme.warning };
      case 'danger': return { bg: theme.dangerLight, text: theme.danger };
      case 'info': return { bg: theme.infoLight, text: theme.info };
      case 'default':
      default:
        return {
          bg: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.07)',
          text: theme.textSecondary,
        };
    }
  };

  const colors = getColorSet();

  return (
    <View
      style={[
        styles.container,
        size === 'sm' && styles.containerSm,
        { backgroundColor: colors.bg },
      ]}
    >
      <Text
        style={[
          styles.label,
          size === 'sm' && styles.labelSm,
          { color: colors.text },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  labelSm: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
