import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function EventConfigScreen() {
  const router = useRouter();
  const [eventActive, setEventActive] = useState(true);
  const [soundActive, setSoundActive] = useState(false);
  const [pushActive, setPushActive] = useState(true);
  const [isAlarm, setIsAlarm] = useState(true);

  const DaysRow = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
      {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day, idx) => (
        <TouchableOpacity key={day} style={[styles.dayPill, idx < 5 ? styles.dayPillActive : styles.dayPillInactive]}>
          <Text style={[styles.dayText, idx < 5 ? styles.dayTextActive : styles.dayTextInactive]}>{day}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* TOP APP BAR */}
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
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Configuración de Evento Inteligente</Text>
          <Text style={styles.subTitle}>Modificando parámetros de detección y alertas.</Text>
        </View>

        {/* CONTROLES GENERALES */}
        <View style={styles.bentoBlock}>
          <View style={styles.blockHeader}>
            <Ionicons name="settings-outline" size={16} color="#ffffff" />
            <Text style={styles.blockTitle}>CONTROLES GENERALES</Text>
          </View>
          
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Estado del Evento</Text>
              <Text style={styles.settingDesc}>Activar o desactivar este evento inteligente.</Text>
            </View>
            <Switch 
              value={eventActive} 
              onValueChange={setEventActive} 
              trackColor={{ false: '#353436', true: '#2E9BFF30' }}
              thumbColor={eventActive ? '#2E9BFF' : '#444444'}
            />
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Sonido de Alerta</Text>
              <Text style={styles.settingDesc}>Emitir sonido en centro de control al detectar.</Text>
            </View>
            <Switch 
              value={soundActive} 
              onValueChange={setSoundActive} 
              trackColor={{ false: '#353436', true: '#2E9BFF30' }}
              thumbColor={soundActive ? '#2E9BFF' : '#444444'}
            />
          </View>
        </View>

        {/* REGIÓN DE INTERÉS (ROI) */}
        <View style={styles.bentoBlock}>
          <View style={[styles.blockHeader, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="scan-outline" size={16} color="#ffffff" />
              <Text style={styles.blockTitle}>REGIÓN DE INTERÉS (ROI)</Text>
            </View>
            <TouchableOpacity>
               <Text style={styles.editLink}>Editar Región</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.roiContainer}>
             <Image 
                source={{ uri: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9' }} 
                style={styles.roiImage} 
             />
             <View style={styles.roiOverlay}>
                <View style={styles.roiTag}>
                   <View style={styles.liveDot} />
                   <Text style={styles.roiTagText}>CAM-04 ENTRADA</Text>
                </View>
             </View>
          </View>
        </View>

        {/* FRANJA HORARIA */}
        <View style={styles.bentoBlock}>
          <View style={styles.blockHeader}>
            <Ionicons name="time-outline" size={16} color="#ffffff" />
            <Text style={styles.blockTitle}>FRANJA HORARIA</Text>
          </View>
          
          <View style={styles.timeRow}>
            <View style={styles.timeInputBox}>
               <Text style={styles.timeLabel}>Hora de Inicio</Text>
               <View style={styles.timeInput}>
                  <Ionicons name="alarm-outline" size={16} color="#ffffff40" />
                  <Text style={styles.timeValue}>08:00 p. m.</Text>
               </View>
            </View>
            <View style={styles.timeInputBox}>
               <Text style={styles.timeLabel}>Hora de Fin</Text>
               <View style={styles.timeInput}>
                  <Ionicons name="alarm-outline" size={16} color="#ffffff40" />
                  <Text style={styles.timeValue}>06:00 a. m.</Text>
               </View>
            </View>
          </View>
          <DaysRow />
        </View>

        {/* LÓGICA DE NOTIFICACIÓN */}
        <View style={styles.bentoBlock}>
          <View style={styles.blockHeader}>
            <Ionicons name="warning-outline" size={16} color="#d71a18" />
            <Text style={styles.blockTitle}>LÓGICA DE NOTIFICACIÓN</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Notificaciones Push</Text>
              <Text style={styles.settingDesc}>Enviar alerta a móviles asociados.</Text>
            </View>
            <Switch 
              value={pushActive} 
              onValueChange={setPushActive} 
              trackColor={{ false: '#353436', true: '#2E9BFF30' }}
              thumbColor={pushActive ? '#2E9BFF' : '#444444'}
            />
          </View>

          <View style={[styles.alarmBox, isAlarm && styles.alarmBoxActive]}>
             <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, isAlarm && { color: '#ffb4aa' }]}>¿Tratar como Alarma?</Text>
                <Text style={styles.settingDesc}>Generará una alerta crítica en el sistema.</Text>
             </View>
             <Switch 
                value={isAlarm} 
                onValueChange={setIsAlarm} 
                trackColor={{ false: '#353436', true: '#d71a1840' }}
                thumbColor={isAlarm ? '#d71a18' : '#444444'}
             />
          </View>

          {isAlarm && (
            <View style={styles.alarmParams}>
               <View style={styles.inputGroup}>
                  <Text style={styles.timeLabel}>Tiempo de Alarma (seg)</Text>
                  <TextInput style={styles.darkInput} value="30" keyboardType="numeric" />
               </View>
               <View style={styles.inputGroup}>
                  <Text style={styles.timeLabel}>Cooldown (min)</Text>
                  <TextInput style={styles.darkInput} value="5" keyboardType="numeric" />
               </View>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.saveBtn}>
           <Ionicons name="save-outline" size={18} color="#fff" />
           <Text style={styles.saveBtnText}>GUARDAR CAMBIOS</Text>
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
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1A1C2C', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ffffff20' },
  avatarText: { color: '#2E9BFF', fontSize: 12, fontWeight: '700' },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  titleSection: { marginTop: 25, marginBottom: 25 },
  mainTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  subTitle: { color: '#ffffff', fontSize: 13, marginTop: 4 },

  bentoBlock: { backgroundColor: '#1A1C2C', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#ffffff08' },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  blockTitle: { color: '#ffffff40', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  editLink: { color: '#2E9BFF', fontSize: 11, fontWeight: '700' },

  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  settingLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  settingDesc: { color: '#ffffff', fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#ffffff05', marginVertical: 15 },

  roiContainer: { width: '100%', aspectRatio: 16/9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  roiImage: { width: '100%', height: '100%', opacity: 0.6 },
  roiOverlay: { ...StyleSheet.absoluteFillObject, padding: 15 },
  roiTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00000080', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignSelf: 'flex-start', gap: 8, borderWidth: 1, borderColor: '#ffffff10' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F44336' },
  roiTagText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  timeRow: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  timeInputBox: { flex: 1, gap: 8 },
  timeLabel: { color: '#ffffff40', fontSize: 11, fontWeight: '600' },
  timeInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111112', height: 48, borderRadius: 10, paddingHorizontal: 12, gap: 10, borderWidth: 1, borderColor: '#ffffff10' },
  timeValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  
  daysScroll: { marginTop: 5 },
  dayPill: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1 },
  dayPillActive: { backgroundColor: '#2E9BFF20', borderColor: '#2E9BFF40' },
  dayPillInactive: { backgroundColor: '#111112', borderColor: '#ffffff08' },
  dayText: { fontSize: 11, fontWeight: '700' },
  dayTextActive: { color: '#2E9BFF' },
  dayTextInactive: { color: '#ffffff40' },

  alarmBox: { flexDirection: 'row', alignItems: 'center', marginTop: 15, padding: 15, borderRadius: 12, backgroundColor: '#ffffff05' },
  alarmBoxActive: { backgroundColor: '#F4433608', borderWidth: 1, borderColor: '#F4433620' },
  alarmParams: { marginTop: 20, gap: 15 },
  inputGroup: { gap: 8 },
  darkInput: { backgroundColor: '#111112', height: 48, borderRadius: 10, paddingHorizontal: 15, color: '#fff', fontSize: 14, fontWeight: '600', borderWidth: 1, borderColor: '#ffffff10' },

  saveBtn: { backgroundColor: '#2E9BFF', height: 56, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10, shadowColor: '#2E9BFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 }
});
