import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  Platform,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { useSSEEvent } from '../../hooks/useSSE';
import { showWebNotification } from '../../services/webNotifications';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';

export function NotificationBell() {
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cargar notificaciones
  const loadNotificaciones = async () => {
    setLoading(true);
    try {
      const res = await api.getNotificaciones();
      if (res.data) {
        setNotificaciones(res.data);
        setUnreadCount(res.data.filter((n: any) => !n.leido).length);
      }
    } catch (e) {
      console.error('Error al cargar notificaciones:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotificaciones();
  }, []);

  // Escuchar notificaciones en tiempo real por SSE
  useSSEEvent('notification_new', (data) => {
    // data tiene: { title, mensaje, tipo }
    const newNotif = {
      id: Math.random().toString(), // id temporal para renderizar
      titulo: data.title,
      mensaje: data.mensaje,
      tipo: data.tipo,
      leido: false,
      created_at: new Date().toISOString(),
    };

    setNotificaciones((prev) => [newNotif, ...prev]);
    setUnreadCount((c) => c + 1);

    // Mostrar notificación nativa en navegador si estamos en Web
    if (Platform.OS === 'web') {
      showWebNotification(data.title, data.mensaje);
    }
  });

  const handleMarcarLeidas = async () => {
    try {
      await api.marcarNotificacionesLeidas();
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leido: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarcarUnaLeida = async (id: string) => {
    try {
      await api.marcarNotificacionLeida(id);
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leido: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.error(e);
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'renta':
        return { name: 'calendar', color: '#3B82F6' };
      case 'cuota':
        return { name: 'warning', color: '#EF4444' };
      case 'ticket':
        return { name: 'chatbox-ellipses', color: '#F59E0B' };
      case 'pago':
        return { name: 'checkmark-circle', color: '#10B981' };
      default:
        return { name: 'notifications', color: theme.textSecondary };
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const icon = getTipoIcon(item.tipo);
    const dateStr = new Date(item.created_at).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <TouchableOpacity
        style={[
          styles.item,
          { borderBottomColor: theme.border },
          !item.leido && { backgroundColor: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)' },
        ]}
        onPress={() => !item.leido && handleMarcarUnaLeida(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: icon.color + '15' }]}>
          <Ionicons name={icon.name as any} size={18} color={icon.color} />
        </View>
        <View style={styles.itemBody}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemTitle, { color: theme.text }, !item.leido && styles.boldText]}>
              {item.titulo}
            </Text>
            {!item.leido && <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />}
          </View>
          <Text style={[styles.itemMsg, { color: theme.textSecondary }]}>
            {item.mensaje}
          </Text>
          <Text style={[styles.itemDate, { color: theme.textMuted }]}>
            {dateStr}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.bellBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
        onPress={() => {
          setShowDropdown(true);
          loadNotificaciones();
        }}
      >
        <Ionicons name="notifications-outline" size={20} color={theme.text} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={showDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDropdown(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={[styles.dropdownCard, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
              <View style={[styles.cardHeader, { borderBottomColor: theme.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="notifications" size={18} color={theme.text} />
                  <Text style={[styles.cardTitle, { color: theme.text }]}>Notificaciones</Text>
                </View>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={handleMarcarLeidas}>
                    <Text style={[styles.markReadBtn, { color: '#3B82F6' }]}>Marcar todo leído</Text>
                  </TouchableOpacity>
                )}
              </View>

              {loading && notificaciones.length === 0 ? (
                <View style={styles.centerBlock}>
                  <ActivityIndicator size="small" color="#3B82F6" />
                </View>
              ) : notificaciones.length === 0 ? (
                <View style={styles.centerBlock}>
                  <Ionicons name="notifications-off-outline" size={32} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Sin notificaciones nuevas</Text>
                </View>
              ) : (
                <FlatList
                  data={notificaciones}
                  renderItem={renderItem}
                  keyExtractor={(item) => item.id}
                  style={styles.list}
                  contentContainerStyle={{ paddingBottom: 16 }}
                />
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: Platform.OS === 'web' ? 'flex-start' : 'center',
    alignItems: Platform.OS === 'web' ? 'flex-end' : 'center',
    paddingTop: Platform.OS === 'web' ? 70 : 0,
    paddingRight: Platform.OS === 'web' ? 40 : 0,
  },
  modalContent: {
    width: '90%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  dropdownCard: {
    maxHeight: 480,
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  markReadBtn: {
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    flexGrow: 0,
  },
  item: {
    flexDirection: 'row',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
  itemMsg: {
    fontSize: 12,
    lineHeight: 16,
  },
  itemDate: {
    fontSize: 10,
    marginTop: 4,
  },
  boldText: {
    fontWeight: '800',
  },
  centerBlock: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
