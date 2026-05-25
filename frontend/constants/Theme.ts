export const Theme = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    full: 9999,
  },
  blur: {
    intensity: 50,
    intensityHigh: 70,
    intensityDark: 20,
  },
  typography: {
    display: {
      fontSize: 40,
      fontWeight: '800' as const,
      letterSpacing: -1.5,
    },
    h1: {
      fontSize: 32,
      fontWeight: '800' as const,
      letterSpacing: -1,
    },
    h2: {
      fontSize: 24,
      fontWeight: '700' as const,
      letterSpacing: -0.5,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600' as const,
      letterSpacing: -0.3,
    },
    bodyLarge: {
      fontSize: 17,
      fontWeight: '500' as const,
    },
    body: {
      fontSize: 15,
      fontWeight: '400' as const,
    },
    label: {
      fontSize: 12,
      fontWeight: '700' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
    },
    caption: {
      fontSize: 13,
      fontWeight: '500' as const,
    },
  },
  shadows: {
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 4,
    },
    lg: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 20,
      elevation: 8,
    },
    xl: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 28,
      elevation: 12,
    },
  },
  layout: {
    sidebarWidth: 260,
    topBarHeight: 72,
    maxWidth: 1200,
    // Altura del dock flotante en mobile — usar como paddingBottom en todas las pantallas
    dockHeight: 104,
  },
  breakpoints: {
    // Subido de 768 a 900 para evitar que sidebar comprima el contenido en tablets pequeñas
    tablet: 900,
    desktop: 1024,
  },
};
