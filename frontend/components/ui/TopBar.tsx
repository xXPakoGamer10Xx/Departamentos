import React, { useState, useRef, useEffect } from 'react';
import {
  View, TextInput, StyleSheet, useColorScheme, TouchableOpacity,
  Platform, Modal, Text, FlatList, ActivityIndicator,
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

  // Global search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ type: 'inquilino' | 'departamento'; id: string; title: string; subtitle: string }[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setLoadingSearch(true);
      setShowResults(true);
      try {
        const [inqRes, deptRes] = await Promise.all([
          api.getInquilinos({ search: searchQuery }),
          api.getDepartamentos(),
        ]);
        const q = searchQuery.toLowerCase();
        const inqs = (inqRes.data || [])
          .filter((i: any) => i.nombre_completo?.toLowerCase().includes(q) || String(i.depto_numero).includes(q))
          .slice(0, 5)
          .map((i: any) => ({
            type: 'inquilino' as const,
            id: String(i.id),
            title: i.nombre_completo,
            subtitle: `Depto ${i.depto_numero} · $${Number(i.renta).toLocaleString()}`,
          }));
        const deptos = (deptRes.data || [])
          .filter((d: any) => String(d.numero).includes(q) || d.descripcion?.toLowerCase().includes(q))
          .slice(0, 4)
          .map((d: any) => ({
            type: 'departamento' as const,
            id: String(d.numero),
            title: `Departamento ${d.numero}`,
            subtitle: `${d.estado?.toUpperCase()} · ${d.descripcion || 'Sin descripción'}`,
          }));
        setSearchResults([...inqs, ...deptos]);
      } catch {
        setSearchResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);
  }, [searchQuery]);

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
          <View style={styles.searchWrapper}>
            <View style={[
              styles.searchBox,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.surface,
                borderColor: showResults ? theme.primary : theme.border,
                borderWidth: 1,
                shadowColor: showResults ? theme.primary : 'transparent',
                shadowOpacity: showResults ? 0.15 : 0,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: showResults ? 2 : 0,
              }
            ]}>
              {loadingSearch
                ? <ActivityIndicator size="small" color={theme.textSecondary} style={{ width: 18 }} />
                : <Ionicons name="search" size={18} color={theme.textSecondary} />
              }
              <TextInput
                placeholder="Buscar inquilinos, departamentos..."
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => searchQuery.trim() && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setShowResults(false); }}>
                  <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Resultados dropdown */}
            {showResults && (
              <View style={[
                styles.searchDropdown,
                { backgroundColor: theme.card, borderColor: theme.border }
              ]}>
                {searchResults.length === 0 && !loadingSearch ? (
                  <View style={styles.searchEmptyRow}>
                    <Text style={[styles.searchEmptyText, { color: theme.textSecondary }]}>Sin resultados para "{searchQuery}"</Text>
                  </View>
                ) : (
                  searchResults.map(item => (
                    <TouchableOpacity
                      key={`${item.type}_${item.id}`}
                      style={[styles.searchResultRow, { borderBottomColor: theme.border }]}
                      onPress={() => {
                        setSearchQuery('');
                        setShowResults(false);
                        if (item.type === 'inquilino') {
                          router.push(`/(admin)/inquilinos/${item.id}` as any);
                        } else {
                          router.push(`/(admin)/departamentos/${item.id}` as any);
                        }
                      }}
                    >
                      <View style={[
                        styles.searchResultIcon,
                        { backgroundColor: item.type === 'inquilino' ? theme.warningLight : theme.successLight }
                      ]}>
                        <Ionicons
                          name={item.type === 'inquilino' ? 'person' : 'business'}
                          size={15}
                          color={item.type === 'inquilino' ? theme.warning : theme.success}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.searchResultTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
                        <Text style={[styles.searchResultSub, { color: theme.textSecondary }]} numberOfLines={1}>{item.subtitle}</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={14} color={theme.textSecondary} />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>

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
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  searchWrapper: {
    position: 'relative',
    zIndex: 100,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 400,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any
    })
  },
  searchDropdown: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 200,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchResultIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  searchResultTitle: { fontSize: 14, fontWeight: '600' },
  searchResultSub: { fontSize: 12, opacity: 0.7, marginTop: 1 },
  searchEmptyRow: { padding: 16, alignItems: 'center' },
  searchEmptyText: { fontSize: 13 },
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
