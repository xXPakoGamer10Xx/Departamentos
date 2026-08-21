module.exports = {
  expo: {
    name: 'VertexRent',
    slug: 'nethrent',
    scheme: 'nethrent',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icono.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: false,
    splash: {
      image: './assets/icono.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.vertexrent.app',
    },
    android: {
      package: 'com.vertexrent.app',
      googleServicesFile: './google-services.json',
      versionCode: 2,
      adaptiveIcon: {
        foregroundImage: './assets/icono.png',
        backgroundColor: '#007AFF',
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
          icon: './assets/icono.png',
          color: '#007AFF',
          defaultChannel: 'default',
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#ffffff',
          image: './assets/icono.png',
          dark: {
            backgroundColor: '#000000',
            image: './assets/icono.png',
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
