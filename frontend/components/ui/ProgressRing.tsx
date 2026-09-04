import React from 'react';
import { View, Platform } from 'react-native';

interface ProgressRingProps {
  size?: number;
  strokeWidth?: number;
  progress: number; // 0-100
  color: string;
  trackColor: string;
  fillColor?: string; // color detrás del anillo (fondo de la card) — para el "agujero" en web
  children?: React.ReactNode;
}

/**
 * Anillo de progreso sin dependencias. En web usa `conic-gradient` (gauge exacto);
 * en nativo cae a un anillo simple con el color de progreso.
 */
export function ProgressRing({
  size = 52,
  strokeWidth = 5,
  progress,
  color,
  trackColor,
  fillColor,
  children,
}: ProgressRingProps) {
  const pct = Math.max(0, Math.min(100, progress));
  const radius = size / 2;

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          { width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' },
          { backgroundImage: `conic-gradient(${color} ${pct * 3.6}deg, ${trackColor} 0deg)` } as any,
        ]}
      >
        <View
          style={{
            position: 'absolute',
            top: strokeWidth,
            left: strokeWidth,
            right: strokeWidth,
            bottom: strokeWidth,
            borderRadius: radius,
            backgroundColor: fillColor ?? 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        borderWidth: strokeWidth,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}
