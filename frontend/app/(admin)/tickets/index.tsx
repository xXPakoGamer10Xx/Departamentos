import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator, useWindowDimensions,
  Platform, Modal, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSSEEvent } from '../../../hooks/useSSE';
import { showWebNotification } from '../../../services/webNotifications';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../../components/ui/GlassCard';
import api from '../../../services/api';

type Estado = 'abierto' | 'en_revision' | 'resuelto';
type Vista = 'activos' | 'historial';

const ESTADO_CONFIG: Record<Estado, { label: string; color: string; icon: string }> = {
  abierto:     { label: 'Abierto',     color: '#EF4444', icon: 'alert-circle' },
  en_revision: { label: 'En revisión', color: '#F59E0B', icon: 'time' },
  resuelto:    { label: 'Resuelto',    color: '#10B981', icon: 'checkmark-circle' },
};

function getMesActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMesLabel(mes: string): string {
  const [anio, mesNum] = mes.split('-');
  const date = new Date(parseInt(anio), parseInt(mesNum) - 1, 1);
  return date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

function prevMes(mes: string): string {
  const [anio, mesNum] = mes.split('-').map(Number);
  const d = new Date(anio, mesNum - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMes(mes: string): string {
  const [anio, mesNum] = mes.split('-').map(Number);
  const d = new Date(anio, mesNum, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function TicketsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Estado | 'todos'>('todos');
  const [vista, setVista] = useState<Vista>('activos');
  const [mesSel, setMesSel] = useState(getMesActual());
  const [historial, setHistorial] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Detail modal
  const [selected, setSelected] = useState<any>(null);
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getTickets()
      .then(r => setTickets(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  useEffect(() => {
    const interval = setInterval(() => load(), 5000);
    return () => clearInterval(interval);
  }, [load]);

  useSSEEvent('ticket_new', (data) => {
    setTickets(prev => {
      if (prev.find(t => t.id === data.ticket?.id)) return prev;
      return [data.ticket, ...prev];
    });
    showWebNotification('🔔 Nuevo ticket', `${data.ticket?.titulo} — Depto ${data.ticket?.depto_numero}`);
  });

  useSSEEvent('ticket_updated', (data) => {
    setTickets(prev => prev.map(t => t.id === data.ticket?.id ? { ...t, ...data.ticket } : t));
  });

  const loadHistorial = useCallback(async (mes: string) => {
    setLoadingHistorial(true);
    try {
      const r = await api.getTicketsHistorial(mes);
      setHistorial(r.data || []);
    } catch { setHistorial([]); }
    finally { setLoadingHistorial(false); }
  }, []);

  useEffect(() => {
    if (vista === 'historial') loadHistorial(mesSel);
  }, [vista, mesSel, loadHistorial]);

  const deleteTicketHistorial = async (id: string) => {
    setDeletingId(id);
    try {
      await api.deleteTicket(id);
      setHistorial(prev => prev.filter(t => t.id !== id));
      setTickets(prev => prev.filter(t => t.id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  const openTicket = (ticket: any) => {
    setSelected(ticket);
    setNota(ticket.nota_admin || '');
  };

  const saveUpdate = async (nuevoEstado?: Estado) => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.updateTicket(selected.id, {
        estado: nuevoEstado || selected.estado,
        nota_admin: nota,
      });
      setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, ...res.data } : t));
      setSelected((prev: any) => ({ ...prev, ...res.data, nota_admin: nota }));
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const avanzarEstado = () => {
    const siguiente: Record<Estado, Estado> = {
      abierto: 'en_revision',
      en_revision: 'resuelto',
      resuelto: 'resuelto',
    };
    const next = siguiente[selected.estado as Estado];
    saveUpdate(next);
  };

  const filtered = filtro === 'todos' ? tickets : tickets.filter(t => t.estado === filtro);

  const counts = {
    abierto: tickets.filter(t => t.estado === 'abierto').length,
    en_revision: tickets.filter(t => t.estado === 'en_revision').length,
    resuelto: tickets.filter(t => t.estado === 'resuelto').length,
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, isDesktop && styles.headerDesktop, !isDesktop && { paddingTop: insets.top + 20 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Tickets</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {counts.abierto} abierto{counts.abierto !== 1 ? 's' : ''} · {counts.en_revision} en revisión
          </Text>
        </View>
        {/* Vista toggle */}
        <View style={[styles.vistaToggle, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}>
          <TouchableOpacity
            style={[styles.vistaBtn, vista === 'activos' && { backgroundColor: theme.primary }]}
            onPress={() => setVista('activos')}
          >
            <Text style={[styles.vistaBtnText, { color: vista === 'activos' ? '#fff' : theme.textSecondary }]}>Activos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.vistaBtn, vista === 'historial' && { backgroundColor: '#6366F1' }]}
            onPress={() => setVista('historial')}
          >
            <Text style={[styles.vistaBtnText, { color: vista === 'historial' ? '#fff' : theme.textSecondary }]}>Historial</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filtros activos */}
      {vista === 'activos' && (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosScroll} contentContainerStyle={[styles.filtrosContent, isDesktop && styles.filtrosDesktop]}>
        {(['todos', 'abierto', 'en_revision', 'resuelto'] as const).map(f => {
          const isActive = filtro === f;
          const cfg = f !== 'todos' ? ESTADO_CONFIG[f] : null;
          const label = f === 'todos' ? 'Todos' : cfg!.label;
          const count = f === 'todos' ? tickets.length : counts[f];
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFiltro(f)}
              style={[
                styles.filtroChip,
                {
                  backgroundColor: isActive
                    ? (cfg?.color || theme.primary)
                    : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
                  borderColor: isActive ? 'transparent' : theme.border,
                },
              ]}
            >
              {cfg && <Ionicons name={cfg.icon as any} size={13} color={isActive ? '#fff' : cfg.color} />}
              <Text style={[styles.filtroText, { color: isActive ? '#fff' : theme.textSecondary }]}>
                {label} {count > 0 ? `(${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      )}

      {/* Selector de mes — historial */}
      {vista === 'historial' && (
        <View style={[styles.mesSelector, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => setMesSel(prevMes(mesSel))} style={styles.mesNavBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.mesLabel, { color: theme.text }]}>
            {formatMesLabel(mesSel).toUpperCase()}
          </Text>
          <TouchableOpacity
            onPress={() => { if (mesSel < getMesActual()) setMesSel(nextMes(mesSel)); }}
            style={[styles.mesNavBtn, { opacity: mesSel >= getMesActual() ? 0.3 : 1 }]}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>
      )}

      {vista === 'activos' ? (
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop, { paddingBottom: isDesktop ? 32 : insets.bottom + Theme.layout.dockHeight }]}
            showsVerticalScrollIndicator={false}
          >
            {filtered.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="chatbox-ellipses-outline" size={48} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {filtro === 'todos' ? 'Sin tickets registrados' : `Sin tickets ${ESTADO_CONFIG[filtro]?.label.toLowerCase()}`}
                </Text>
              </View>
            ) : (
              filtered.map(ticket => {
                const cfg = ESTADO_CONFIG[ticket.estado as Estado];
                return (
                  <TouchableOpacity
                    key={ticket.id}
                    style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}
                    onPress={() => openTicket(ticket)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.estadoBar, { backgroundColor: cfg.color }]} />
                    <View style={{ flex: 1, paddingLeft: 12, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{ticket.titulo}</Text>
                        <View style={[styles.estadoBadge, { backgroundColor: cfg.color + '20' }]}>
                          <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
                          <Text style={[styles.estadoBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                      </View>
                      <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={1}>
                        {ticket.inquilino_nombre} · Depto {ticket.depto_numero}
                      </Text>
                      <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                        {ticket.descripcion}
                      </Text>
                      <Text style={[styles.cardDate, { color: theme.textMuted }]}>
                        {new Date(ticket.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )
      ) : (
        /* Historial */
        loadingHistorial ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop, { paddingBottom: isDesktop ? 32 : insets.bottom + Theme.layout.dockHeight }]}
            showsVerticalScrollIndicator={false}
          >
            {historial.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="archive-outline" size={48} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  Sin tickets en {formatMesLabel(mesSel)}
                </Text>
              </View>
            ) : (
              historial.map(ticket => {
                const cfg = ESTADO_CONFIG[ticket.estado as Estado];
                const isDeleting = deletingId === ticket.id;
                return (
                  <View
                    key={ticket.id}
                    style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}
                  >
                    <View style={[styles.estadoBar, { backgroundColor: cfg.color }]} />
                    <View style={{ flex: 1, paddingLeft: 12, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{ticket.titulo}</Text>
                        <View style={[styles.estadoBadge, { backgroundColor: cfg.color + '20' }]}>
                          <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
                          <Text style={[styles.estadoBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                      </View>
                      <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={1}>
                        {ticket.inquilino_nombre} · Depto {ticket.depto_numero}
                      </Text>
                      <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                        {ticket.descripcion}
                      </Text>
                      {ticket.nota_admin ? (
                        <Text style={[styles.cardDesc, { color: theme.primary, fontSize: 12 }]} numberOfLines={1}>
                          Nota: {ticket.nota_admin}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.cardDate, { color: theme.textMuted, flex: 1 }]}>
                          {new Date(ticket.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {ticket.estado === 'resuelto' && (
                          <TouchableOpacity
                            onPress={() => deleteTicketHistorial(ticket.id)}
                            disabled={isDeleting}
                            style={[styles.deleteHistBtn, { opacity: isDeleting ? 0.5 : 1 }]}
                          >
                            {isDeleting
                              ? <ActivityIndicator size="small" color="#EF4444" />
                              : <Ionicons name="trash-outline" size={14} color="#EF4444" />
                            }
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )
      )}

      {/* Detail Modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && (() => {
          const cfg = ESTADO_CONFIG[selected.estado as Estado];
          return (
            <View style={styles.modalOverlay}>
              <GlassCard style={styles.modalBox} borderRadius={Theme.borderRadius.xl} padding={0}>
                {/* Header */}
                <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                  <View style={[styles.estadoBadgeLg, { backgroundColor: cfg.color + '20' }]}>
                    <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                    <Text style={[styles.estadoBadgeTextLg, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                    <Ionicons name="close" size={22} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>{selected.titulo}</Text>
                  <View style={[styles.infoRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }]}>
                    <Ionicons name="home-outline" size={14} color={theme.textSecondary} />
                    <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                      {selected.inquilino_nombre} · Depto {selected.depto_numero}
                    </Text>
                    <Text style={[styles.infoDate, { color: theme.textMuted }]}>
                      {new Date(selected.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>

                  <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Descripción</Text>
                  <Text style={[styles.descText, { color: theme.text }]}>{selected.descripcion}</Text>

                  <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Nota del administrador</Text>
                  <TextInput
                    style={[styles.notaInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                    value={nota}
                    onChangeText={setNota}
                    placeholder="Agrega una nota o respuesta al inquilino..."
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={3}
                  />

                  {/* Actions */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.saveNoteBtn, { borderColor: theme.border, opacity: saving ? 0.6 : 1 }]}
                      onPress={() => saveUpdate()}
                      disabled={saving}
                    >
                      {saving ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="save-outline" size={16} color={theme.primary} />}
                      <Text style={[styles.saveNoteBtnText, { color: theme.primary }]}>Guardar nota</Text>
                    </TouchableOpacity>

                    {selected.estado !== 'resuelto' && (
                      <TouchableOpacity
                        style={[styles.avanzarBtn, { backgroundColor: selected.estado === 'abierto' ? '#F59E0B' : '#10B981', opacity: saving ? 0.6 : 1 }]}
                        onPress={avanzarEstado}
                        disabled={saving}
                      >
                        <Ionicons name={selected.estado === 'abierto' ? 'time' : 'checkmark-circle'} size={16} color="#fff" />
                        <Text style={styles.avanzarBtnText}>
                          {selected.estado === 'abierto' ? 'Marcar en revisión' : 'Marcar resuelto'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
              </GlassCard>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 70 : 24, paddingBottom: 12, gap: 12,
  },
  headerDesktop: { paddingTop: 24, paddingHorizontal: 40, maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%' },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 2, opacity: 0.7 },

  filtrosScroll: { flexGrow: 0 },
  filtrosContent: { paddingHorizontal: 20, paddingBottom: 12, gap: 8, flexDirection: 'row' },
  filtrosDesktop: { paddingHorizontal: 40, maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%' },
  filtroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
  },
  filtroText: { fontSize: 13, fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, gap: 10 },
  scrollContentDesktop: { paddingHorizontal: 40, maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16 },

  card: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    paddingRight: 14, paddingVertical: 14,
  },
  estadoBar: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  cardTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  cardSub: { fontSize: 12 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardDate: { fontSize: 11 },
  estadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  estadoBadgeText: { fontSize: 10, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox: { maxHeight: '85%', marginHorizontal: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 18, borderBottomWidth: 1,
  },
  estadoBadgeLg: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  estadoBadgeTextLg: { fontSize: 13, fontWeight: '700' },
  closeBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  modalBody: { padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, lineHeight: 24 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10,
    borderRadius: 10, borderWidth: 1, marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 13 },
  infoDate: { fontSize: 11 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  descText: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
  notaInput: {
    borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14,
    minHeight: 80, textAlignVertical: 'top', marginBottom: 16,
  },
  actionRow: { flexDirection: 'row', gap: 10, paddingBottom: 20 },
  saveNoteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 46, borderRadius: 14, borderWidth: 1,
  },
  saveNoteBtnText: { fontWeight: '700', fontSize: 14 },
  avanzarBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 46, borderRadius: 14,
  },
  avanzarBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  vistaToggle: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 2 },
  vistaBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  vistaBtnText: { fontSize: 13, fontWeight: '700' },

  mesSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, gap: 16,
  },
  mesNavBtn: { padding: 4 },
  mesLabel: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5, flex: 1, textAlign: 'center' },

  deleteHistBtn: {
    width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#EF444415',
  },
});
