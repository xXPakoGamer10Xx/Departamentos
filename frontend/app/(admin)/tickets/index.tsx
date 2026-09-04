import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator, useWindowDimensions,
  Platform, Modal, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSSEEvent } from '../../../hooks/useSSE';
import { showWebNotification } from '../../../services/webNotifications';
import { LinearGradient } from 'expo-linear-gradient';
import { SurfaceCard } from '../../../components/ui/SurfaceCard';
import { Badge } from '../../../components/ui/Badge';
import api from '../../../services/api';

type Estado = 'abierto' | 'en_revision' | 'resuelto';
type Vista = 'activos' | 'historial';

const ESTADO_CONFIG: Record<Estado, { label: string; color: string; icon: string; variant: 'danger' | 'warning' | 'success' }> = {
  abierto: { label: 'Abierto', color: '#EF4444', icon: 'alert-circle', variant: 'danger' },
  en_revision: { label: 'En revisión', color: '#F59E0B', icon: 'time', variant: 'warning' },
  resuelto: { label: 'Resuelto', color: '#10B981', icon: 'checkmark-circle', variant: 'success' },
};

const getMesActual = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
};
const formatMesLabel = (mes: string) => {
  const [a, m] = mes.split('-');
  return new Date(+a, +m - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
};
const prevMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const nextMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function TicketsScreen() {
  const isDark = useColorScheme() === 'dark';
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    setTickets(prev => (prev.find(t => t.id === data.ticket?.id) ? prev : [data.ticket, ...prev]));
    showWebNotification('🔔 Nuevo ticket', `${data.ticket?.titulo} — Depto ${data.ticket?.depto_numero}`);
  });
  useSSEEvent('ticket_updated', (data) => {
    setTickets(prev => prev.map(t => (t.id === data.ticket?.id ? { ...t, ...data.ticket } : t)));
  });

  const loadHistorial = useCallback(async (mes: string) => {
    setLoadingHistorial(true);
    try { setHistorial((await api.getTicketsHistorial(mes)).data || []); }
    catch { setHistorial([]); }
    finally { setLoadingHistorial(false); }
  }, []);

  useEffect(() => { if (vista === 'historial') loadHistorial(mesSel); }, [vista, mesSel, loadHistorial]);

  const counts = useMemo(() => ({
    abierto: tickets.filter(t => t.estado === 'abierto').length,
    en_revision: tickets.filter(t => t.estado === 'en_revision').length,
    resuelto: tickets.filter(t => t.estado === 'resuelto').length,
  }), [tickets]);

  const filtered = filtro === 'todos' ? tickets : tickets.filter(t => t.estado === filtro);

  const selected = useMemo(() => tickets.find(t => t.id === selectedId) || null, [tickets, selectedId]);

  // Auto-seleccionar el primero en desktop
  useEffect(() => {
    if (isDesktop && !selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
  }, [isDesktop, filtered, selectedId]);

  useEffect(() => { setNota(selected?.nota_admin || ''); }, [selectedId]); // eslint-disable-line

  const openTicket = (t: any) => {
    setSelectedId(t.id);
    setNota(t.nota_admin || '');
  };

  const saveUpdate = async (nuevoEstado?: Estado) => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.updateTicket(selected.id, { estado: nuevoEstado || selected.estado, nota_admin: nota });
      setTickets(prev => prev.map(t => (t.id === selected.id ? { ...t, ...res.data, nota_admin: nota } : t)));
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const avanzar = () => {
    const next: Record<Estado, Estado> = { abierto: 'en_revision', en_revision: 'resuelto', resuelto: 'resuelto' };
    saveUpdate(next[selected!.estado as Estado]);
  };

  const deleteHist = async (id: string) => {
    setDeletingId(id);
    try {
      await api.deleteTicket(id);
      setHistorial(prev => prev.filter(t => t.id !== id));
      setTickets(prev => prev.filter(t => t.id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  const fmtFecha = (s: string, full = false) =>
    new Date(s).toLocaleDateString('es-MX', full
      ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const paddingBottom = isDesktop ? 32 : insets.bottom + Theme.layout.dockHeight;

  /* ---------------- KPI ---------------- */
  const kpiRow = (
    <View style={[styles.kpiRow, isDesktop && styles.kpiRowDesktop]}>
      {(['abierto', 'en_revision', 'resuelto'] as Estado[]).map(e => {
        const cfg = ESTADO_CONFIG[e];
        return (
          <SurfaceCard key={e} style={styles.kpi} padding={Theme.spacing.md}>
            <View style={styles.kpiHead}>
              <Text style={[styles.kpiLabel, { color: theme.textMuted }]}>{cfg.label.toUpperCase()}</Text>
              <View style={[styles.kpiIcon, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '30' }]}>
                <Ionicons name={cfg.icon as any} size={15} color={cfg.color} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{counts[e]}</Text>
          </SurfaceCard>
        );
      })}
    </View>
  );

  /* ---------------- Ticket list item ---------------- */
  const ticketItem = (t: any, opts: { selectable?: boolean } = {}) => {
    const cfg = ESTADO_CONFIG[t.estado as Estado];
    const isSel = opts.selectable && selectedId === t.id;
    return (
      <TouchableOpacity
        key={t.id}
        activeOpacity={0.8}
        onPress={() => openTicket(t)}
        style={[
          styles.listItem,
          { backgroundColor: theme.card, borderColor: isSel ? theme.primary : theme.border },
          isSel && styles.listItemSel,
        ]}
      >
        <View style={[styles.stripe, { backgroundColor: cfg.color }]} />
        <View style={{ flex: 1, minWidth: 0, gap: 5, padding: 14, paddingLeft: 16 }}>
          <View style={styles.itemTop}>
            <Badge label={cfg.label} variant={cfg.variant} size="sm" />
            <Text style={[styles.itemDate, { color: theme.textMuted }]}>{fmtFecha(t.created_at)}</Text>
          </View>
          <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>{t.titulo}</Text>
          <Text style={[styles.itemDesc, { color: theme.textSecondary }]} numberOfLines={2}>{t.descripcion}</Text>
          <View style={styles.itemFoot}>
            <Text style={[styles.itemMeta, { color: theme.textSecondary }]} numberOfLines={1}>{t.inquilino_nombre}</Text>
            <View style={[styles.deptoTag, { borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)' }]}>
              <Text style={[styles.deptoTagText, { color: theme.textSecondary }]}>Depto {t.depto_numero}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  /* ---------------- Detail panel (desktop) ---------------- */
  const detailPanel = () => {
    if (!selected) {
      return (
        <SurfaceCard style={[styles.detail, styles.detailEmpty]}>
          <Ionicons name="chatbox-ellipses-outline" size={40} color={theme.textMuted} />
          <Text style={[styles.detailEmptyText, { color: theme.textSecondary }]}>Selecciona un ticket para ver el detalle</Text>
        </SurfaceCard>
      );
    }
    const cfg = ESTADO_CONFIG[selected.estado as Estado];
    return (
      <SurfaceCard style={styles.detail} padding={0}>
        <View style={[styles.detailHead, { borderBottomColor: theme.border }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Text style={[styles.ticketId, { color: theme.textMuted }]}>#{String(selected.id).slice(0, 6).toUpperCase()}</Text>
              <Badge label={cfg.label} variant={cfg.variant} size="sm" />
            </View>
            <Text style={[styles.detailTitle, { color: theme.text }]}>{selected.titulo}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.infoRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)', borderColor: theme.border }]}>
            <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]} numberOfLines={1}>
              {selected.inquilino_nombre} · Depto {selected.depto_numero}
            </Text>
            <Text style={[styles.infoDate, { color: theme.textMuted }]}>{fmtFecha(selected.created_at, true)}</Text>
          </View>

          <View>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>DESCRIPCIÓN DEL INQUILINO</Text>
            <View style={[styles.descBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)', borderColor: theme.border }]}>
              <Text style={[styles.descText, { color: theme.text }]}>{selected.descripcion}</Text>
            </View>
          </View>

          <View>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>NOTA DEL ADMINISTRADOR</Text>
            <TextInput
              style={[styles.notaInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}
              value={nota}
              onChangeText={setNota}
              placeholder="Agrega una nota o respuesta al inquilino..."
              placeholderTextColor={theme.textMuted}
              multiline
            />
          </View>
        </ScrollView>

        <View style={[styles.detailFoot, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.footBtn, { borderColor: theme.border, opacity: saving ? 0.6 : 1 }]}
            onPress={() => saveUpdate()}
            disabled={saving}
          >
            {saving ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="save-outline" size={15} color={theme.primary} />}
            <Text style={[styles.footBtnText, { color: theme.primary }]}>Guardar nota</Text>
          </TouchableOpacity>
          {selected.estado !== 'resuelto' && (
            <TouchableOpacity
              style={[styles.footBtn, styles.footBtnPrimary, { backgroundColor: selected.estado === 'abierto' ? theme.warning : theme.success, opacity: saving ? 0.6 : 1 }]}
              onPress={avanzar}
              disabled={saving}
            >
              <Ionicons name={selected.estado === 'abierto' ? 'time' : 'checkmark-circle'} size={15} color="#fff" />
              <Text style={[styles.footBtnText, { color: '#fff' }]}>
                {selected.estado === 'abierto' ? 'Marcar en revisión' : 'Marcar resuelto'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SurfaceCard>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={isDark ? ['#0E1321', '#1A1F2E'] : ['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFill} />

      <View style={[styles.content, isDesktop && styles.contentDesktop, { flex: 1 }]}>
        {/* Header */}
        <View style={[styles.header, !isDesktop && { paddingTop: insets.top + 20 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Tickets de Mantenimiento</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {counts.abierto + counts.en_revision} activo{counts.abierto + counts.en_revision !== 1 ? 's' : ''}
              {counts.abierto > 0 ? ` · ${counts.abierto} abierto${counts.abierto !== 1 ? 's' : ''}` : ''}
            </Text>
          </View>
          <View style={[styles.vistaToggle, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)' }]}>
            {(['activos', 'historial'] as Vista[]).map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.vistaBtn, vista === v && { backgroundColor: theme.primary }]}
                onPress={() => setVista(v)}
              >
                <Text style={[styles.vistaBtnText, { color: vista === v ? '#fff' : theme.textSecondary }]}>
                  {v === 'activos' ? 'Activos' : 'Historial'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {vista === 'activos' ? (
          <>
            {kpiRow}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.filtros}>
              {(['todos', 'abierto', 'en_revision', 'resuelto'] as const).map(f => {
                const active = filtro === f;
                const cfg = f !== 'todos' ? ESTADO_CONFIG[f] : null;
                const count = f === 'todos' ? tickets.length : counts[f];
                return (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setFiltro(f)}
                    style={[
                      styles.chip,
                      { borderColor: active ? (cfg ? cfg.color + '50' : theme.borderStrong) : theme.border },
                      active && { backgroundColor: cfg ? cfg.color + '18' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)') },
                    ]}
                  >
                    {cfg && <View style={[styles.dot, { backgroundColor: cfg.color }]} />}
                    <Text style={[styles.chipText, { color: active ? (cfg?.color || theme.text) : theme.textSecondary }]}>
                      {f === 'todos' ? 'Todos' : cfg!.label} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {loading && tickets.length === 0 ? (
              <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : isDesktop ? (
              <View style={styles.split}>
                <ScrollView style={styles.splitList} contentContainerStyle={{ gap: 10, paddingBottom }} showsVerticalScrollIndicator={false}>
                  {filtered.length === 0
                    ? <SurfaceCard style={{ alignItems: 'center', paddingVertical: 40 }}><Text style={{ color: theme.textSecondary, fontSize: 13 }}>Sin tickets</Text></SurfaceCard>
                    : filtered.map(t => ticketItem(t, { selectable: true }))}
                </ScrollView>
                <View style={styles.splitDetail}>{detailPanel()}</View>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 20, paddingBottom }} showsVerticalScrollIndicator={false}>
                {filtered.length === 0 ? (
                  <View style={styles.empty}>
                    <Ionicons name="chatbox-ellipses-outline" size={44} color={theme.textMuted} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Sin tickets</Text>
                  </View>
                ) : filtered.map(t => ticketItem(t))}
              </ScrollView>
            )}
          </>
        ) : (
          /* Historial */
          <>
            <View style={[styles.mesSelector, { borderBottomColor: theme.border }]}>
              <TouchableOpacity onPress={() => setMesSel(prevMes(mesSel))} style={{ padding: 4 }}>
                <Ionicons name="chevron-back" size={20} color={theme.primary} />
              </TouchableOpacity>
              <Text style={[styles.mesLabel, { color: theme.text }]}>{formatMesLabel(mesSel).toUpperCase()}</Text>
              <TouchableOpacity
                onPress={() => { if (mesSel < getMesActual()) setMesSel(nextMes(mesSel)); }}
                style={{ padding: 4, opacity: mesSel >= getMesActual() ? 0.3 : 1 }}
              >
                <Ionicons name="chevron-forward" size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
            {loadingHistorial ? (
              <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingHorizontal: isDesktop ? 0 : 20, paddingBottom }} showsVerticalScrollIndicator={false}>
                {historial.length === 0 ? (
                  <View style={styles.empty}>
                    <Ionicons name="archive-outline" size={44} color={theme.textMuted} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Sin tickets en {formatMesLabel(mesSel)}</Text>
                  </View>
                ) : historial.map(t => {
                  const cfg = ESTADO_CONFIG[t.estado as Estado];
                  const del = deletingId === t.id;
                  return (
                    <SurfaceCard key={t.id} style={styles.listItem} padding={0}>
                      <View style={[styles.stripe, { backgroundColor: cfg.color }]} />
                      <View style={{ flex: 1, minWidth: 0, gap: 5, padding: 14, paddingLeft: 16 }}>
                        <View style={styles.itemTop}>
                          <Badge label={cfg.label} variant={cfg.variant} size="sm" />
                          <Text style={[styles.itemDate, { color: theme.textMuted }]}>{fmtFecha(t.created_at, true)}</Text>
                        </View>
                        <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>{t.titulo}</Text>
                        <Text style={[styles.itemDesc, { color: theme.textSecondary }]} numberOfLines={2}>{t.descripcion}</Text>
                        {t.nota_admin ? <Text style={[styles.itemDesc, { color: theme.primary, fontSize: 12 }]} numberOfLines={1}>Nota: {t.nota_admin}</Text> : null}
                        <View style={styles.itemFoot}>
                          <Text style={[styles.itemMeta, { color: theme.textSecondary }]} numberOfLines={1}>{t.inquilino_nombre} · Depto {t.depto_numero}</Text>
                          {t.estado === 'resuelto' && (
                            <TouchableOpacity onPress={() => deleteHist(t.id)} disabled={del} style={[styles.delBtn, { backgroundColor: theme.danger + '15' }]}>
                              {del ? <ActivityIndicator size="small" color={theme.danger} /> : <Ionicons name="trash-outline" size={13} color={theme.danger} />}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </SurfaceCard>
                  );
                })}
              </ScrollView>
            )}
          </>
        )}
      </View>

      {/* Modal detalle — solo móvil */}
      {!isDesktop && (
        <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelectedId(null)}>
          {selected && (() => {
            const cfg = ESTADO_CONFIG[selected.estado as Estado];
            return (
              <View style={styles.modalOverlay}>
                <SurfaceCard style={styles.modalBox} borderRadius={Theme.borderRadius.xl} padding={0}>
                  <View style={[styles.detailHead, { borderBottomColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Text style={[styles.ticketId, { color: theme.textMuted }]}>#{String(selected.id).slice(0, 6).toUpperCase()}</Text>
                        <Badge label={cfg.label} variant={cfg.variant} size="sm" />
                      </View>
                      <Text style={[styles.detailTitle, { color: theme.text }]}>{selected.titulo}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedId(null)} style={styles.closeBtn}>
                      <Ionicons name="close" size={22} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
                    <View style={[styles.infoRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)', borderColor: theme.border }]}>
                      <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
                      <Text style={[styles.infoText, { color: theme.textSecondary }]}>{selected.inquilino_nombre} · Depto {selected.depto_numero}</Text>
                    </View>
                    <View>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>DESCRIPCIÓN DEL INQUILINO</Text>
                      <View style={[styles.descBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)', borderColor: theme.border }]}>
                        <Text style={[styles.descText, { color: theme.text }]}>{selected.descripcion}</Text>
                      </View>
                    </View>
                    <View>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>NOTA DEL ADMINISTRADOR</Text>
                      <TextInput
                        style={[styles.notaInput, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' }]}
                        value={nota} onChangeText={setNota} multiline
                        placeholder="Agrega una nota..." placeholderTextColor={theme.textMuted}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, paddingBottom: insets.bottom + 8 }}>
                      <TouchableOpacity style={[styles.footBtn, { flex: 1, borderColor: theme.border, opacity: saving ? 0.6 : 1 }]} onPress={() => saveUpdate()} disabled={saving}>
                        {saving ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="save-outline" size={15} color={theme.primary} />}
                        <Text style={[styles.footBtnText, { color: theme.primary }]}>Guardar</Text>
                      </TouchableOpacity>
                      {selected.estado !== 'resuelto' && (
                        <TouchableOpacity
                          style={[styles.footBtn, styles.footBtnPrimary, { flex: 1, backgroundColor: selected.estado === 'abierto' ? theme.warning : theme.success, opacity: saving ? 0.6 : 1 }]}
                          onPress={avanzar} disabled={saving}
                        >
                          <Ionicons name={selected.estado === 'abierto' ? 'time' : 'checkmark-circle'} size={15} color="#fff" />
                          <Text style={[styles.footBtnText, { color: '#fff' }]}>{selected.estado === 'abierto' ? 'En revisión' : 'Resuelto'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </ScrollView>
                </SurfaceCard>
              </View>
            );
          })()}
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingTop: Theme.spacing.md, gap: Theme.spacing.md },
  contentDesktop: { maxWidth: Theme.layout.maxWidth, alignSelf: 'center', width: '100%', paddingHorizontal: 40, paddingTop: 28 },

  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 20 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, marginTop: 2 },
  vistaToggle: { flexDirection: 'row', borderRadius: Theme.borderRadius.sm, padding: 3, gap: 2 },
  vistaBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Theme.borderRadius.sm - 2 },
  vistaBtnText: { fontSize: 12.5, fontWeight: '700' },

  kpiRow: { gap: 12, flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20 },
  kpiRowDesktop: { flexWrap: 'nowrap', paddingHorizontal: 0 },
  kpi: { flex: 1, minWidth: 110, justifyContent: 'space-between', minHeight: 96 },
  kpiHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  kpiLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, flex: 1 },
  kpiIcon: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 26, fontWeight: '800', letterSpacing: -1 },

  filtros: { gap: 8, paddingHorizontal: 20, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '600' },
  dot: { width: 7, height: 7, borderRadius: 4 },

  split: { flex: 1, flexDirection: 'row', gap: 12 },
  splitList: { width: '42%', flexGrow: 0 },
  splitDetail: { flex: 1 },

  listItem: { flexDirection: 'row', alignItems: 'stretch', borderRadius: Theme.borderRadius.lg, borderWidth: 1, overflow: 'hidden' },
  listItemSel: { shadowColor: '#3B82F6', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  stripe: { width: 3 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemDate: { fontSize: 11, fontWeight: '500' },
  itemTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  itemDesc: { fontSize: 12.5, lineHeight: 17 },
  itemFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  itemMeta: { fontSize: 11.5, flex: 1 },
  deptoTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  deptoTagText: { fontSize: 10.5, fontWeight: '700' },
  delBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // listItem needs inner padding when used directly (desktop selectable)
  detail: { flex: 1, overflow: 'hidden' },
  detailEmpty: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  detailEmptyText: { fontSize: 13, textAlign: 'center', maxWidth: 220 },
  detailHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 18, borderBottomWidth: 1 },
  ticketId: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  detailTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, lineHeight: 24 },
  closeBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 12.5 },
  infoDate: { fontSize: 10.5 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  descBox: { padding: 14, borderRadius: 10, borderWidth: 1 },
  descText: { fontSize: 13.5, lineHeight: 21 },
  notaInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 13.5, minHeight: 90, textAlignVertical: 'top' },

  detailFoot: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1 },
  footBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 42, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14 },
  footBtnPrimary: { borderWidth: 0, flex: 1 },
  footBtnText: { fontWeight: '700', fontSize: 13 },

  empty: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyText: { fontSize: 14 },

  mesSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, gap: 16 },
  mesLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, flex: 1, textAlign: 'center' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  modalBox: { maxHeight: '88%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
});
