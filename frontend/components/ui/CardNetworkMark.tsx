import { View, Text, StyleSheet } from 'react-native';
import { CardNetwork } from '../../utils/bankBrand';

// Distintivo de red estilizado (no es el arte oficial de las marcas, que son
// propiedad registrada de Visa/Mastercard/Amex) pero mantiene su forma y
// color característicos para que se identifiquen de inmediato en la tarjeta.
export function CardNetworkMark({ network, size = 34 }: { network: CardNetwork; size?: number }) {
  if (!network) return null;

  if (network === 'mastercard') {
    const d = size;
    const overlap = d * 0.42;
    return (
      <View style={[styles.mcWrap, { width: d + overlap, height: d }]}>
        <View style={[styles.mcCircle, { width: d, height: d, borderRadius: d / 2, backgroundColor: '#EB001B', left: 0 }]} />
        <View style={[styles.mcCircle, { width: d, height: d, borderRadius: d / 2, backgroundColor: '#F79E1B', left: overlap, opacity: 0.85 }]} />
      </View>
    );
  }

  if (network === 'visa') {
    return (
      <Text style={[styles.visaText, { fontSize: size * 0.52 }]}>VISA</Text>
    );
  }

  // amex
  return (
    <View style={[styles.amexBadge, { paddingHorizontal: size * 0.22, paddingVertical: size * 0.12 }]}>
      <Text style={[styles.amexText, { fontSize: size * 0.28 }]}>AMEX</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mcWrap: { position: 'relative' },
  mcCircle: { position: 'absolute', top: 0 },
  visaText: {
    color: '#fff',
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  amexBadge: {
    backgroundColor: '#016FD0',
    borderRadius: 4,
  },
  amexText: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 1,
  },
});
