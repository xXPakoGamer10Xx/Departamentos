import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator, Platform, Modal, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../../constants/Colors';
import { Theme } from '../../../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../../components/ui/GlassCard';
import api from '../../../services/api';
import { useSSEEvent } from '../../../hooks/useSSE';
import { showWebNotification } from '../../../services/webNotifications';

function useSinceMs(timestamp: string): number {
  const [ms, setMs] = useState(() => Date.now() - new Date(timestamp).getTime());
  useEffect(() => {
    const iv = setInterval(() => setMs(Date.now() - new Date(timestamp).getTime()), 1000);
    return () => clearInterval(iv);
  }, [timestamp]);
  return ms;
}

type Estado = 'abierto' | 'en_revision' | 'resuelto';

const ESTADO_CONFIG: Record<Estado, { label: string; color: string; icon: string }> = {
  abierto:     { label: 'Abierto',     color: '#EF4444', icon: 'alert-circle' },
  en_revision: { label: 'En revisión', color: '#F59E0B', icon: 'time' },
  resuelto:    { label: 'Resuelto',    color: '#10B981', icon: 'checkmark-circle' },
};

const CINCO_MINUTOS = 5 * 60 * 1000;

function TicketCard({ ticket, isDark, theme, onDelete }: { ticket: any; isDark: boolean; theme: any; onDelete: (id: string) => void }) {
  const sinceMs = useSinceMs(ticket.created_at);
  const canDelete = sinceMs < CINCO_MINUTOS;
  const secsLeft = Math.max(0, Math.ceil((CINCO_MINUTOS - sinceMs) / 1000));
  const cfg = ESTADO_CONFIG[ticket.estado as Estado];

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.estadoBar, { backgroundColor: cfg.color }]} />
      <View style={{ flex: 1, paddingLeft: 12, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{ticket.titulo}</Text>
          <View style={[styles.badge, { backgroundColor: cfg.color + '20' }]}>
            <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={2}>{ticket.descripcion}</Text>
        {ticket.nota_admin ? (
          <View style={[styles.notaBox, { backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.07)', borderColor: theme.primary + '30' }]}>
            <Ionicons name="chatbubble-outline" size={12} color={theme.primary} />
            <Text style={[styles.notaText, { color: theme.text }]} numberOfLines={2}>{ticket.nota_admin}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <Text style={[styles.cardDate, { color: theme.textMuted, flex: 1 }]}>
            {new Date(ticket.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
          {canDelete && (
            <TouchableOpacity
              onPress={() => onDelete(ticket.id)}
              style={[styles.deleteBtn, { backgroundColor: '#EF444415', borderColor: '#EF444430' }]}
            >
              <Ionicons name="trash-outline" size={12} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>
                Eliminar ({secsLeft}s)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export default function InquilinoTickets() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New ticket modal
  const [showNew, setShowNew] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadTickets = useCallback(() => {
    api.getTickets()
      .then(r => setTickets(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(loadTickets);

  useEffect(() => {
    const interval = setInterval(() => loadTickets(), 5000);
    return () => clearInterval(interval);
  }, [loadTickets]);

  useSSEEvent('ticket_updated', (data) => {
    if (!data.ticket) return;
    setTickets(prev => prev.map(t => t.id === data.ticket.id ? { ...t, ...data.ticket } : t));
    const label = data.ticket.estado === 'resuelto' ? 'resuelto ✅' : 'en revisión 🔍';
    showWebNotification('📋 Ticket actualizado', `Tu reporte fue marcado como ${label}`);
  });

  const deleteTicket = async (id: string) => {
    Alert.alert(
      'Eliminar reporte',
      '¿Seguro que quieres eliminar este reporte?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteTicket(id);
              setTickets(prev => prev.filter(t => t.id !== id));
            } catch (e: any) {
              Alert.alert('Error', e.message || 'No se pudo eliminar el reporte');
            }
          },
        },
      ]
    );
  };

  const createTicket = async () => {
    if (!titulo.trim()) { setError('El título es requerido'); return; }
    if (!descripcion.trim()) { setError('La descripción es requerida'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await api.createTicket({ titulo: titulo.trim(), descripcion: descripcion.trim() });
      setTickets(prev => [res.data, ...prev]);
      setTitulo(''); setDescripcion('');
      setShowNew(false);
    } catch (e: any) {
      setError(e.message || 'No se pudo crear el reporte');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={isDark ? ['#0D0F18', '#161929'] : ['#F1F5F9', '#E8EDF5']} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Mis reportes</Text>
        </View>
        <TouchableOpacity style={[styles.newBtn, { backgroundColor: theme.primary }]} onPress={() => setShowNew(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newBtnText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {tickets.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="chatbox-ellipses-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin reportes</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                ¿Tienes algún problema con tu departamento? Crea un reporte y el administrador lo atenderá.
              </Text>
              <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: theme.primary }]} onPress={() => setShowNew(true)}>
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={styles.emptyBtnText}>Crear primer reporte</Text>
              </TouchableOpacity>
            </View>
          ) : (
            tickets.map(ticket => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                isDark={isDark}
                theme={theme}
                onDelete={deleteTicket}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* New ticket modal */}
      <Modal visible={showNew} transparent animationType="slide" onRequestClose={() => setShowNew(false)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalBox} borderRadius={Theme.borderRadius.xl} padding={0}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Nuevo reporte</Text>
              <TouchableOpacity onPress={() => setShowNew(false)}>
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Título *</Text>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                value={titulo}
                onChangeText={t => { setTitulo(t); setError(''); }}
                placeholder="Ej: Fuga de agua, Foco fundido..."
                placeholderTextColor={theme.textSecondary}
                maxLength={200}
                autoFocus
              />
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Descripción *</Text>
              <TextInput
                style={[styles.input, styles.textarea, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
                value={descripcion}
                onChangeText={t => { setDescripcion(t); setError(''); }}
                placeholder="Describe el problema con detalle..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              {error ? (
                <View style={[styles.errorBox, { backgroundColor: theme.danger + '15', borderColor: theme.danger + '30' }]}>
                  <Ionicons name="alert-circle-outline" size={14} color={theme.danger} />
                  <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}
                onPress={createTicket}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={16} color="#fff" />}
                <Text style={styles.submitBtnText}>{saving ? 'Enviando…' : 'Enviar reporte'}</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16, gap: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, gap: 10 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', borderRadius: 16, borderWidth: 1, overflow: 'hidden',
    paddingRight: 14, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  estadoBar: { width: 4, alignSelf: 'stretch', borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  cardTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardDate: { fontSize: 11 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  notaBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: 8, borderRadius: 8, borderWidth: 1 },
  notaText: { flex: 1, fontSize: 12, lineHeight: 17 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalBox: { marginHorizontal: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalBody: { padding: 20, gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, marginTop: 8 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
