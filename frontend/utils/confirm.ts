import { Alert, Platform } from 'react-native';

/**
 * Confirmación cross-platform.
 *
 * En RN Web, `Alert.alert` con botones NO ejecuta los callbacks (solo funciona
 * el de un botón), así que un `onPress` de "Eliminar" nunca corre y parece que
 * el botón "no hace nada". Aquí usamos `window.confirm` en web y `Alert.alert`
 * en nativo. Resuelve a `true` si el usuario aceptó.
 */
export function confirmar(
  titulo: string,
  mensaje = '',
  opts: { confirmLabel?: string; destructive?: boolean } = {},
): Promise<boolean> {
  const { confirmLabel = 'Aceptar', destructive = false } = opts;

  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(mensaje ? `${titulo}\n\n${mensaje}` : titulo));
  }

  return new Promise(resolve => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
