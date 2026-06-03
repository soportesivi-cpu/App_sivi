import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, Modal, Switch, Animated, Easing,
  ActivityIndicator, TextInput
} from 'react-native';
import { useAppStore } from '../services/store';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { WORKSPACES } from '../constants/config';
import { getWorkspacesSummary } from '../services/api'; // <-- NUEVO: Cliente API

// ─── Colores del sistema ─────────────────────────────────────────────────────
const BG       = '#000000';
const SURFACE  = '#1A1C2C';
const SURFACE2 = '#25283D';
const BORDER   = '#ffffff10';

// ─── Mini Trend Line (decorativa) ────────────────────────────────────────────
function TrendLine({ color }: { color: string }) {
  // Simulamos la curva con Views posicionados
  const points = [0, 10, 6, 14, 8, 4, 12, 2, 16, 0];
  const max = Math.max(...points);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 28, gap: 2, opacity: 0.8 }}>
      {points.map((p, i) => (
        <View
          key={i}
          style={{
            width: 3,
            height: Math.max(2, ((max - p) / max) * 24 + 4),
            backgroundColor: color,
            borderRadius: 2,
            opacity: 0.4 + (i / points.length) * 0.6,
          }}
        />
      ))}
    </View>
  );
}

// ─── Dot pulsante ────────────────────────────────────────────────────────────
function PulseDot({ color = '#00C853' }: { color?: string }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.6, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,   duration: 800, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: 14, height: 14, borderRadius: 7,
        backgroundColor: color + '40', transform: [{ scale: anim }]
      }} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const [showSettings, setShowSettings] = useState(false);
  const { setImpersonatedWorkspace, clearSession, isDarkMode, toggleTheme, workspaceSessions } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalWorkspaces: 0, newThisWeek: 0, totalCameras: 0 });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (workspaceSessions && workspaceSessions.length > 0) {
          console.log(`[SuperAdminDashboard] Cargando resumen para ${workspaceSessions.length} sesiones...`);
          const summary = await getWorkspacesSummary(workspaceSessions);
          const wsList = summary?.workspaces || [];
          setWorkspaces(wsList);
          
          // Calcular estadísticas reales de cámaras online
          const totalCams = wsList.reduce((acc: number, w: any) => {
            const hasLiveCams = w.metrics?.onlineCamerasCount !== null && typeof w.metrics?.onlineCamerasCount === 'number';
            return acc + (hasLiveCams ? w.metrics.onlineCamerasCount : w.metrics?.camerasCount || 0);
          }, 0);

          setStats({
            totalWorkspaces: wsList.length,
            newThisWeek: wsList.length > 2 ? 2 : 1,
            totalCameras: totalCams
          });
        } else {
          // Fallback a los estáticos de config.ts si no hay sesión
          console.warn('[SuperAdminDashboard] No hay sesiones en Zustand, usando fallback estático...');
          const wsList = WORKSPACES;
          setWorkspaces(wsList);
          const totalCams = wsList.reduce((acc: number, w: any) => acc + (w.cameras || 12), 0);
          setStats({
            totalWorkspaces: wsList.length,
            newThisWeek: wsList.length > 2 ? 2 : 1,
            totalCameras: totalCams
          });
        }
      } catch (e) {
        console.error('Error cargando workspaces en lobby SuperAdmin:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [workspaceSessions]);

  return (
    <View style={styles.root}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Ionicons name="shield-checkmark" size={18} color="#2E9BFF" />
          </View>
          <Text style={styles.logoText}>SIVI</Text>
        </View>

        {/* Acciones */}
        <View style={styles.headerRight}>
          {/* Badge SUPER con corona */}
          <View style={styles.superBadge}>
            <Text style={styles.superCrown}>👑</Text>
            <Text style={styles.superText}>SUPER</Text>
          </View>
          {/* Engranaje — abre settings (incluye logout) */}
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── STATS CARDS ── */}
        <View style={styles.statsRow}>

          {/* Total Workspaces */}
          <View style={[styles.statCard, { borderColor: '#2E9BFF30' }]}>
            <View style={styles.statCardTop}>
              <View style={[styles.statIcon, { backgroundColor: '#0D2340' }]}>
                <Ionicons name="business" size={18} color="#2E9BFF" />
              </View>
              <View style={styles.weekBadge}>
                <Text style={styles.weekText}>+{stats.newThisWeek} esta semana</Text>
              </View>
            </View>
            <Text style={styles.statLabel}>TOTAL WORKSPACES</Text>
            <Text style={[styles.statValue, { color: '#2E9BFF' }]}>{stats.totalWorkspaces}</Text>
            <TrendLine color="#2E9BFF" />
          </View>

          {/* Cámaras Online */}
          <View style={[styles.statCard, { borderColor: '#00C85330' }]}>
            <View style={styles.statCardTop}>
              <View style={[styles.statIcon, { backgroundColor: '#062718' }]}>
                <Ionicons name="videocam" size={18} color="#00C853" />
              </View>
              <PulseDot color="#00C853" />
            </View>
            <Text style={styles.statLabel}>CÁMARAS ONLINE</Text>
            <Text style={[styles.statValue, { color: '#00C853' }]}>{stats.totalCameras}</Text>
            <TrendLine color="#00C853" />
          </View>

        </View>

        {/* ── SECCIÓN TITLE ── */}
        <View style={styles.sectionRow}>
          <Ionicons name="layers" size={16} color="#2E9BFF" />
          <Text style={styles.sectionTitle}>TOTAL DE WORKSPACES</Text>
        </View>

        {/* SEARCH BAR (Búsqueda de Workspaces) */}
        <View style={{ paddingHorizontal: 0, marginBottom: 5 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#1A1C2C',
            height: 48,
            borderRadius: 12,
            paddingHorizontal: 15,
            borderWidth: 1,
            borderColor: '#ffffff15'
          }}>
            <Ionicons name="search" size={18} color="#ffffff60" />
            <TextInput
              placeholder="Buscar workspace por nombre..."
              placeholderTextColor="#ffffff30"
              style={{ flex: 1, color: '#fff', fontSize: 14, marginLeft: 10, fontWeight: '500' }}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#ffffff60" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── WORKSPACE CARDS ── */}
        <View style={styles.cardsList}>
          {loading ? (
            <ActivityIndicator size="large" color="#2E9BFF" style={{ marginTop: 32 }} />
          ) : (
            workspaces.filter(ws => {
              const name = ws.workspace || ws.name || '';
              return name.toLowerCase().includes(searchQuery.toLowerCase());
            }).map((instance) => {
              // Mapear campos de acuerdo a si vienen dinámicos del summary o estáticos del config
              const wsId = instance.workspace || instance.id || '';
              const wsStatus = instance.status || '';
              const isActive = wsStatus === 'deployed' || wsStatus === 'Active' || wsStatus === 'active' || !wsStatus;
              
              const configMatch = WORKSPACES.find(w => w.id === wsId);
              const wsName = configMatch?.name || instance.workspace || instance.name || 'Workspace';
              const type = configMatch?.type || instance.type || 'cloud';

              const cameras = instance.metrics?.camerasCount !== undefined ? instance.metrics.camerasCount : (instance.cameras || 0);
              const users = instance.metrics?.usersCount !== undefined ? instance.metrics.usersCount : (instance.users || 0);

              const onlineColor = '#4caf50';
              const offlineColor = '#ffffff80';

              return (
                <TouchableOpacity
                  key={wsId}
                  style={styles.card}
                  onPress={() => {
                    if (!isActive) return;
                    // Personificar inyectando los datos de conexión resueltos
                    const impersonationPayload = configMatch || {
                      id: wsId,
                      name: wsName,
                      domain: instance.backendUrl ? instance.backendUrl.replace(/https?:\/\//, '') : 'orchestrator.guardian.imperium.pe',
                      https: instance.backendUrl ? instance.backendUrl.startsWith('https') : false,
                      type: type,
                      workId: '23'
                    };
                    setImpersonatedWorkspace(impersonationPayload);
                  }}
                  disabled={!isActive}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardLeft}>
                    {/* Contenedor del icono */}
                    <View style={[
                      styles.iconContainer, 
                      { 
                        backgroundColor: isActive ? '#2E9BFF18' : '#ffffff08',
                        borderColor: isActive ? '#2E9BFF30' : '#ffffff15'
                      }
                    ]}>
                      <Ionicons
                        name="business"
                        size={20}
                        color={isActive ? '#2E9BFF' : '#ffffff60'}
                      />
                    </View>
                    
                    {/* Información del Workspace */}
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardNombre} numberOfLines={1}>
                        {wsName.toUpperCase()}
                      </Text>
                      <Text style={styles.cardSubtitle}>
                        {cameras} Cámaras  •  {users} Usuarios
                      </Text>
                    </View>
                  </View>

                  {/* Lado derecho: Estado + Chevron */}
                  <View style={styles.cardRight}>

                    {/* Tipo de Workspace: LOCAL o NUBE */}
                    {type && (
                      <View style={[
                        styles.typeBadge,
                        {
                          backgroundColor: type === 'local' ? '#FF980015' : '#4CAF5015',
                          borderColor: type === 'local' ? '#FF980040' : '#4CAF5040',
                        }
                      ]}>
                        <Text style={[
                          styles.typeText,
                          { color: type === 'local' ? '#FF9800' : '#4CAF50' }
                        ]}>
                          {type === 'cloud' ? 'NUBE' : type.toUpperCase()}
                        </Text>
                      </View>
                    )}

                    {/* Badge de Estado: ACTIVO / INACTIVO */}
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: isActive ? '#4caf5015' : '#ffffff08' }
                    ]}>
                      <View style={[
                        styles.statusDot,
                        { backgroundColor: isActive ? onlineColor : '#ffffff40' }
                      ]} />
                      <Text style={[
                        styles.statusText,
                        { color: isActive ? onlineColor : offlineColor }
                      ]}>
                        {isActive ? 'ACTIVO' : 'INACTIVO'}
                      </Text>
                    </View>
                    
                    <Ionicons name="chevron-forward" size={16} color="#2E9BFF" />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

      </ScrollView>

      {/* ── SETTINGS MODAL ── */}
      <Modal
        visible={showSettings}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configuración</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Modo oscuro */}
              <View style={styles.settingRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.settingIconBox, { backgroundColor: '#1A2440' }]}>
                    <Ionicons name={isDarkMode ? 'moon' : 'sunny'} size={18} color="#2E9BFF" />
                  </View>
                  <Text style={styles.settingText}>Modo Oscuro</Text>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#333', true: '#2E9BFF' }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* Cerrar sesión */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => { setShowSettings(false); clearSession(); }}
            >
              <Ionicons name="log-out-outline" size={20} color="#F44336" />
              <Text style={styles.logoutText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 52,
    paddingBottom: 12,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIcon: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: '#0D2340',
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: '#2E9BFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  superBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#1A1400', borderWidth: 1, borderColor: '#FFB30040',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  superCrown: { fontSize: 12 },
  superText: { color: '#FFB300', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 9,
    backgroundColor: SURFACE2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },

  // Scroll
  scroll: { paddingHorizontal: 16, paddingBottom: 48, gap: 20 },

  // Stat cards
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1, backgroundColor: SURFACE, borderWidth: 1,
    borderColor: BORDER, borderRadius: 14, padding: 14, gap: 6,
  },
  statCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  statIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  weekBadge: { backgroundColor: '#A6E6FF15', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  weekText: { color: '#A6E6FF', fontSize: 10, fontWeight: '600' },
  statLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },
  statValue: { fontSize: 34, fontWeight: '800', letterSpacing: -1 },

  // Section title
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },

  // Workspace cards (Nuevo estilo consistente con cámaras)
  cardsList: { gap: 14 },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  cardInfo: {
    flex: 1,
  },
  cardNombre: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    marginTop: 3,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: SURFACE, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    borderWidth: 1, borderColor: BORDER,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: BORDER, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalBody: { gap: 8, marginBottom: 28 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  settingIconBox: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  settingText: { color: '#fff', fontSize: 15 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F4433615', padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#F4433640',
  },
  logoutText: { color: '#F44336', fontSize: 15, fontWeight: '700' },
});
