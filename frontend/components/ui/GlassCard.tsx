import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp, Platform } from 'react-native';
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
  elevated?: boolean;
  variant?: 'default' | 'elevated' | 'flat';
  minHeight?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  intensity,
  borderRadius = Theme.borderRadius.xl,
  border = true,
  padding = Theme.spacing.xl,
  elevated = true,
  variant = 'default',
  minHeight,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  // Blur más bajo en dark para no perder legibilidad
  const defaultIntensity = isDark ? Theme.blur.intensityDark : Theme.blur.intensity;
  const blurIntensity = intensity ?? defaultIntensity;

  const getShadow = () => {
    if (!elevated || variant === 'flat') return {};
    if (variant === 'elevated') {
      return {
        shadowColor: '#000',
        shadowOpacity: isDark ? 0.55 : 0.12,
        shadowRadius: isDark ? 28 : 20,
        shadowOffset: { width: 0, height: isDark ? 12 : 8 },
        elevation: 12,
      };
    }
    // default
    return {
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.45 : 0.08,
      shadowRadius: isDark ? 20 : 14,
      shadowOffset: { width: 0, height: isDark ? 8 : 4 },
      elevation: 8,
    };
  };

  return (
    <View
      style={[
        elevated && variant !== 'flat' && { borderRadius },
        getShadow(),
        minHeight ? { minHeight } : undefined,
        style,
      ]}
    >
      <View
        style={[
          styles.innerContainer,
          {
            borderRadius,
            backgroundColor: theme.glass,
            minHeight,
          },
        ]}
      >
        {Platform.OS === 'android' ? (
          <View
            style={[
              styles.blur,
              {
                borderRadius,
                backgroundColor: isDark ? 'rgba(15,17,26,0.96)' : 'rgba(255,255,255,0.97)',
              },
              border && {
                borderWidth: StyleSheet.hairlineWidth * 1.5,
                borderColor: theme.glassBorder,
              },
            ]}
          >
            <View style={[styles.content, { padding }]}>{children}</View>
          </View>
        ) : (
          <BlurView
            intensity={blurIntensity}
            tint={isDark ? 'dark' : 'light'}
            style={[
              styles.blur,
              { borderRadius },
              border && {
                borderWidth: StyleSheet.hairlineWidth * 1.5,
                borderColor: theme.glassBorder,
              },
            ]}
          >
            <View style={[styles.content, { padding }]}>{children}</View>
          </BlurView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  innerContainer: {
    overflow: 'hidden',
    width: '100%',
  },
  blur: {
    width: '100%',
  },
  content: {
    width: '100%',
  },
});
