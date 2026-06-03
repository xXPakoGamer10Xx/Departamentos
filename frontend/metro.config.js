// Configuración por defecto de Metro para Expo.
// Extiende la base de Expo; agrega personalizaciones después de getDefaultConfig si las necesitas.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
