import React, { type ReactNode } from 'react';
import { View, useColorScheme, type ViewStyle, type StyleProp } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';

interface SurfaceCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  borderRadius?: number;
  border?: boolean;
}

/**
 * Card sólida estilo "bento" del design system Executive Slate:
 * superficie opaca (`theme.card`) + borde hairline. Sin blur.
 */
export function SurfaceCard({
  children,
  style,
  padding = Theme.spacing.lg,
  borderRadius = Theme.borderRadius.lg,
  border = true,
}: SurfaceCardProps) {
  const t = useColorScheme() === 'dark' ? Colors.dark : Colors.light;
  return (
    <View
      style={[
        {
          backgroundColor: t.card,
          borderRadius,
          padding,
          ...(border ? { borderWidth: 1, borderColor: t.border } : null),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
