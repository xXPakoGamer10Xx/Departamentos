module.exports = {
  expo: {
    name: 'NethRent',
    slug: 'nethrent',
    scheme: 'nethrent',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: false,
    splash: {
      image: './assets/adaptive-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0E1321',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.vertexrent.app',
    },
    android: {
      package: 'com.vertexrent.app',
      googleServicesFile: './google-services.json',
      versionCode: 3,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0E1321',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      softwareKeyboardLayoutMode: 'pan',
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      'expo-router',
      '@react-native-community/datetimepicker',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#2563EB',
          defaultChannel: 'default',
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#0E1321',
          image: './assets/adaptive-icon.png',
          dark: {
            backgroundColor: '#0E1321',
            image: './assets/adaptive-icon.png',
          },
          imageWidth: 200,
        },
      ],
      'expo-font',
    ],
    extra: {
      eas: {
        projectId: '1f892520-31c7-4a1e-9db4-ae1b07a68ce7',
      },
      router: {},
    },
    owner: 'xxpakogamer10xx',
  },
};
