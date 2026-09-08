import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput,
  useColorScheme, ActivityIndicator, useWindowDimensions, Platform, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { Theme } from '../../constants/Theme';
import { GlassCard } from '../../components/ui/GlassCard';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { confirmar } from '../../utils/confirm';
import api from '../../services/api';
import { usePermisoGuard } from '../../hooks/usePermisoGuard';

type CuentaForm = { id?: string; alias: string; banco_nombre: string; banco_clabe: string; banco_titular: string };

const money = (n: number) =>
  Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

export default function CuentasScreen() {
  usePermisoGuard('cuentas');
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const isDesktop = width >= Theme.breakpoints.tablet;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [cuentas, setCuentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CuentaForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const cargar = useCallback(() => {
    api.getCuentasBancarias()
      .then(r => setCuentas(r.data || []))
      .catch(() => setCuentas([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const nueva = () => { setFormError(''); setForm({ alias: '', banco_nombre: '', banco_clabe: '', banco_titular: '' }); };
  const editar = (c: any) => {
    setFormError('');
    setForm({ id: c.id, alias: c.alias || '', banco_nombre: c.banco_nombre || '', banco_clabe: c.banco_clabe || '', banco_titular: c.banco_titular || '' });
  };

  const guardar = async () => {
    if (!form) return;
    if (form.banco_clabe.length !== 18) { setFormError('La CLABE debe tener 18 dígitos'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        alias: form.alias, banco_nombre: form.banco_nombre,
        banco_clabe: form.banco_clabe, banco_titular: form.banco_titular,
      };
      if (form.id) await api.updateCuentaBancaria(form.id, payload);
      else await api.createCuentaBancaria(payload);
      setForm(null);
      cargar();
    } catch (e: any) {
      setFormError(e?.message || 'No se pudo guardar la cuenta');
    } finally {
      setSaving(false);
    }
  };

  const marcarDefault = async (id: string) => {
    try { await api.setCuentaDefault(id); cargar(); } catch { /* ignore */ }
  };

  const eliminar = async (id: string) => {
    const ok = await confirmar(
      'Eliminar cuenta',
      'Los departamentos que la usaban quedarán sin cuenta asignada (usarán la predeterminada).',
      { confirmLabel: 'Eliminar', destructive: true },
    );
    if (!ok) return;
    try {
      await api.deleteCuentaBancaria(id);
      cargar();
    } catch (e: any) {
      const msg = e?.message || 'No se pudo eliminar la cuenta';
      if (Platform.OS === 'web') window.alert(msg);
      else { const { Alert } = await import('react-native'); Alert.alert('Error', msg); }
    }
  };

  const totalMes = cuentas.reduce((s, c) => s + Number(c.renta_mensual || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={isDark ? ['#0E1321', '#1A1F2E'] : ['#F8FAFC', '#F1F5F9']} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          isDesktop && styles.contentDesktop,
          { paddingBottom: isDesktop ? 40 : insets.bottom + Theme.layout.dockHeight },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, !isDesktop && { paddingTop: insets.top + 20 }]}>
          {!isDesktop && (
            <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Cuentas Bancarias</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Para transferencias SPEI · {cuentas.length} cuenta{cuentas.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity style={[styles.newBtn, { backgroundColor: '#10B981' }]} onPress={nueva}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.newBtnText}>Nueva</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#10B981" /></View>
        ) : cuentas.length === 0 ? (
          <SurfaceCard style={{ alignItems: 'center', gap: 8, paddingVertical: 36 }}>
            <Ionicons name="card-outline" size={40} color={theme.textMuted} />
            <Text style={[styles.subtitle, { color: theme.textSecondary, textAlign: 'center' }]}>
              Aún no tienes cuentas. Toca “Nueva” para agregar la primera.
            </Text>
          </SurfaceCard>
        ) : (
          <>
            {cuentas.map(c => {
              const asignados: number[] = Array.isArray(c.departamentos) ? c.departamentos : [];
              const monto = Number(c.renta_mensual || 0);
              return (
                <SurfaceCard key={c.id} style={styles.card}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <View style={styles.cardIcon}>
                      <Ionicons name="card" size={19} color="#10B981" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={[styles.cardName, { color: theme.text }]}>{c.alias || c.banco_nombre || 'Cuenta'}</Text>
                        {c.es_predeterminada && (
                          <View style={styles.badge}><Text style={styles.badgeText}>PREDET.</Text></View>
                        )}
                      </View>
                      <Text style={[styles.cardMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                        {c.banco_nombre ? `${c.banco_nombre} · ` : ''}{c.banco_clabe}
                      </Text>
                      {c.banco_titular ? (
                        <Text style={[styles.cardMeta, { color: theme.textSecondary }]} numberOfLines={1}>{c.banco_titular}</Text>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {!c.es_predeterminada && (
                        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#10B98120' }]} onPress={() => marcarDefault(c.id)}>
                          <Ionicons name="star-outline" size={16} color="#10B981" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.primary + '20' }]} onPress={() => editar(c)}>
                        <Ionicons name="create-outline" size={16} color={theme.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.danger + '20' }]} onPress={() => eliminar(c.id)}>
                        <Ionicons name="trash-outline" size={16} color={theme.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.cardFoot, { borderTopColor: theme.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.footLabel, { color: theme.textSecondary }]}>
                        {asignados.length === 0 ? 'DEPARTAMENTOS' : asignados.length === 1 ? '1 DEPARTAMENTO' : `${asignados.length} DEPARTAMENTOS`}
                      </Text>
                      <Text style={[styles.footValue, { color: theme.text }]} numberOfLines={1}>
                        {asignados.length === 0 ? 'Ninguno asignado' : asignados.map(n => `#${n}`).join('  ')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.footLabel, { color: theme.textSecondary }]}>ENTRA AL MES</Text>
                      <Text style={[styles.footMoney, { color: monto > 0 ? '#10B981' : theme.textSecondary }]}>{money(monto)}</Text>
                    </View>
                  </View>
                </SurfaceCard>
              );
            })}

            <SurfaceCard style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.footValue, { color: theme.text, flex: 1 }]}>Total asignado</Text>
              <Text style={[styles.footMoney, { color: '#10B981' }]}>{money(totalMes)} <Text style={{ fontSize: 12, fontWeight: '600' }}>/mes</Text></Text>
            </SurfaceCard>
          </>
        )}

        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Asigna qué cuenta usa cada departamento desde la pantalla del departamento. El inquilino verá automáticamente la cuenta de su depto (o la predeterminada).
        </Text>
      </ScrollView>

      {/* Modal alta / edición */}
      <Modal visible={!!form} transparent animationType="fade" onRequestClose={() => setForm(null)}>
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalBox} borderRadius={Theme.borderRadius.xl} padding={28}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{form?.id ? 'Editar cuenta' : 'Nueva cuenta'}</Text>

            {([
              { key: 'alias', label: 'Alias (opcional)', placeholder: 'Ej. Cuenta BBVA Francisco', max: 60, numeric: false },
              { key: 'banco_nombre', label: 'Banco', placeholder: 'Ej. BBVA', max: 60, numeric: false },
              { key: 'banco_clabe', label: 'CLABE (18 dígitos)', placeholder: '18 dígitos', max: 18, numeric: true },
              { key: 'banco_titular', label: 'Titular', placeholder: 'Nombre de quien recibe', max: 120, numeric: false },
            ] as const).map(f => (
              <View key={f.key}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{f.label}</Text>
                <TextInput
                  style={[styles.input, {
                    color: theme.text,
                    borderColor: f.key === 'banco_clabe' && formError ? theme.danger : theme.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  }]}
                  value={(form as any)?.[f.key] ?? ''}
                  onChangeText={t => {
                    const v = f.numeric ? t.replace(/\D/g, '').slice(0, f.max) : t.slice(0, f.max);
                    setForm(prev => prev ? { ...prev, [f.key]: v } : prev);
                    setFormError('');
                  }}
                  placeholder={f.placeholder}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType={f.numeric ? 'numeric' : 'default'}
                />
              </View>
            ))}

            {formError ? (
              <View style={[styles.errorBox, { backgroundColor: theme.danger + '15', borderColor: theme.danger + '30' }]}>
                <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
                <Text style={{ color: theme.danger, fontSize: 13, flex: 1 }}>{formError}</Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { borderWidth: 1, borderColor: theme.border }]} onPress={() => setForm(null)} disabled={saving}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#10B981', opacity: saving ? 0.7 : 1 }]} onPress={guardar} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar</Text>}
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
  content: { paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.md, gap: 12 },
  contentDesktop: { maxWidth: 760, alignSelf: 'center', width: '100%', paddingHorizontal: 40, paddingTop: 28 },
  center: { paddingVertical: 60, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, height: 38, borderRadius: 12 },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  card: { gap: 12 },
  cardIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#10B98120', justifyContent: 'center', alignItems: 'center' },
  cardName: { fontSize: 16, fontWeight: '700' },
  cardMeta: { fontSize: 12.5, marginTop: 3 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: '#10B98125' },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#10B981' },
  iconBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  footLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 3 },
  footValue: { fontSize: 14, fontWeight: '600' },
  footMoney: { fontSize: 19, fontWeight: '800' },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 },
  modalBox: { width: '100%', maxWidth: 460 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 12 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  modalBtn: { flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
});
