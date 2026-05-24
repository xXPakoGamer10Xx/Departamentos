export const Theme = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 20,
    xl: 24,
    full: 9999,
  },
  blur: {
    intensity: 25,
  },
  typography: {
    display: {
      fontSize: 34,
      fontWeight: '800' as const,
      letterSpacing: -1,
    },
    h1: {
      fontSize: 28,
      fontWeight: '700' as const,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: 22,
      fontWeight: '700' as const,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600' as const,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
    },
    label: {
      fontSize: 14,
      fontWeight: '600' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
    },
    caption: {
      fontSize: 12,
      fontWeight: '500' as const,
    },
  },
  layout: {
    sidebarWidth: 280,
    topBarHeight: 64,
    maxWidth: 1200,
  },
  breakpoints: {
    tablet: 768,
    desktop: 1024,
  },
};
