import {
  StyleSheet, View, Text, TouchableOpacity,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { GlassCard } from '../../components/ui/GlassCard';

export default function ConfirmarPagoScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [pago, setPago] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [done, setDone] = useState(false);
  const [yaConfirmado, setYaConfirmado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    api.getPagoByToken(token)
      .then(r => {
        setPago(r.data);
        if (r.data?.confirmado) setYaConfirmado(true);
      })
      .catch(() => setError('QR inválido o expirado'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleConfirmar = async () => {
    if (!token) return;
    setConfirmando(true);
    try {
      const res = await api.confirmarPago(token) as any;
      setPago(res.data);
      setDone(true);
      if (res.yaConfirmado) setYaConfirmado(true);
    } catch (e: any) {
      setError(e.message || 'Error al confirmar');
    } finally {
      setConfirmando(false);
    }
  };

  const fmtRenta = (n: number) =>
    `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#090A0F', '#181528', '#07080D']} style={StyleSheet.absoluteFill} />

      <GlassCard style={[styles.card, isDesktop && styles.cardDesktop]} borderRadius={24} border={true} padding={isDesktop ? 48 : 32}>
        {loading ? (
          <ActivityIndicator size="large" color="#3B82F6" />
        ) : error ? (
          <>
            <View style={[styles.iconCircle, { backgroundColor: '#E11D4820' }]}>
              <Ionicons name="close-circle-outline" size={48} color="#FB7185" />
            </View>
            <Text style={styles.errorTitle}>QR Inválido</Text>
            <Text style={styles.errorSub}>{error}</Text>
          </>
        ) : done || yaConfirmado ? (
          <>
            <View style={[styles.iconCircle, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="checkmark-circle" size={48} color="#34D399" />
            </View>
            <Text style={styles.successTitle}>
              {yaConfirmado && !done ? '¡Ya estaba pagado!' : '¡Pago confirmado!'}
            </Text>
            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color="rgba(255,255,255,0.6)" />
                <Text style={styles.detailText}>{pago?.nombre_completo}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="business-outline" size={16} color="rgba(255,255,255,0.6)" />
                <Text style={styles.detailText}>Depto {pago?.depto_numero}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="cash-outline" size={16} color="rgba(255,255,255,0.6)" />
                <Text style={styles.detailText}>{fmtRenta(pago?.monto || pago?.renta || 0)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.6)" />
                <Text style={styles.detailText}>{pago?.periodo}</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={[styles.iconCircle, { backgroundColor: '#3B82F620' }]}>
              <Ionicons name="cash-outline" size={48} color="#3B82F6" />
            </View>
            <Text style={styles.payTitle}>Confirmar pago en efectivo</Text>

            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color="rgba(255,255,255,0.6)" />
                <Text style={styles.detailText}>{pago?.nombre_completo}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="business-outline" size={16} color="rgba(255,255,255,0.6)" />
                <Text style={styles.detailText}>Depto {pago?.depto_numero}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.6)" />
                <Text style={styles.detailText}>{pago?.periodo}</Text>
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Monto</Text>
                <Text style={styles.amountValue}>{fmtRenta(pago?.monto || pago?.renta || 0)}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                {
                  opacity: confirmando ? 0.7 : 1,
                  shadowColor: '#10B981',
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                }
              ]}
              onPress={handleConfirmar}
              disabled={confirmando}
            >
              {confirmando
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              }
              <Text style={styles.confirmBtnText}>
                {confirmando ? 'Confirmando…' : 'Confirmar pago'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 16,
  },
  cardDesktop: {},
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorTitle: { color: '#EF4444', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  errorSub: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' },
  successTitle: { color: '#10B981', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  payTitle: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },

  details: { width: '100%', gap: 10, marginTop: 8 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '500' },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  amountLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  amountValue: { color: '#fff', fontSize: 28, fontWeight: '900' },

  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    width: '100%',
    justifyContent: 'center',
    marginTop: 8,
  },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
