import React, { useState } from 'react';
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

export default function SettingsScreen() {
  const router = useRouter();
  const { isDarkMode, toggleTheme: toggleDarkMode, soundEnabled, toggleSound, clearSession } = useAppStore();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

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
          <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800' }}>Ajustes</Text>
        </View>

        {/* USER INFO HEADER */}
        <View style={styles.userCard}>
          <View style={styles.userOverlay} />
          <View style={styles.adminBadgeRow}>
            <Ionicons name="person" size={12} color="#ffffff" />
            <Text style={styles.adminName}>S. Connor</Text>
            <View style={styles.pulseDot} />
            <Text style={styles.adminStatus}>ADMIN ACTIVO</Text>
          </View>
        </View>

        {/* PREFERENCIA DE INTERFAZ */}
        <View style={styles.bentoBlock}>
           <View style={styles.blockHeader}>
              <Ionicons name={"color-palette" as any} size={18} color="#2E9BFF" />
              <Text style={styles.blockTitle}>Preferencia de Interfaz</Text>
           </View>
           <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                 <Text style={styles.settingLabel}>Modo Oscuro</Text>
                 <Text style={styles.settingDesc}>Activar tema oscuro</Text>
              </View>
              <Switch 
                value={isDarkMode} 
                onValueChange={toggleDarkMode}
                trackColor={{ false: '#353436', true: '#2E9BFF30' }}
                thumbColor={isDarkMode ? '#2E9BFF' : '#444444'}
              />
           </View>
        </View>

        {/* NOTIFICACIONES */}
        <View style={styles.bentoBlock}>
           <View style={styles.blockHeader}>
              <Ionicons name="notifications" size={18} color="#2E9BFF" />
              <Text style={styles.blockTitle}>Notificaciones y Alertas</Text>
           </View>
           <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                 <Text style={styles.settingLabel}>Notificaciones Push para Alertas</Text>
                 <Text style={styles.settingDesc}>Recibir alertas en el dispositivo</Text>
              </View>
              <Switch 
                value={pushEnabled} 
                onValueChange={setPushEnabled}
                trackColor={{ false: '#353436', true: '#2E9BFF30' }}
                thumbColor={pushEnabled ? '#2E9BFF' : '#444444'}
              />
           </View>

           <View style={{ height: 1, backgroundColor: '#ffffff08', marginVertical: 15 }} />

           <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                 <Text style={styles.settingLabel}>Sonido de Alerta Tecnológico</Text>
                 <Text style={styles.settingDesc}>Emitir un sonido especial al recibir alertas</Text>
              </View>
              <Switch 
                value={soundEnabled} 
                onValueChange={toggleSound}
                trackColor={{ false: '#353436', true: '#2E9BFF30' }}
                thumbColor={soundEnabled ? '#2E9BFF' : '#444444'}
              />
           </View>
        </View>

        {/* SEGURIDAD */}
        <View style={styles.bentoBlock}>
           <View style={styles.blockHeader}>
              <Ionicons name="shield-half" size={18} color="#2E9BFF" />
              <Text style={styles.blockTitle}>Seguridad</Text>
           </View>
           <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                 <Text style={styles.settingLabel}>Doble Autenticación (2FA)</Text>
                 <Text style={styles.settingDesc}>Añade una capa extra de seguridad</Text>
              </View>
              <View style={styles.switchWithLabel}>
                 <Text style={styles.activeLabel}>Activo</Text>
                 <Switch 
                    value={twoFactorEnabled} 
                    onValueChange={setTwoFactorEnabled}
                    trackColor={{ false: '#353436', true: '#2E9BFF30' }}
                    thumbColor={twoFactorEnabled ? '#2E9BFF' : '#444444'}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', paddingTop: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 60, borderBottomWidth: 1, borderBottomColor: '#ffffff08' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  backBtn: { padding: 5 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoText: { color: '#2E9BFF', fontSize: 18, fontWeight: '900', letterSpacing: -1 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  
  userCard: { backgroundColor: '#1A1C2C', borderRadius: 24, padding: 30, marginTop: 25, marginBottom: 25, overflow: 'hidden', borderWidth: 1, borderColor: '#ffffff10' },
  userOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#2E9BFF05' },
  settingsTitle: { color: '#fff', fontSize: 36, fontWeight: '800', marginBottom: 12 },
  adminBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adminName: { color: '#ffffff', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2E9BFF', marginLeft: 5 },
  adminStatus: { color: '#2E9BFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  bentoBlock: { backgroundColor: '#1A1C2C', borderRadius: 16, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#ffffff08' },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  blockTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },

  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  settingLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  settingDesc: { color: '#ffffff', fontSize: 12, marginTop: 2 },
  
  switchWithLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activeLabel: { color: '#2E9BFF', fontSize: 12, fontWeight: '800' },

  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4433610', height: 60, borderRadius: 16, borderWidth: 1, borderColor: '#F4433630', gap: 10, marginTop: 20 },
  logoutText: { color: '#F44336', fontSize: 16, fontWeight: '800' }
});
