import React, { useState } from 'react';
import {
  View, StyleSheet, useColorScheme, TouchableOpacity, Modal, Text, FlatList, ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

interface NotifItem {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  urgency: 'alta' | 'media' | 'baja';
  onPress?: () => void;
}

function buildNotifications(inquilinos: any[], router: any): NotifItem[] {
  const items: NotifItem[] = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  for (const inq of inquilinos) {
    if (inq.fecha_termino) {
      const termino = new Date(inq.fecha_termino);
      termino.setHours(0, 0, 0, 0);
      const diff = Math.round((termino.getTime() - hoy.getTime()) / 86400000);
      if (diff >= 0 && diff <= 30) {
        const urgency = diff <= 7 ? 'alta' : diff <= 15 ? 'media' : 'baja';
        items.push({
          id: `term_${inq.id}`,
          icon: 'document-text',
          iconColor: urgency === 'alta' ? '#EF4444' : urgency === 'media' ? '#F59E0B' : '#10B981',
          title: diff === 0 ? 'Contrato vence hoy' : `Contrato vence en ${diff} día${diff !== 1 ? 's' : ''}`,
          subtitle: `${inq.nombre_completo} · Depto ${inq.depto_numero}`,
          urgency,
          onPress: () => router.push(`/(admin)/contratos/generar/${inq.id}` as any),
        });
      }
    }

    if (inq.fecha_pago) {
      const diaHoy = hoy.getDate();
      const diaPago = parseInt(String(inq.fecha_pago).match(/\d{1,2}/)?.[0] ?? '', 10);
      if (diaPago) {
        let diff = diaPago - diaHoy;
        if (diff < 0) {
          const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
          diff = diasMes - diaHoy + diaPago;
        }
        if (diff >= 0 && diff <= 5) {
          items.push({
            id: `pago_${inq.id}`,
            icon: 'cash',
            iconColor: diff === 0 ? '#EF4444' : '#3B82F6',
            title: diff === 0 ? 'Pago de renta hoy' : `Pago de renta en ${diff} día${diff !== 1 ? 's' : ''}`,
            subtitle: `${inq.nombre_completo} · $${Number(inq.renta).toLocaleString()}`,
            urgency: diff === 0 ? 'alta' : 'media',
            onPress: () => router.push(`/(admin)/inquilinos/${inq.id}` as any),
          });
        }
      }
    }
  }

  return items.sort((a, b) => {
    const order = { alta: 0, media: 1, baja: 2 };
    return order[a.urgency] - order[b.urgency];
  });
}

export function NotificationBell({ isDark: passedIsDark, style }: { isDark?: boolean; style?: any }) {
  const colorScheme = useColorScheme();
  const isDark = passedIsDark !== undefined ? passedIsDark : colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const router = useRouter();

  const [show, setShow] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(false);

  const abrir = async () => {
    setShow(true);
    setLoading(true);
    try {
      const res = await api.getInquilinos({ estado: 'activo' });
      setNotifs(buildNotifications(res.data || [], router));
    } catch {
      setNotifs([]);
    } finally {
      setLoading(false);
    }
  };

  const urgentes = notifs.filter(n => n.urgency === 'alta').length;

  return (
    <>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)' }, style]}
        onPress={abrir}
        activeOpacity={0.7}
      >
        <Ionicons name="notifications-outline" size={20} color={theme.text} />
        {urgentes > 0 && <View style={[styles.dot, { borderColor: theme.card }]} />}
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShow(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.panelWrap}>
            <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <Text style={[styles.title, { color: theme.text }]}>Notificaciones</Text>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Ionicons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {loading ? (
                <View style={styles.empty}><ActivityIndicator size="small" color={theme.primary} /></View>
              ) : notifs.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="checkmark-circle-outline" size={40} color={theme.success} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Todo al día, sin alertas pendientes</Text>
                </View>
              ) : (
                <FlatList
                  data={notifs}
                  keyExtractor={i => i.id}
                  style={{ maxHeight: 400 }}
                  scrollEnabled={notifs.length > 5}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.item, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
                      onPress={() => { setShow(false); item.onPress?.(); }}
                    >
                      <View style={[styles.itemIcon, { backgroundColor: item.iconColor + '20' }]}>
                        <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
                        <Text style={[styles.itemSub, { color: theme.textSecondary }]} numberOfLines={1}>{item.subtitle}</Text>
                      </View>
                      {item.urgency === 'alta' && <View style={styles.urgentDot} />}
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  dot: {
    position: 'absolute', top: 7, right: 7, width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#FB7185', borderWidth: 2,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(9,10,15,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  panelWrap: { width: '100%', maxWidth: 400 },
  panel: { width: '100%', maxHeight: 480, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 18, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  itemIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  itemTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  itemSub: { fontSize: 12, opacity: 0.75 },
  urgentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FB7185', flexShrink: 0 },
  empty: { padding: 40, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
