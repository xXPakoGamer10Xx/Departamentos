import React from 'react';
import { StyleSheet, View, ViewStyle, Platform, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColorScheme } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  borderRadius?: number;
  border?: boolean;
  padding?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  style, 
  intensity = Theme.blur.intensity,
  borderRadius = Theme.borderRadius.xl,
  border = true,
  padding = Theme.spacing.md
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <View style={[
      styles.container, 
      { 
        borderRadius,
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.7)'
      },
      style
    ]}>
      <BlurView
        intensity={intensity}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.blur,
          { borderRadius },
          border && {
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
          }
        ]}
      >
        <View style={[styles.content, { padding: padding ?? Theme.spacing.md }]}>
          {children}
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  blur: {
    flex: 1,
  },
  content: {
    padding: Theme.spacing.md,
  },
});
