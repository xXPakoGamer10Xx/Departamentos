import { StyleSheet, View, Text, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, Alert, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import api from '../../../services/api';

export default function InquilinoDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;

  const [inquilino, setInquilino] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    cargarInquilino();
  }, [id]);

  const cargarInquilino = async () => {
    try {
      setLoading(true);
      const response = await api.getInquilinoById(id as string);
      setInquilino(response.data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo cargar el inquilino');
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarContrato = async () => {
    try {
      setDownloading(true);
      const baseUrl = api.getContratoPdfUrl(id as string);
      const token = api.getToken();

      if (Platform.OS === 'web') {
        const url = `${baseUrl}?token=${encodeURIComponent(token || '')}`;
        window.open(url, '_blank');
        return;
      }

      const FileSystem = await import('expo-file-system/legacy');
      const Sharing = await import('expo-sharing');

      const fileUri = `${FileSystem.documentDirectory}contrato_${inquilino.depto_numero}_${inquilino.nombre_completo.replace(/\s+/g, '_')}.pdf`;
      const downloadRes = await FileSystem.downloadAsync(baseUrl, fileUri, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (downloadRes.status !== 200) throw new Error('Error al generar el PDF del contrato');

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(downloadRes.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Contrato de Arrendamiento',
        });
      } else {
        Alert.alert('Éxito', 'Contrato descargado, pero tu dispositivo no soporta compartir archivos.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo descargar el contrato');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!inquilino) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Inquilino no encontrado</Text>
      </View>
    );
  }

  const Section = ({ title, children }: any) => (
    <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      {children}
    </View>
  );

  const DetailRow = ({ label, value, icon }: any) => (
    <View style={styles.detailRow}>
      {icon && <Ionicons name={icon} size={20} color={theme.icon} style={styles.detailIcon} />}
      <View style={styles.detailContent}>
        <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
      </View>
    </View>
  );

  const formatFechaPago = (fechaPago?: string) => {
    if (!fechaPago) return 'N/A';
    const trimmed = String(fechaPago).trim();
    if (/de cada mes/i.test(trimmed)) return trimmed;
    const match = trimmed.match(/(\d{1,2})/);
    if (!match) return trimmed;
    return `${match[1].padStart(2, '0')} de cada mes`;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: isDesktop ? 32 : insets.bottom + 90 }}
    >
      <View style={[styles.headerCard, { backgroundColor: theme.card, borderColor: theme.border, paddingTop: isDesktop ? 24 : insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={[
            styles.badge, 
            { backgroundColor: inquilino.estado === 'activo' ? theme.success + '20' : theme.danger + '20' }
          ]}>
            <Text style={[
              styles.badgeText,
              { color: inquilino.estado === 'activo' ? theme.success : theme.danger }
            ]}>
              {inquilino.estado === 'activo' ? 'Contrato Activo' : 'Contrato Vencido'}
            </Text>
          </View>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {inquilino.nombre_completo?.substring(0, 2).toUpperCase() || 'NA'}
            </Text>
          </View>
          <Text style={[styles.name, { color: theme.text }]}>{inquilino.nombre_completo}</Text>
          <Text style={[styles.depto, { color: theme.primary }]}>Departamento {inquilino.depto_numero}</Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primary + '15' }]}>
            <Ionicons name="call" size={20} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.primary }]}>Llamar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.primary + '15' }]}
            onPress={() => router.push(`/(admin)/inquilinos/nuevo?editId=${id}` as any)}
          >
            <Ionicons name="pencil" size={20} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.primary }]}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.danger + '15', opacity: eliminando ? 0.7 : 1 }]}
            disabled={eliminando}
            onPress={() => Alert.alert(
              'Eliminar Inquilino',
              `¿Seguro que deseas eliminar a ${inquilino.nombre_completo}?`,
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Eliminar', style: 'destructive',
                  onPress: async () => {
                    setEliminando(true);
                    try {
                      await api.deleteInquilino(id as string);
                      router.back();
                    } catch (e: any) {
                      Alert.alert('Error', e.message);
                      setEliminando(false);
                    }
                  },
                },
              ]
            )}
          >
            {eliminando
              ? <ActivityIndicator size="small" color={theme.danger} />
              : <Ionicons name="trash" size={20} color={theme.danger} />
            }
            <Text style={[styles.actionText, { color: theme.danger }]}>Eliminar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.primary, opacity: downloading ? 0.7 : 1 }]}
            onPress={handleDescargarContrato}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="document-text" size={20} color="#fff" />
            )}
            <Text style={[styles.actionText, { color: '#fff' }]}>
              {downloading ? 'Generando...' : 'Contrato PDF'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <Section title="Información del Contrato">
          <DetailRow label="Renta Mensual" value={`$${inquilino.renta} (${inquilino.renta_letra})`} icon="cash-outline" />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <DetailRow label="Día de Pago" value={formatFechaPago(inquilino.fecha_pago)} icon="calendar-outline" />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <DetailRow label="Vigencia" value={`Del ${inquilino.fecha_inicio ? new Date(inquilino.fecha_inicio).toLocaleDateString() : 'N/A'}\nal ${inquilino.fecha_termino ? new Date(inquilino.fecha_termino).toLocaleDateString() : 'N/A'}`} icon="time-outline" />
        </Section>

        <Section title="Contacto y Fiador">
          <DetailRow label="Teléfono del Arrendatario" value={inquilino.tel_arrendatario || 'N/A'} icon="phone-portrait-outline" />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <DetailRow label="Nombre del Fiador" value={inquilino.fiador_nombre || 'Ninguno'} icon="person-outline" />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <DetailRow label="Teléfono del Fiador" value={inquilino.fiador_telefono || 'N/A'} icon="call-outline" />
        </Section>

        <Section title="Adicional">
          <DetailRow label="Observaciones" value={inquilino.observaciones || 'Ninguna'} icon="document-text-outline" />
        </Section>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  headerCard: {
    padding: 16,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0ea5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatarLargeText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  depto: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  actionText: {
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
    marginLeft: 32,
  }
});
