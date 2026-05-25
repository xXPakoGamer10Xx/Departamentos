const tintColorLight = '#4F46E5'; // Indigo 600
const tintColorDark = '#818CF8'; // Indigo 400

export const Colors = {
  light: {
    text: '#0F172A', // Slate 900
    textSecondary: '#475569', // Slate 600
    textMuted: '#94A3B8', // Slate 400
    background: '#F1F5F9', // Slate 100 — más cálido que el blanco puro
    card: '#FFFFFF',
    surface: '#F8FAFC', // Slate 50
    cardElevated: '#FFFFFF',
    glass: 'rgba(255, 255, 255, 0.82)',
    glassBorder: 'rgba(15, 23, 42, 0.10)',
    tint: tintColorLight,
    icon: '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorLight,
    border: 'rgba(15, 23, 42, 0.10)',
    borderStrong: 'rgba(15, 23, 42, 0.18)',
    primary: '#4F46E5', // Indigo 600
    primaryDark: '#3730A3', // Indigo 800
    primaryLight: '#EEF2FF', // Indigo 50
    success: '#059669', // Emerald 600 — más saturado
    successLight: '#D1FAE5', // Emerald 100
    warning: '#D97706', // Amber 600 — más legible
    warningLight: '#FEF3C7', // Amber 100
    danger: '#DC2626', // Red 600
    dangerLight: '#FEE2E2', // Red 100
    accent: '#7C3AED', // Violet 600
    info: '#2563EB', // Blue 600
    infoLight: '#DBEAFE', // Blue 100
  },
  dark: {
    text: '#F1F5F9', // Slate 100
    textSecondary: '#94A3B8', // Slate 400 — suficiente contraste sobre dark bg
    textMuted: '#64748B', // Slate 500 — subido de 475569 para mejor contraste
    background: '#0D0F18', // Deep dark azulado
    card: '#161929', // Slightly elevated dark
    surface: '#1E2235', // Higher elevation — más separado del bg
    cardElevated: '#232842', // Elevated card para modales y paneles
    glass: 'rgba(22, 25, 41, 0.75)',
    glassBorder: 'rgba(255, 255, 255, 0.10)', // Subido de 0.05 a 0.10
    tint: tintColorDark,
    icon: '#94A3B8',
    tabIconDefault: '#64748B',
    tabIconSelected: tintColorDark,
    border: 'rgba(255, 255, 255, 0.14)', // Subido de 0.10 a 0.14
    borderStrong: 'rgba(255, 255, 255, 0.22)',
    primary: '#6366F1', // Indigo 500
    primaryDark: '#818CF8', // Indigo 400
    primaryLight: 'rgba(99, 102, 241, 0.18)', // Más visible
    success: '#34D399', // Emerald 400
    successLight: 'rgba(52, 211, 153, 0.16)',
    warning: '#FBBF24', // Amber 400
    warningLight: 'rgba(251, 191, 36, 0.16)',
    danger: '#F87171', // Red 400
    dangerLight: 'rgba(248, 113, 113, 0.16)',
    accent: '#A78BFA', // Violet 400
    info: '#60A5FA', // Blue 400
    infoLight: 'rgba(96, 165, 250, 0.16)',
  },
};
