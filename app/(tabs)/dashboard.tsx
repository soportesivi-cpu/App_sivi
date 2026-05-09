import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal, Switch, Image } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getDashboard, getWorkspaceState } from '../../services/api';
import { useAppStore } from '../../services/store';
import Loading from '../../components/Loading';

export default function DashboardScreen() {
  const { userData: usuario, clearSession, isDarkMode, toggleTheme, activeDomain } = useAppStore();
  const [showSettings, setShowSettings] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Fake workspace object based on domain if we really need it from secure store, or we read domain from store
  const workspace = { name: 'Imperium', domain: activeDomain }; // Fallback since workspace object is complex

  const { data: stateData, isLoading: isStateLoading, error: stateError } = useQuery({
    queryKey: ['workspaceState'],
    queryFn: getWorkspaceState,
    refetchInterval: 5000, 
  });

  const { data: dashboard, isLoading: isDashboardLoading, error: dashboardError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  const loading = isStateLoading || isDashboardLoading;
  const styles = getStyles(isDarkMode);

  async function cerrarSesion() {
    await clearSession();
  }

  function getCpuColor(val: number) {
    if (val > 80) return '#f44336';
    if (val > 60) return '#ff9800';
    return '#2196f3';
  }

  function getRamColor(val: number) {
    if (val > 80) return '#f44336';
    if (val > 60) return '#ff9800';
    return '#4caf50';
  }

  if (loading) {
    return <Loading />;
  }

  if (dashboardError) {
    return (
      <View style={[styles.centrado, { padding: 20 }]}>
        <Text style={{ color: 'red', fontSize: 18, marginBottom: 10 }}>Error de Conexión API</Text>
        <Text style={{ color: 'white', fontSize: 12 }}>Resource: {(stateError as any)?.message || 'OK'}</Text>
        <Text style={{ color: 'white', fontSize: 12 }}>Dashboard: {(dashboardError as any)?.message || 'OK'}</Text>
        <TouchableOpacity style={{ marginTop: 20, backgroundColor: '#f44336', padding: 10 }} onPress={cerrarSesion}>
          <Text style={{ color: 'white' }}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cpu = Number(stateData?.states?.cpu?.percent || 0);
  const ram = Number(stateData?.states?.ram?.percent || 0);
  const totalDisks = Object.keys(stateData?.states || {}).filter(k => k.startsWith('disk')).length || '—';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* TOPBAR */}
      <View style={styles.topbar}>
        <Image source={require('../../bg-grande.png')} style={styles.logoImage} resizeMode="contain" />
        <View style={styles.topRight}>
          {workspace && (
            <View style={styles.wsPill}>
              <Text style={styles.wsText}>{workspace.name}</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={24} color={isDarkMode ? "#ffffff80" : "#4b5563"} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>

        {/* USUARIO */}
        <View style={styles.userCard}>
          <View>
            <Text style={styles.userName}>
              {usuario?.first_name} {usuario?.last_name}
            </Text>
            <Text style={styles.userEmail}>{usuario?.email}</Text>
          </View>
          <View style={styles.activeRow}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Activo</Text>
          </View>
        </View>

        {/* CPU / RAM */}
        {stateData && (
          <View style={styles.resourceCard}>
            <Text style={styles.sectionTitle}>Servidor</Text>

            <View style={styles.barRow}>
              <Text style={styles.barLabel}>CPU</Text>
              <Text style={[styles.barVal, { color: getCpuColor(cpu) }]}>
                {Math.round(cpu)}%
              </Text>
            </View>
            <View style={styles.barBg}>
              <View style={[
                styles.barFill,
                { width: `${cpu}%` as any, backgroundColor: getCpuColor(cpu) }
              ]} />
            </View>

            <View style={[styles.barRow, { marginTop: 10 }]}>
              <Text style={styles.barLabel}>RAM</Text>
              <Text style={[styles.barVal, { color: getRamColor(ram) }]}>
                {Math.round(ram)}%
              </Text>
            </View>
            <View style={styles.barBg}>
              <View style={[
                styles.barFill,
                { width: `${ram}%` as any, backgroundColor: getRamColor(ram) }
              ]} />
            </View>
          </View>
        )}

        {/* STATS */}
        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.cardNum}>
              {dashboard?.rows?.length || dashboard?.cameras || dashboard?.data?.cameras || '—'}
            </Text>
            <Text style={styles.cardLabel}>Dashboards</Text>
          </View>
          <View style={styles.card}>
            <Text style={[styles.cardNum, { color: '#4caf50' }]}>ON</Text>
            <Text style={styles.cardLabel}>Sistema</Text>
          </View>
          <View style={styles.card}>
            <Text style={[styles.cardNum, { color: '#2196f3' }]}>
              {totalDisks}
            </Text>
            <Text style={styles.cardLabel}>Discos</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardNum}>
              {usuario?.role?.name === 'SuperAdmin' ? 'ADM' : 'USR'}
            </Text>
            <Text style={styles.cardLabel}>Rol</Text>
          </View>
        </View>

        {/* DOMINIO ACTIVO */}
        <View style={styles.dominioCard}>
          <View style={styles.dominioLeft}>
            <Text style={styles.dominioLabel}>Servidor conectado</Text>
            <Text style={styles.dominioDomain}>{workspace?.domain}</Text>
          </View>
          <View style={styles.dominioOnline} />
        </View>

      </View>

      {/* SETTINGS MODAL */}
      <Modal
        visible={showSettings}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Configuración</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={isDarkMode ? "#fff" : "#111827"} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
               <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                     <Ionicons name="notifications-outline" size={20} color="#2196f3" />
                     <Text style={styles.settingLabel}>Notificaciones Push</Text>
                  </View>
                  <Switch 
                    value={pushEnabled} 
                    onValueChange={setPushEnabled}
                    trackColor={{ false: '#3e3e3e', true: '#2196f380' }}
                    thumbColor={pushEnabled ? '#2196f3' : '#f4f3f4'}
                  />
               </View>
               
               <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                     <Ionicons name="volume-high-outline" size={20} color="#ff9800" />
                     <Text style={styles.settingLabel}>Sonidos de Alarma</Text>
                  </View>
                  <Switch 
                    value={soundEnabled} 
                    onValueChange={setSoundEnabled}
                    trackColor={{ false: '#3e3e3e', true: '#ff980080' }}
                    thumbColor={soundEnabled ? '#ff9800' : '#f4f3f4'}
                  />
               </View>

               <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                     <Ionicons name="moon-outline" size={20} color="#9c27b0" />
                     <Text style={styles.settingLabel}>Modo Oscuro</Text>
                  </View>
                  <Switch 
                    value={isDarkMode} 
                    onValueChange={toggleTheme}
                    trackColor={{ false: '#d1d5db', true: '#9c27b080' }}
                    thumbColor={isDarkMode ? '#9c27b0' : '#f4f3f4'}
                  />
               </View>

               <TouchableOpacity style={styles.logoutFullBtn} onPress={cerrarSesion}>
                  <Ionicons name="log-out-outline" size={20} color="#f44336" />
                  <Text style={styles.logoutFullText}>Cerrar Sesión Segura</Text>
               </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const getStyles = (isDark: boolean) => {
  const bgMain = isDark ? '#0d0d0d' : '#f3f4f6';
  const bgCard = isDark ? '#161622' : '#ffffff';
  const textPrimary = isDark ? '#ffffff' : '#111827';
  const textSecondary = isDark ? '#ffffff60' : '#6b7280';
  const textMuted = isDark ? '#ffffff40' : '#9ca3af';
  const borderCol = isDark ? '#ffffff10' : '#e5e7eb';
  const wsBg = isDark ? '#2196f318' : '#e0f2fe';
  const wsBorder = isDark ? '#2196f340' : '#bae6fd';
  const modalBg = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.4)';

  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bgMain,
  },
  centrado: {
    flex: 1,
    backgroundColor: bgMain,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: borderCol,
    backgroundColor: bgMain,
  },
  logoImage: {
    height: 60,
    width: 100,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wsPill: {
    backgroundColor: wsBg,
    borderWidth: 1,
    borderColor: wsBorder,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  wsText: {
    color: '#2196f3',
    fontSize: 11,
    fontWeight: '600',
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: borderCol,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutText: {
    color: textMuted,
    fontSize: 12,
  },
  body: {
    padding: 20,
    gap: 14,
  },
  userCard: {
    backgroundColor: bgCard,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: borderCol,
  },
  userName: {
    color: textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  userEmail: {
    color: textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4caf50',
  },
  activeText: {
    color: '#4caf50',
    fontSize: 11,
    fontWeight: '600',
  },
  resourceCard: {
    backgroundColor: bgCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: borderCol,
  },
  sectionTitle: {
    color: textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  barRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  barLabel: {
    color: textMuted,
    fontSize: 12,
  },
  barVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  barBg: {
    backgroundColor: isDark ? '#ffffff0a' : '#f3f4f6',
    borderRadius: 3,
    height: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    backgroundColor: bgCard,
    borderRadius: 12,
    padding: 16,
    width: '47%',
    borderWidth: 1,
    borderColor: borderCol,
    alignItems: 'center',
  },
  cardNum: {
    color: textPrimary,
    fontSize: 28,
    fontWeight: '700',
  },
  cardLabel: {
    color: textMuted,
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dominioCard: {
    backgroundColor: bgCard,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: borderCol,
    marginBottom: 20,
  },
  dominioLeft: {
    flex: 1,
  },
  dominioLabel: {
    color: textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  dominioDomain: {
    color: textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  dominioOnline: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4caf50',
  },
  settingsBtn: {
    padding: 4,
  },
  modalBg: {
    flex: 1,
    backgroundColor: modalBg,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: borderCol,
    backgroundColor: bgMain,
  },
  modalHeaderTitle: {
    color: textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    gap: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    color: textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  logoutFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4433615',
    borderWidth: 1,
    borderColor: '#f4433650',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
    gap: 8,
  },
  logoutFullText: {
    color: '#f44336',
    fontSize: 15,
    fontWeight: '700',
  }
});
};
