import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../services/store';
import { 
  getWorkspaceAlarmConfigurationDetail, 
  updateWorkspaceAlarmConfiguration, 
  updateWorkspaceAlarmPolygons
} from '../../services/api';

export default function EventConfigScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { activeDomain: domain, activeWorkspace, impersonatedWorkspace, workspaceSessions } = useAppStore();
  const currentWs = impersonatedWorkspace || activeWorkspace;

  // Estados Accordion
  const [rulesExpanded, setRulesExpanded] = useState(true);
  const [actionsExpanded, setActionsExpanded] = useState(true);

  // Controles Generales
  const [eventActive, setEventActive] = useState(true);
  const [selectedSoundId, setSelectedSoundId] = useState<number | string | null>(null);
  const [frequencyVal, setFrequencyVal] = useState("3");
  const [cooldownVal, setCooldownVal] = useState("10");

  // Controles de Acciones
  const [popUpActive, setPopUpActive] = useState(false);
  const [notifiableActive, setNotifiableActive] = useState(false);
  const [whatsappActive, setWhatsappActive] = useState(false);
  const [emailActive, setEmailActive] = useState(false);
  const [soundActionActive, setSoundActionActive] = useState(false);
  const [alertActive, setAlertActive] = useState(false);
  const [confirmationActive, setConfirmationActive] = useState(false);
  const [timeoutVal, setTimeoutVal] = useState("30");

  // Región de Interés (ROI)
  const [roiActive, setRoiActive] = useState(true);
  const [roiId, setRoiId] = useState<number | null>(null);
  const [roiPoints, setRoiPoints] = useState<string>("[]");

  const [isSaving, setIsSaving] = useState(false);


  // 1. Obtener el detalle completo de la regla
  const { data: alarm, isLoading: loadingAlarm, error } = useQuery({
    queryKey: ['alarm-detail', domain, currentWs?.id, id],
    queryFn: () => getWorkspaceAlarmConfigurationDetail(String(id)),
    enabled: !!(workspaceSessions && workspaceSessions.length > 0 && id),
  });



  // 4. Inicializar controles al cargar datos reales
  useEffect(() => {
    if (alarm) {
      setEventActive(alarm.state ?? true);
      setSelectedSoundId(alarm.sound ?? null);
      setFrequencyVal(String(alarm.frequency ?? "3"));
      setCooldownVal(String(alarm.cooldown ?? "10"));
      
      
      const actionObj = alarm.actions?.[0] || alarm.Detail_action_alarm?.[0];
      if (actionObj) {
        setSoundActionActive(actionObj.issound ?? false);
        setAlertActive(actionObj.isalert ?? true);
        setPopUpActive(actionObj.ismodal ?? true);
        setConfirmationActive(actionObj.manual_confirmation ?? false);
        setTimeoutVal(String(actionObj.timeout ?? "30"));
        
        // Whatsapp, Email, Notificable
        setWhatsappActive(actionObj.iswhatsapp ?? actionObj.is_whatsapp ?? actionObj.whatsapp ?? false);
        setEmailActive(actionObj.isemail ?? actionObj.is_email ?? actionObj.email ?? false);
        setNotifiableActive(actionObj.notifiable ?? actionObj.is_notifiable ?? false);
      }

      // Región de Interés
      const roiObj = alarm.roi?.[0] || alarm.Detail_rule_roi_alarm?.[0];
      if (roiObj) {
        setRoiActive(roiObj.state ?? true);
        setRoiId(roiObj.id ?? null);
        setRoiPoints(roiObj.points ?? "[]");
      } else {
        setRoiId(null);
      }
    }
  }, [alarm]);


  // 5. Guardar Cambios Sanitizando el Payload
  const handleSave = async () => {
    if (!alarm) return;
    setIsSaving(true);
    
    // Sanitizado estricto del Payload — solo campos permitidos por MobileAlarmUpdatePayload
    const alarmPayload = {
      state: eventActive,
      sound: selectedSoundId !== null ? Number(selectedSoundId) : undefined,
      frequency: Number(frequencyVal) || 3,
    };

    const actionObj = alarm.actions?.[0] || alarm.Detail_action_alarm?.[0];
    const actionPayload = {
      id: actionObj?.id || 1,
      issound: soundActionActive,
      isalert: alertActive,
      ismodal: popUpActive,
      manual_confirmation: confirmationActive,
      timeout: Number(timeoutVal) || 30
    };

    try {
      const promises: Promise<any>[] = [];

      promises.push(
        updateWorkspaceAlarmConfiguration({
          alarmId: Number(id),
          alarm: alarmPayload,
          action: actionPayload
        })
      );

      if (roiId !== null) {
        promises.push(
          updateWorkspaceAlarmPolygons([
            {
              roiId: roiId,
              state: roiActive,
              points: roiPoints
            }
          ])
        );
      }

      await Promise.all(promises);
      
      console.log('[EVENT CONFIG] Configuración guardada con éxito.');
      queryClient.invalidateQueries({ queryKey: ['alarms'] });
      queryClient.invalidateQueries({ queryKey: ['alarm-detail'] });
      router.replace('/(tabs)/events');
    } catch (err) {
      console.error('[EVENT CONFIG] Error al guardar:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingAlarm) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2E9BFF" />
        <Text style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: 15, fontSize: 14, fontWeight: '600' }}>
          Cargando configuración de la alarma...
        </Text>
      </View>
    );
  }

  if (error || !alarm) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={56} color="#F44336" />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 15 }}>
          Error al cargar la alarma
        </Text>
        <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 12, textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
          {String(error || 'No se pudo recuperar la información detallada desde la API.')}
        </Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/events')} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>VOLVER A EVENTOS</Text>
        </TouchableOpacity>
      </View>
    );
  }


  // Resolver reglas de la tabla RULES
  let parsedRules: any[] = [];
  if (alarm.Detail_rule_obj_alarm && alarm.Detail_rule_obj_alarm.length > 0) {
    alarm.Detail_rule_obj_alarm.forEach((r: any) => {
      parsedRules.push({
        analytic: 'object',
        state: String(r.state ?? true),
        tag: r.tag || 'person',
        alertime: `${r.alertime ?? '0.2'}s`,
        prob: `${r.prob ?? '75'}%`,
        tag_count: r.tag_count ?? '10',
        side: r.side ?? '-1',
        way: r.way || 'ALL',
        listId: 'N/A',
        entity: r.entity || 'Access',
        speed: '-1'
      });
    });
  }
  if (alarm.Detail_rule_face__alarm && alarm.Detail_rule_face__alarm.length > 0) {
    alarm.Detail_rule_face__alarm.forEach((r: any) => {
      parsedRules.push({
        analytic: 'face',
        state: String(r.state ?? true),
        tag: 'rostro',
        alertime: '-',
        prob: `${r.prob ?? '95'}%`,
        tag_count: '-',
        side: '-',
        way: '-',
        listId: r.listId || 'VIP',
        entity: 'Access',
        speed: '-'
      });
    });
  }
  if (alarm.Detail_rule_lpr__alarm && alarm.Detail_rule_lpr__alarm.length > 0) {
    alarm.Detail_rule_lpr__alarm.forEach((r: any) => {
      parsedRules.push({
        analytic: 'lpr',
        state: String(r.state ?? true),
        tag: 'placa',
        alertime: '-',
        prob: `${r.prob ?? '98'}%`,
        tag_count: '-',
        side: '-',
        way: '-',
        listId: '-',
        entity: 'Access',
        speed: '-'
      });
    });
  }
  if (alarm.Detail_rule_action_alarm && alarm.Detail_rule_action_alarm.length > 0) {
    alarm.Detail_rule_action_alarm.forEach((r: any) => {
      parsedRules.push({
        analytic: 'action',
        state: String(r.state ?? true),
        tag: r.actionName || 'acción',
        alertime: '-',
        prob: `${r.prob ?? '90'}%`,
        tag_count: '-',
        side: '-',
        way: '-',
        listId: '-',
        entity: 'Access',
        speed: '-'
      });
    });
  }

  // Parsear puntos del ROI
  let pointsList: any[] = [];
  if (roiPoints && roiPoints !== '[]') {
    try {
      pointsList = typeof roiPoints === 'string' ? JSON.parse(roiPoints) : roiPoints;
    } catch (e) {}
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* HEADER PREMIUM */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/events')} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#2E9BFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{alarm.name || 'Detalles de Alarma'}</Text>
        <View style={styles.logoBox}>
          <Ionicons name="shield-checkmark" size={18} color="#2E9BFF" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* TITULO DE CABECERA */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Configuración Evento Inteligente</Text>
          <Text style={styles.subTitle}>Parámetros de eventos inteligentes homologados con la web.</Text>
        </View>

        {/* 1. SECCIÓN: DATOS GENERALES (IMAGEN 1 SUPERIOR) */}
        <View style={styles.bentoBlock}>
          <View style={styles.blockHeader}>
            <Ionicons name="create-outline" size={16} color="#2E9BFF" />
            <Text style={[styles.blockTitle, { color: '#2E9BFF' }]}>DATOS GENERALES</Text>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.selectorLabel}>NOMBRE</Text>
            <TextInput 
              style={[styles.darkInput, { color: 'rgba(255,255,255,0.7)', backgroundColor: '#090B14' }]} 
              value={alarm.name || ''} 
              editable={false} 
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Estado del Evento</Text>
            </View>
            <Switch 
              value={eventActive} 
              onValueChange={setEventActive} 
              trackColor={{ false: '#25283D', true: '#2E9BFF30' }}
              thumbColor={eventActive ? '#2E9BFF' : '#555'}
            />
          </View>



          <View style={styles.timeRow}>
            <View style={styles.timeInputBox}>
              <Text style={styles.selectorLabel}>FRECUENCIA EVENTO INTELIGENTE</Text>
              <TextInput 
                style={styles.darkInput} 
                value={frequencyVal} 
                onChangeText={setFrequencyVal}
                keyboardType="numeric" 
              />
            </View>
            <View style={styles.timeInputBox}>
              <Text style={styles.selectorLabel}>COOLDOWN ALERTA (SEGUNDOS)</Text>
              <TextInput 
                style={styles.darkInput} 
                value={cooldownVal} 
                onChangeText={setCooldownVal}
                keyboardType="numeric" 
              />
            </View>
          </View>
        </View>



        {/* 3. SECCIÓN: REGLAS REGISTRADAS */}
        <View style={styles.bentoBlock}>
          <TouchableOpacity 
            style={styles.accordionHeader} 
            onPress={() => setRulesExpanded(!rulesExpanded)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="list-outline" size={16} color="#FF9800" />
              <Text style={[styles.blockTitle, { color: '#FF9800' }]}>REGLAS REGISTRADAS</Text>
            </View>
            <Ionicons name={rulesExpanded ? "chevron-up" : "chevron-down"} size={16} color="#fff" />
          </TouchableOpacity>

          {rulesExpanded && (
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginTop: 12 }}>
              <View style={styles.table}>
                {/* Cabecera de Tabla */}
                <View style={styles.tableHeader}>
                  <View style={[styles.tableCell, { width: 90 }]}><Text style={styles.tableHeaderText}>Analítica</Text></View>
                  <View style={[styles.tableCell, { width: 80 }]}><Text style={styles.tableHeaderText}>Estado</Text></View>
                  <View style={[styles.tableCell, { width: 100 }]}><Text style={styles.tableHeaderText}>Etiqueta</Text></View>
                  <View style={[styles.tableCell, { width: 90 }]}><Text style={styles.tableHeaderText}>Probabilidad</Text></View>
                  <View style={[styles.tableCell, { width: 100 }]}><Text style={styles.tableHeaderText}>Tag Counter</Text></View>
                </View>

                {/* Filas de Reglas */}
                {parsedRules.length === 0 ? (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No hay analíticas asociadas</Text>
                  </View>
                ) : (
                  parsedRules.map((rule: any, idx: number) => (
                    <View key={idx} style={styles.tableRow}>
                      <View style={[styles.tableCell, { width: 90 }]}><Text style={[styles.tableCellText, { fontWeight: 'bold' }]}>{rule.analytic}</Text></View>
                      <View style={[styles.tableCell, { width: 80 }]}>
                        <Text style={[styles.tableCellText, { color: rule.state === 'true' ? '#00C853' : '#f44336' }]}>
                          {rule.state === 'true' ? 'Activo' : 'Inactivo'}
                        </Text>
                      </View>
                      <View style={[styles.tableCell, { width: 100 }]}><Text style={styles.tableCellText}>{rule.tag}</Text></View>
                      <View style={[styles.tableCell, { width: 90 }]}><Text style={styles.tableCellText}>{rule.prob}</Text></View>
                      <View style={[styles.tableCell, { width: 100 }]}><Text style={styles.tableCellText}>{rule.tag_count}</Text></View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}
        </View>

        {/* 4. SECCIÓN: ACCIONES - ACTIONS REGISTERED (IMAGEN 1 INFERIOR) */}
        <View style={styles.bentoBlock}>
          <TouchableOpacity 
            style={styles.accordionHeader} 
            onPress={() => setActionsExpanded(!actionsExpanded)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="notifications-outline" size={16} color="#d71a18" />
              <Text style={[styles.blockTitle, { color: '#d71a18' }]}>ACCIONES - ACTIONS REGISTERED</Text>
            </View>
            <Ionicons name={actionsExpanded ? "chevron-up" : "chevron-down"} size={16} color="#fff" />
          </TouchableOpacity>

          {actionsExpanded && (
            <View style={{ marginTop: 12, gap: 12 }}>
              {/* Pop up y Notifiable */}
              <View style={styles.switchRow}>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Pop up</Text>
                  <Switch 
                    value={popUpActive} 
                    onValueChange={setPopUpActive} 
                    trackColor={{ false: '#25283D', true: '#2E9BFF30' }}
                    thumbColor={popUpActive ? '#2E9BFF' : '#555'}
                  />
                </View>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Notifiable</Text>
                  <Switch 
                    value={notifiableActive} 
                    onValueChange={setNotifiableActive} 
                    trackColor={{ false: '#25283D', true: '#2E9BFF30' }}
                    thumbColor={notifiableActive ? '#2E9BFF' : '#555'}
                  />
                </View>
              </View>

              {/* Whatsapp y Email */}
              <View style={styles.switchRow}>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Enviar Whatsapp</Text>
                  <Switch 
                    value={whatsappActive} 
                    onValueChange={setWhatsappActive} 
                    trackColor={{ false: '#25283D', true: '#2E9BFF30' }}
                    thumbColor={whatsappActive ? '#2E9BFF' : '#555'}
                  />
                </View>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Enviar Email</Text>
                  <Switch 
                    value={emailActive} 
                    onValueChange={setEmailActive} 
                    trackColor={{ false: '#25283D', true: '#2E9BFF30' }}
                    thumbColor={emailActive ? '#2E9BFF' : '#555'}
                  />
                </View>
              </View>

              {/* Sound y Alerta */}
              <View style={styles.switchRow}>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Sound</Text>
                  <Switch 
                    value={soundActionActive} 
                    onValueChange={setSoundActionActive} 
                    trackColor={{ false: '#25283D', true: '#2E9BFF30' }}
                    thumbColor={soundActionActive ? '#2E9BFF' : '#555'}
                  />
                </View>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Alerta</Text>
                  <Switch 
                    value={alertActive} 
                    onValueChange={setAlertActive} 
                    trackColor={{ false: '#25283D', true: '#2E9BFF30' }}
                    thumbColor={alertActive ? '#2E9BFF' : '#555'}
                  />
                </View>
              </View>

              {/* Require Confirmation */}
              <View style={styles.switchRow}>
                <View style={[styles.switchCol, { flex: 1 }]}>
                  <Text style={styles.switchLabel}>Require confirmation</Text>
                  <Switch 
                    value={confirmationActive} 
                    onValueChange={setConfirmationActive} 
                    trackColor={{ false: '#25283D', true: '#2E9BFF30' }}
                    thumbColor={confirmationActive ? '#2E9BFF' : '#555'}
                  />
                </View>
              </View>

              <View style={styles.divider} />

              {/* Cooldown / Tiempo de alerta */}
              <View style={styles.inputGroup}>
                <Text style={styles.selectorLabel}>TIEMPO DE ALERTA (SEGUNDOS)</Text>
                <TextInput 
                  style={styles.darkInput} 
                  value={timeoutVal} 
                  onChangeText={setTimeoutVal} 
                  keyboardType="numeric" 
                />
              </View>
            </View>
          )}
        </View>


        {/* 6. SECCIÓN: REGIÓN DE INTERÉS (ROI) */}
        <View style={styles.bentoBlock}>
          <View style={styles.blockHeader}>
            <Ionicons name="scan-outline" size={16} color="#ffffff60" />
            <Text style={styles.blockTitle}>REGIÓN DE INTERÉS (ROI)</Text>
          </View>

          {roiId !== null ? (
            <>
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Estado del ROI</Text>
                  <Text style={styles.settingDesc}>Activar o desactivar máscara y polígono de interés.</Text>
                </View>
                <Switch 
                  value={roiActive} 
                  onValueChange={setRoiActive} 
                  trackColor={{ false: '#25283D', true: '#2E9BFF30' }}
                  thumbColor={roiActive ? '#2E9BFF' : '#555'}
                />
              </View>
              
              {pointsList.length > 0 && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.selectorLabel}>COORDENADAS DEL POLÍGONO</Text>
                  <View style={styles.pointsGrid}>
                    {pointsList.map((pt: any, index: number) => (
                      <View key={index} style={styles.pointTag}>
                        <Text style={styles.pointTagText}>
                          P{index + 1}: X: {(pt[0] * 100).toFixed(0)}% | Y: {(pt[1] * 100).toFixed(0)}%
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </>
          ) : (
            <Text style={styles.settingDesc}>No se detectaron polígonos asociados a esta regla.</Text>
          )}
          
          <View style={[styles.roiContainer, (!roiActive || roiId === null) && { opacity: 0.3 }]}>
             <Image 
                source={{ uri: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9' }} 
                style={styles.roiImage} 
             />
             <View style={styles.roiOverlay}>
                <View style={styles.roiTag}>
                   <View style={styles.liveDot} />
                   <Text style={styles.roiTagText}>{alarm?.device?.name || 'Cámara Vinculada'}</Text>
                </View>
             </View>
          </View>
        </View>

        {/* BOTÓN GUARDAR CONFIGURACIÓN */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving} activeOpacity={0.8}>
           {isSaving ? (
             <ActivityIndicator size="small" color="#fff" />
           ) : (
             <>
               <Ionicons name="save-outline" size={18} color="#fff" />
               <Text style={styles.saveBtnText}>GUARDAR CONFIGURACIÓN</Text>
             </>
           )}
        </TouchableOpacity>
      </ScrollView>


    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    height: 64, 
    borderBottomWidth: 1, 
    borderBottomColor: '#ffffff08',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
    backgroundColor: '#000'
  },
  backBtn: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, marginHorizontal: 10 },
  logoBox: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#2E9BFF15', justifyContent: 'center', alignItems: 'center' },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 64 },
  titleSection: { marginTop: 20, marginBottom: 20 },
  mainTitle: { color: '#ffffff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subTitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 4, fontWeight: '500' },

  bentoBlock: { backgroundColor: '#101424', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#ffffff08' },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  blockTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },

  // Estilos de Tablas
  table: { borderWidth: 1, borderColor: '#ffffff10', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1A1C2C', borderBottomWidth: 1, borderBottomColor: '#ffffff10' },
  tableHeaderText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ffffff08', backgroundColor: '#090B14' },
  tableCell: { paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  tableCellText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  statusBadgeCell: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Estilos de los switches estilo Web
  switchRow: { flexDirection: 'row', gap: 12 },
  switchCol: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1C2C', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ffffff08' },
  switchLabel: { color: '#fff', fontSize: 12, fontWeight: '700' },

  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  settingLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  settingDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2, fontWeight: '500' },
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.04)', marginVertical: 14 },

  selectorLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  soundScroll: { marginTop: 10 },
  soundPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  soundPillActive: { backgroundColor: '#2E9BFF18', borderColor: '#2E9BFF40' },
  soundPillInactive: { backgroundColor: '#1A1C2C', borderColor: 'rgba(255,255,255,0.06)' },
  soundText: { fontSize: 11, fontWeight: '700' },
  soundTextActive: { color: '#2E9BFF' },
  soundTextInactive: { color: 'rgba(255,255,255,0.4)' },

  pointsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pointTag: { backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  pointTagText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700' },

  roiContainer: { width: '100%', aspectRatio: 16/9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginTop: 16, borderWidth: 1, borderColor: '#ffffff10' },
  roiImage: { width: '100%', height: '100%', opacity: 0.5 },
  roiOverlay: { ...StyleSheet.absoluteFillObject, padding: 12 },
  roiTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000000cc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', gap: 6, borderWidth: 1, borderColor: '#ffffff10' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F44336' },
  roiTagText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  alarmBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)' },
  alarmBoxActive: { backgroundColor: 'rgba(244, 67, 54, 0.04)', borderWidth: 1, borderColor: 'rgba(244, 67, 54, 0.15)' },
  alarmParams: { marginTop: 14 },
  inputGroup: { gap: 6 },
  darkInput: { backgroundColor: '#1A1C2C', height: 46, borderRadius: 10, paddingHorizontal: 14, color: '#fff', fontSize: 13, fontWeight: '700', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },


  saveBtn: { backgroundColor: '#2E9BFF', height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

});


