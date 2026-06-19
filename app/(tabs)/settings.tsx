import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../services/store';
import { Colors } from '../../constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { userData, activeWorkspace, impersonatedWorkspace, clearSession, isDarkMode, toggleTheme } = useAppStore();

  const currentWs = impersonatedWorkspace || activeWorkspace;
  const fullName = userData 
    ? `${userData.first_name || userData.firstName || ''} ${userData.last_name || userData.lastName || ''}`.trim() || userData.Username || userData.username || 'Usuario'
    : 'Usuario';
  const roleName = userData?.role?.name === 'SuperAdmin' ? 'SUPERADMIN' : 'ADMIN';
  const workspaceName = currentWs?.name || currentWs?.id || currentWs?.workspace || 'Workspace';

  const styles = getStyles(isDarkMode);

  return (
    <View style={styles.container}>
      {/* TOP BAR SIVI */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#2E9BFF" />
          </TouchableOpacity>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#2E9BFF20', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="shield-checkmark" size={18} color="#2E9BFF" />
          </View>
          <Text style={{ color: '#2E9BFF', fontSize: 20, fontWeight: '900', letterSpacing: -1, marginLeft: 10 }}>SIVI</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: 24, marginBottom: 25 }}>
          <Text style={styles.settingsTitle}>Ajustes</Text>
        </View>

        {/* USER INFO HEADER */}
        <View style={styles.userCard}>
          <View style={styles.userOverlay} />
          <View style={styles.adminBadgeRow}>
            <Ionicons name="person" size={12} color={isDarkMode ? '#ffffff' : '#111827'} style={{ marginRight: 6 }} />
            <Text style={[styles.adminName, { color: isDarkMode ? '#ffffff' : '#111827' }]}>{fullName}</Text>
            <View style={styles.pulseDot} />
            <Text style={styles.adminStatus}>{roleName} ACTIVO</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 }}>
            <Ionicons name="business" size={12} color="#2E9BFF" />
            <Text style={{ color: '#2E9BFF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
              {workspaceName}
            </Text>
          </View>
        </View>

        {/* PREFERENCIAS TEMA */}
        <View style={styles.bentoBlock}>
          <View style={styles.blockHeader}>
            <Ionicons name="options-outline" size={18} color="#2E9BFF" />
            <Text style={styles.blockTitle}>Aspecto</Text>
          </View>
          
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Modo Oscuro</Text>
              <Text style={styles.settingDesc}>Alternar entre el tema claro y oscuro de la aplicación.</Text>
            </View>
            <View style={styles.switchWithLabel}>
              <Text style={styles.activeLabel}>{isDarkMode ? 'ACTIVO' : 'INACTIVO'}</Text>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: '#767577', true: '#2E9BFF' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>

        {/* CERRAR SESIÓN */}
        <TouchableOpacity style={styles.logoutBtn} onPress={() => clearSession()}>
           <Ionicons name="log-out-outline" size={20} color="#F44336" />
           <Text style={styles.logoutText}>Cerrar Sesión Segura</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const getStyles = (isDark: boolean) => {
  const themeColors = isDark ? Colors.dark : Colors.light;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background, paddingTop: 50 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 60, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    backBtn: { padding: 5 },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    logoText: { color: '#2E9BFF', fontSize: 18, fontWeight: '900', letterSpacing: -1 },

    scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
    settingsTitle: { color: themeColors.text, fontSize: 36, fontWeight: '800' },
    
    userCard: { backgroundColor: themeColors.surface, borderRadius: 24, padding: 30, marginTop: 25, marginBottom: 25, overflow: 'hidden', borderWidth: 1, borderColor: themeColors.border },
    userOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#2E9BFF05' },
    adminBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    adminName: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
    pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', marginLeft: 5 },
    adminStatus: { color: '#4CAF50', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

    bentoBlock: { backgroundColor: themeColors.surface, borderRadius: 16, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: themeColors.border },
    blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    blockTitle: { color: themeColors.text, fontSize: 16, fontWeight: '700' },

    settingRow: { flexDirection: 'row', alignItems: 'center', gap: 15, justifyContent: 'space-between' },
    settingLabel: { color: themeColors.text, fontSize: 15, fontWeight: '600' },
    settingDesc: { color: themeColors.textSecondary, fontSize: 12, marginTop: 2 },
    
    switchWithLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    activeLabel: { color: '#2E9BFF', fontSize: 12, fontWeight: '800' },

    logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4433610', height: 60, borderRadius: 16, borderWidth: 1, borderColor: '#F4433630', gap: 10, marginTop: 20 },
    logoutText: { color: '#F44336', fontSize: 16, fontWeight: '800' }
  });
};
