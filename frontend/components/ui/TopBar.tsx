import React, { useState } from 'react';
import {
  View, StyleSheet, useColorScheme, TouchableOpacity,
  Modal, Text, FlatList, ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
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
    // Contratos por vencer
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

    // Pagos próximos (día de pago en los próximos 5 días)
    if (inq.fecha_pago) {
      const diaHoy = hoy.getDate();
      const diaPago = Number(inq.fecha_pago);
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

    // Depósito diferido — alertar 2 días antes de cada fecha de pago
    if (inq.deposito_tipo && inq.deposito_tipo !== 'ninguno') {
      const fechas: number[] = Array.isArray(inq.deposito_fechas) ? inq.deposito_fechas : [];
      const diaHoy = hoy.getDate();
      for (const dia of fechas) {
        let diff = dia - diaHoy;
        if (diff < 0) {
          const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
          diff = diasMes - diaHoy + dia;
        }
        if (diff >= 0 && diff <= 3) {
          items.push({
            id: `deposito_${inq.id}_${dia}`,
            icon: 'wallet',
            iconColor: diff === 0 ? '#EF4444' : '#3B82F6',
            title: diff === 0 ? 'Pago de depósito hoy' : `Pago de depósito en ${diff} día${diff !== 1 ? 's' : ''}`,
            subtitle: `${inq.nombre_completo} · Depto ${inq.depto_numero} · Día ${dia}`,
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

export function TopBar({ isDark: passedIsDark }: { isDark?: boolean }) {
  const colorScheme = useColorScheme();
  const isDark = passedIsDark !== undefined ? passedIsDark : colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const router = useRouter();

  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const openNotifications = async () => {
    setShowNotif(true);
    setLoadingNotifs(true);
    try {
      const res = await api.getInquilinos({ estado: 'activo' });
      setNotifs(buildNotifications(res.data || [], router));
    } catch {
      setNotifs([]);
    } finally {
      setLoadingNotifs(false);
    }
  };

  const totalUrgentes = notifs.filter(n => n.urgency === 'alta').length;

  return (
    <>
      <View style={[styles.container, { borderBottomColor: theme.border, backgroundColor: theme.glass }]}>
        <BlurView intensity={isDark ? Theme.blur.intensityDark : Theme.blur.intensityHigh} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />

        <View style={styles.content}>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)' }]}
              onPress={openNotifications}
            >
              <Ionicons name="notifications-outline" size={22} color={theme.text} />
              {totalUrgentes > 0 && (
                <View style={[styles.badge, { borderColor: theme.card }]}>
                  {totalUrgentes > 1 && (
                    <Text style={styles.badgeCount}>{totalUrgentes > 9 ? '9+' : totalUrgentes}</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Panel de notificaciones */}
      <Modal
        visible={showNotif}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotif(false)}
      >
        <TouchableOpacity
          style={styles.notifOverlay}
          activeOpacity={1}
          onPress={() => setShowNotif(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View
              style={[
                styles.notifPanel,
                { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 },
              ]}
            >
              <View style={[styles.notifHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.notifTitle, { color: theme.text }]}>Notificaciones</Text>
                <TouchableOpacity onPress={() => setShowNotif(false)}>
                  <Ionicons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {loadingNotifs ? (
                <View style={styles.notifEmpty}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              ) : notifs.length === 0 ? (
                <View style={styles.notifEmpty}>
                  <Ionicons name="checkmark-circle-outline" size={40} color={theme.success} />
                  <Text style={[styles.notifEmptyText, { color: theme.textSecondary }]}>
                    Todo al día, sin alertas pendientes
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={notifs}
                  keyExtractor={i => i.id}
                  style={styles.notifList}
                  scrollEnabled={notifs.length > 5}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.notifItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
                      onPress={() => { setShowNotif(false); item.onPress?.(); }}
                    >
                      <View style={[styles.notifIcon, { backgroundColor: item.iconColor + '20' }]}>
                        <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
                      </View>
                      <View style={styles.notifText}>
                        <Text style={[styles.notifItemTitle, { color: theme.text }]}>{item.title}</Text>
                        <Text style={[styles.notifItemSub, { color: theme.textSecondary }]} numberOfLines={1}>{item.subtitle}</Text>
                      </View>
                      {item.urgency === 'alta' && (
                        <View style={styles.urgentDot} />
                      )}
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
  container: {
    height: Theme.layout.topBarHeight,
    width: '100%',
    borderBottomWidth: 1,
    zIndex: 10,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FB7185',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeCount: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '800',
    lineHeight: 8,
  },
  // Notification panel
  notifOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 10, 15, 0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Theme.layout.topBarHeight + 8,
    paddingRight: 24,
  },
  notifPanel: {
    width: 380,
    maxHeight: 480,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 20,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
  },
  notifTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  notifList: {
    maxHeight: 400,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 18,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notifIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  notifText: { flex: 1 },
  notifItemTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  notifItemSub: { fontSize: 12, opacity: 0.7 },
  urgentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FB7185',
    flexShrink: 0,
  },
  notifEmpty: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  notifEmptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
