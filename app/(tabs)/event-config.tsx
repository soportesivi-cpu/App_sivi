import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  StatusBar,
  PanResponder
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WebView } from 'react-native-webview';
import Svg, { Polygon, Circle } from 'react-native-svg';
import { useAppStore } from '../../services/store';
import { WORKSPACES, PROD_MEDIA_DOMAIN } from '../../constants/config';
import { 
  getWorkspaceAlarmConfigurationDetail, 
  updateWorkspaceAlarmConfiguration, 
  updateWorkspaceAlarmPolygons,
  getDevices
} from '../../services/api';
import { Colors, Layout } from '../../constants/theme';

export default function EventConfigScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { activeDomain: domain, activeWorkspace, impersonatedWorkspace, workspaceSessions, jwtToken: token, isDarkMode } = useAppStore();
  const currentWs = impersonatedWorkspace || activeWorkspace;
  const styles = getStyles(isDarkMode);

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

  // WebRTC Live Player & ROI interactive state
  const [isPlaying, setIsPlaying] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const activePointIndex = useRef<number | null>(null);

  const handleLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setDimensions({ width, height });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (!dimensions.width || !dimensions.height) return;

        let parsedPoints: any[] = [];
        try {
          parsedPoints = typeof roiPoints === 'string' ? JSON.parse(roiPoints) : roiPoints;
        } catch (e) {}

        if (!Array.isArray(parsedPoints) || parsedPoints.length === 0) {
          parsedPoints = [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]];
        }

        let closestIndex = 0;
        let minDistance = Infinity;

        parsedPoints.forEach((pt: any, idx: number) => {
          if (!Array.isArray(pt) || pt.length < 2) return;
          const px = pt[0] * dimensions.width;
          const py = pt[1] * dimensions.height;
          const dx = px - locationX;
          const dy = py - locationY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            minDistance = dist;
            closestIndex = idx;
          }
        });

        if (minDistance < 40) {
          activePointIndex.current = closestIndex;
        } else {
          activePointIndex.current = null;
        }
      },
      onPanResponderMove: (evt) => {
        if (activePointIndex.current === null || !dimensions.width || !dimensions.height) return;
        const { locationX, locationY } = evt.nativeEvent;

        let parsedPoints: any[] = [];
        try {
          parsedPoints = typeof roiPoints === 'string' ? JSON.parse(roiPoints) : roiPoints;
        } catch (e) {}

        if (!Array.isArray(parsedPoints) || parsedPoints.length === 0) return;

        const nx = Math.max(0, Math.min(1, locationX / dimensions.width));
        const ny = Math.max(0, Math.min(1, locationY / dimensions.height));

        const updatedPoints = [...parsedPoints];
        updatedPoints[activePointIndex.current] = [nx, ny];
        
        setRoiPoints(JSON.stringify(updatedPoints));
      },
      onPanResponderRelease: () => {
        activePointIndex.current = null;
      }
    })
  ).current;


  // 1. Obtener el detalle completo de la regla
  const { data: alarm, isLoading: loadingAlarm, error } = useQuery({
    queryKey: ['alarm-detail', domain, currentWs?.id, id],
    queryFn: () => getWorkspaceAlarmConfigurationDetail(String(id)),
    enabled: !!(workspaceSessions && workspaceSessions.length > 0 && id),
  });

  // Obtener todos los dispositivos del workspace para resolver discrepancias de IDs
  const { data: devicesData } = useQuery({
    queryKey: ['workspace-devices', domain, currentWs?.id],
    queryFn: () => getDevices(),
    enabled: !!(workspaceSessions && workspaceSessions.length > 0),
  });

  const activeSession = useMemo(() => {
    const wsId = currentWs?.id || currentWs?.workspace || '';
    const match = workspaceSessions?.find((s: any) => s.workspace?.toLowerCase() === wsId.toLowerCase());
    return match ? [match] : [];
  }, [workspaceSessions, currentWs]);

  const workspaceTokenForStream = useMemo(() => {
    return activeSession[0]?.token || token || '';
  }, [activeSession, token]);

  const cameraDevice = useMemo(() => {
    if (!alarm) return null;
    if (alarm.device) return alarm.device;
    const detailDev = alarm.Detail_device_alarm?.[0];
    if (detailDev) {
      return detailDev.device || detailDev.Device || detailDev;
    }
    return null;
  }, [alarm]);

  const resolvedCamera = useMemo(() => {
    if (!cameraDevice || !devicesData?.rows) return cameraDevice;
    const targetUuid = cameraDevice.deviceId || cameraDevice.device_id || cameraDevice.uuid;
    if (!targetUuid) return cameraDevice;
    
    // Buscar la cámara en la lista completa por su UUID para obtener el ID de base de datos correcto (e.g. 27)
    const match = devicesData.rows.find((d: any) => 
      (d.deviceId || d.device_id || d.uuid || '').toLowerCase() === targetUuid.toLowerCase()
    );
    
    if (match) {
      console.log('[STREAM ROI] Cámara vinculada encontrada en dispositivos:', match);
      return match;
    }
    return cameraDevice;
  }, [cameraDevice, devicesData]);

  function isFrpConnection(): boolean {
    let effectiveDomain = domain;
    if ((currentWs?.id || '').toLowerCase() === 'realclub') {
      const localFrpWs = WORKSPACES.find(w => w.id === 'local-frp');
      effectiveDomain = localFrpWs?.domain || '63.141.255.156:19090';
    }
    const isIpOrLocal = /^\d+\.\d+\.\d+\.\d+/.test(effectiveDomain || '') || effectiveDomain?.includes('localhost') || effectiveDomain?.includes('local.imperium.pe');
    if (!isIpOrLocal || !effectiveDomain) return false;
    const parts = effectiveDomain.split(':');
    const host = parts[0];
    const apiPort = parts[1];
    return host === '63.141.255.156' || host === 'local.imperium.pe' || apiPort === '19090' || apiPort === '29090' || apiPort === '39090';
  }

  function getStreamName(camera: any, isFrp: boolean = false): string {
    const camId = camera?.id;
    const camDevId = camera?.deviceId || camera?.device_id || camera?.uuid;
    
    console.log('[STREAM ROI] getStreamName input:', camera, 'isFrp:', isFrp);
    if (isFrp) {
      if (camId && camDevId) {
        const result = `${camId}-${camDevId}/1`;
        console.log(`[STREAM ROI] getStreamName output FRP: "${result}"`);
        return result;
      }
      const fallback = camDevId || `camara${camId || ''}`;
      console.log(`[STREAM ROI] getStreamName output FRP FALLBACK: "${fallback}"`);
      return fallback;
    }

    // Para entornos no-FRP (nube pura), usamos el mismo formateo que en cameras.tsx
    const camName = camera?.name;
    if (camName && camDevId) {
      const nameParts = camName.split('_');
      const cleanName = nameParts.length > 1 ? nameParts.slice(1).join('_') : camName;
      const result = `${cleanName}-${camDevId}`;
      console.log(`[STREAM ROI] getStreamName output CLOUD: "${result}"`);
      return result;
    }
    const fallback = camDevId || `camara${camId || ''}`;
    console.log(`[STREAM ROI] getStreamName output CLOUD FALLBACK: "${fallback}"`);
    return fallback;
  }

  function getWebRtcUrl(camera: any): string {
    const isFrp = isFrpConnection();
    const streamName = getStreamName(camera, isFrp);
    let effectiveDomain = domain;
    if ((currentWs?.id || '').toLowerCase() === 'realclub') {
      const localFrpWs = WORKSPACES.find(w => w.id === 'local-frp');
      effectiveDomain = localFrpWs?.domain || '63.141.255.156:19090';
    }

    const isIpOrLocal = /^\d+\.\d+\.\d+\.\d+/.test(effectiveDomain || '') || effectiveDomain?.includes('localhost') || effectiveDomain?.includes('local.imperium.pe');
    if (isIpOrLocal && effectiveDomain) {
      const parts = effectiveDomain.split(':');
      const host = parts[0];
      const apiPort = parts[1];

      if (host === '63.141.255.156' || host === 'local.imperium.pe' || apiPort === '19090' || apiPort === '29090' || apiPort === '39090') {
        let whepHtpsPort = '18890';
        if (apiPort === '29090') whepHtpsPort = '28890';
        else if (apiPort === '39090') whepHtpsPort = '38890';
        return `https://local.imperium.pe:${whepHtpsPort}/${streamName}/`;
      }
      return `http://${host}:8889/${streamName}/`;
    }

    // Nube pura: usamos la URL proxy sobre puerto 443 sin el puerto 8889
    return `https://${PROD_MEDIA_DOMAIN}/webrtc/${streamName}/whep`;
  }

  function getWebRtcHtml(camera: any): string {
    const whepUrl = getWebRtcUrl(camera);
    const token = workspaceTokenForStream;
    const authHeader = token ? `headers['Authorization'] = 'Bearer ${token}';` : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
      <style>
        html, body { margin: 0; padding: 0; background: #000; width: 100vw; height: 100vh; overflow: hidden; }
        video { width: 100vw; height: 100vh; object-fit: contain; }
        #err { color: #ff4444; font-family: sans-serif; text-align: center; padding: 20px; display: none; position: absolute; top: 50%; left: 0; right: 0; transform: translateY(-50%); }
      </style>
    </head>
    <body>
      <video id="video" autoplay muted playsinline controls></video>
      <div id="err"></div>
      <script>
        var video = document.getElementById('video');
        var err = document.getElementById('err');

        function post(payload) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        }

        async function startWhep() {
          try {
            var pc = new RTCPeerConnection({
              iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            pc.addTransceiver('video', { direction: 'recvonly' });
            pc.addTransceiver('audio', { direction: 'recvonly' });

            pc.ontrack = function(event) {
              if (event.streams && event.streams[0]) {
                video.srcObject = event.streams[0];
                video.play().catch(function(){});
                post({ type: 'stream_status', protocol: 'webrtc', state: 'connected' });
              }
            };

            var offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            var headers = { 'Content-Type': 'application/sdp' };
            ${authHeader}

            var res = await fetch('${whepUrl}', {
              method: 'POST',
              headers: headers,
              body: offer.sdp
            });

            if (!res.ok) {
              throw new Error('WHEP error: ' + res.status);
            }

            var answerSdp = await res.text();
            await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

          } catch(e) {
            err.style.display = 'block';
            err.innerText = 'WebRTC Error: ' + e.message;
            post({ type: 'stream_status', protocol: 'webrtc', state: 'disconnected' });
          }
        }

        startWhep();
      </script>
    </body>
    </html>
  `;
  }



  // Resetear el estado de reproducción al cambiar de alarma (evita que se quede reproduciendo en caché de navegación)
  useEffect(() => {
    setIsPlaying(false);
  }, [id]);

  // 4. Inicializar controles al cargar datos reales
  useEffect(() => {
    if (alarm) {
      console.log('[DEBUG ALARM DETAIL]:', JSON.stringify(alarm, null, 2));
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
        let pts = roiObj.points ?? "[]";
        if (pts === "[]" || !pts) {
          pts = "[[0.25,0.25],[0.75,0.25],[0.75,0.75],[0.25,0.75]]";
        }
        setRoiPoints(pts);
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
        <ActivityIndicator size="large" color={Colors.brand.primary} />
        <Text style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : '#374151', marginTop: 15, fontSize: 14, fontWeight: '600' }}>
          Cargando configuración de la alarma...
        </Text>
      </View>
    );
  }

  if (error || !alarm) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={56} color="#F44336" />
        <Text style={{ color: isDarkMode ? '#fff' : '#111827', fontSize: 18, fontWeight: '800', marginTop: 15 }}>
          Error al cargar la alarma
        </Text>
        <Text style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : '#6b7280', fontSize: 12, textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
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
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      {/* HEADER PREMIUM */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/events')} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.brand.celeste} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{alarm.name || 'Detalles de Alarma'}</Text>
        <View style={styles.logoBox}>
          <Ionicons name="shield-checkmark" size={18} color={Colors.brand.celeste} />
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
            <Ionicons name="create-outline" size={20} color={Colors.brand.primary} />
            <Text style={styles.blockTitle}>DATOS GENERALES</Text>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.selectorLabel}>NOMBRE</Text>
            <TextInput 
              style={[styles.darkInput, { opacity: 0.7 }]} 
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
              trackColor={{ false: isDarkMode ? '#25283D' : '#E5E7EB', true: Colors.brand.primary + '30' }}
              thumbColor={eventActive ? Colors.brand.primary : (isDarkMode ? '#555' : '#D1D5DB')}
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
              <Ionicons name="list-outline" size={20} color={Colors.brand.primary} />
              <Text style={styles.blockTitle}>REGLAS REGISTRADAS</Text>
            </View>
            <Ionicons name={rulesExpanded ? "chevron-up" : "chevron-down"} size={16} color={isDarkMode ? '#fff' : '#111827'} />
          </TouchableOpacity>

          {rulesExpanded && (
            parsedRules.length === 0 ? (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No hay analíticas asociadas</Text>
              </View>
            ) : (
              <View style={{ marginTop: 12, gap: 10 }}>
                {parsedRules.map((rule: any, idx: number) => (
                  <View key={idx} style={styles.reportCard}>
                    {/* Fila superior: Analítica y Estado */}
                    <View style={styles.reportCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="analytics-outline" size={14} color={Colors.brand.primary} />
                        <Text style={styles.reportAnalyticText}>{rule.analytic.toUpperCase()}</Text>
                      </View>
                      <View style={[styles.reportStatusBadge, { backgroundColor: rule.state === 'true' ? '#00C85315' : '#f4433615' }]}>
                        <View style={[styles.reportStatusDot, { backgroundColor: rule.state === 'true' ? '#00C853' : '#f44336' }]} />
                        <Text style={[styles.reportStatusText, { color: rule.state === 'true' ? '#00C853' : '#f44336' }]}>
                          {rule.state === 'true' ? 'Activo' : 'Inactivo'}
                        </Text>
                      </View>
                    </View>

                    {/* Detalles */}
                    <View style={styles.reportDetailsRow}>
                      <View style={styles.reportDetailItem}>
                        <Text style={styles.reportDetailLabel}>ETIQUETA</Text>
                        <Text style={styles.reportDetailValue}>{rule.tag}</Text>
                      </View>
                      <View style={styles.reportDetailItem}>
                        <Text style={styles.reportDetailLabel}>PROBABILIDAD</Text>
                        <Text style={styles.reportDetailValue}>{rule.prob}</Text>
                      </View>
                      <View style={styles.reportDetailItem}>
                        <Text style={styles.reportDetailLabel}>TAG COUNTER</Text>
                        <Text style={styles.reportDetailValue}>{rule.tag_count}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )
          )}
        </View>

        {/* 4. SECCIÓN: ACCIONES REGISTRADAS */}
        <View style={styles.bentoBlock}>
          <TouchableOpacity 
            style={styles.accordionHeader} 
            onPress={() => setActionsExpanded(!actionsExpanded)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="notifications-outline" size={20} color={Colors.brand.primary} />
              <Text style={styles.blockTitle}>ACCIONES REGISTRADAS</Text>
            </View>
            <Ionicons name={actionsExpanded ? "chevron-up" : "chevron-down"} size={16} color={isDarkMode ? '#fff' : '#111827'} />
          </TouchableOpacity>

          {actionsExpanded && (
            <View style={{ marginTop: 12, gap: 8 }}>
              {/* Pop up y Notifiable */}
              <View style={styles.switchRow}>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Pop up</Text>
                  <Switch 
                    value={popUpActive} 
                    onValueChange={setPopUpActive} 
                    trackColor={{ false: isDarkMode ? '#25283D' : '#E5E7EB', true: Colors.brand.primary + '30' }}
                    thumbColor={popUpActive ? Colors.brand.primary : (isDarkMode ? '#555' : '#D1D5DB')}
                  />
                </View>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Notifiable</Text>
                  <Switch 
                    value={notifiableActive} 
                    onValueChange={setNotifiableActive} 
                    trackColor={{ false: isDarkMode ? '#25283D' : '#E5E7EB', true: Colors.brand.primary + '30' }}
                    thumbColor={notifiableActive ? Colors.brand.primary : (isDarkMode ? '#555' : '#D1D5DB')}
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
                    trackColor={{ false: isDarkMode ? '#25283D' : '#E5E7EB', true: Colors.brand.primary + '30' }}
                    thumbColor={whatsappActive ? Colors.brand.primary : (isDarkMode ? '#555' : '#D1D5DB')}
                  />
                </View>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Enviar Email</Text>
                  <Switch 
                    value={emailActive} 
                    onValueChange={setEmailActive} 
                    trackColor={{ false: isDarkMode ? '#25283D' : '#E5E7EB', true: Colors.brand.primary + '30' }}
                    thumbColor={emailActive ? Colors.brand.primary : (isDarkMode ? '#555' : '#D1D5DB')}
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
                    trackColor={{ false: isDarkMode ? '#25283D' : '#E5E7EB', true: Colors.brand.primary + '30' }}
                    thumbColor={soundActionActive ? Colors.brand.primary : (isDarkMode ? '#555' : '#D1D5DB')}
                  />
                </View>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Alerta</Text>
                  <Switch 
                    value={alertActive} 
                    onValueChange={setAlertActive} 
                    trackColor={{ false: isDarkMode ? '#25283D' : '#E5E7EB', true: Colors.brand.primary + '30' }}
                    thumbColor={alertActive ? Colors.brand.primary : (isDarkMode ? '#555' : '#D1D5DB')}
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
                    trackColor={{ false: isDarkMode ? '#25283D' : '#E5E7EB', true: Colors.brand.primary + '30' }}
                    thumbColor={confirmationActive ? Colors.brand.primary : (isDarkMode ? '#555' : '#D1D5DB')}
                  />
                </View>
              </View>

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
            <Ionicons name="scan-outline" size={20} color={Colors.brand.primary} />
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
                  trackColor={{ false: isDarkMode ? '#25283D' : '#E5E7EB', true: Colors.brand.primary + '30' }}
                  thumbColor={roiActive ? Colors.brand.primary : (isDarkMode ? '#555' : '#D1D5DB')}
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
          
          <View 
            style={[styles.roiContainer, (!roiActive || roiId === null) && { opacity: 0.3 }]}
            onLayout={handleLayout}
          >
             {/* 1. Fondo (Video o Imagen Estática) */}
             {isPlaying && resolvedCamera ? (
               <WebView
                 source={{ html: getWebRtcHtml(resolvedCamera) }}
                 allowsInlineMediaPlayback={true}
                 mediaPlaybackRequiresUserAction={false}
                 domStorageEnabled={true}
                 javaScriptEnabled={true}
                 mixedContentMode="always"
                 originWhitelist={['*']}
                 style={styles.roiVideo}
               />
             ) : (
               <TouchableOpacity 
                 style={StyleSheet.absoluteFillObject} 
                 onPress={() => setIsPlaying(true)}
                 activeOpacity={0.9}
               >
                 <Image 
                    source={{ uri: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600&q=80' }} 
                    style={styles.roiImage} 
                 />
                 <View style={styles.playOverlayBtn}>
                   <Ionicons name="play-circle" size={48} color={Colors.brand.primary} />
                   <Text style={styles.playBtnText}>INICIAR VIDEO EN VIVO</Text>
                 </View>
               </TouchableOpacity>
             )}

             {/* 2. Capa de Gestos SVG para Manipular Polígonos (Siempre visible si el ROI está activo) */}
             {roiActive && roiId !== null && pointsList.length > 0 && dimensions.width > 0 && (
               <View style={StyleSheet.absoluteFillObject} {...panResponder.panHandlers}>
                 <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
                   <Polygon
                     points={pointsList.map((pt: any) => `${pt[0] * dimensions.width},${pt[1] * dimensions.height}`).join(' ')}
                     fill="rgba(46, 155, 255, 0.25)"
                     stroke={Colors.brand.primary}
                     strokeWidth="3"
                   />
                   {pointsList.map((pt: any, index: number) => (
                     <Circle
                       key={index}
                       cx={pt[0] * dimensions.width}
                       cy={pt[1] * dimensions.height}
                       r="12"
                       fill={Colors.brand.primary}
                       stroke="#ffffff"
                       strokeWidth="2.5"
                     />
                   ))}
                 </Svg>
               </View>
             )}

             {/* 3. Superposición de Control (Tag de cámara e ícono Play/Pause) */}
             <View style={styles.roiOverlay} pointerEvents="box-none">
                <View style={styles.roiTag}>
                   <View style={[styles.liveDot, isPlaying && { backgroundColor: '#00C853' }]} />
                   <Text style={styles.roiTagText}>{resolvedCamera?.name || 'Cámara Vinculada'}</Text>
                </View>
                
                {/* Botón flotante para iniciar/detener streaming */}
                {resolvedCamera && (
                  <TouchableOpacity 
                    style={styles.pauseBtn}
                    onPress={() => setIsPlaying(!isPlaying)}
                    activeOpacity={0.8}
                  >
                    <Ionicons 
                      name={isPlaying ? "pause-circle" : "play-circle"} 
                      size={24} 
                      color={isPlaying ? "#ffffffaa" : Colors.brand.primary} 
                    />
                  </TouchableOpacity>
                )}
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

const getStyles = (isDark: boolean) => {
  const themeColors = isDark ? Colors.dark : Colors.light;
  const bgMain = themeColors.background;
  const bgCard = themeColors.surface;
  const textPrimary = themeColors.text;
  const textSecondary = themeColors.textSecondary;
  const textMuted = themeColors.textMuted;
  const borderCol = themeColors.border;
  const bgCardSecondary = themeColors.surfaceSecondary;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: bgMain },
    header: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      paddingHorizontal: 16, 
      height: 64, 
      borderBottomWidth: 1, 
      borderBottomColor: borderCol,
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
      backgroundColor: bgMain
    },
    backBtn: { padding: 8 },
    headerTitle: { color: textPrimary, fontSize: 16, fontWeight: '700', flex: 1, marginHorizontal: 10 },
    logoBox: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#2E9BFF15', justifyContent: 'center', alignItems: 'center' },

    scrollContent: { paddingHorizontal: 16, paddingBottom: 64 },
    titleSection: { marginTop: 20, marginBottom: 20 },
    mainTitle: { color: textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    subTitle: { color: textSecondary, fontSize: 13, marginTop: 4, fontWeight: '500' },

    bentoBlock: { backgroundColor: bgCard, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: borderCol },
    blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    blockTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: textPrimary },

    accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },

    // Estilos de Reporte de Reglas
    reportCard: {
      backgroundColor: bgCardSecondary,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: borderCol,
    },
    reportCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: borderCol,
      paddingBottom: 8,
      marginBottom: 8,
    },
    reportAnalyticText: {
      color: textPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    reportStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 6,
      gap: 4,
    },
    reportStatusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    reportStatusText: {
      fontSize: 10,
      fontWeight: '700',
    },
    reportDetailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    reportDetailItem: {
      flex: 1,
    },
    reportDetailLabel: {
      color: textMuted,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    reportDetailValue: {
      color: textPrimary,
      fontSize: 11,
      fontWeight: '700',
    },

    // Estilos de Tablas
    table: { borderWidth: 1, borderColor: borderCol, borderRadius: 8, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: bgCardSecondary, borderBottomWidth: 1, borderBottomColor: borderCol },
    tableHeaderText: { color: textSecondary, fontSize: 11, fontWeight: '800' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: borderCol, backgroundColor: bgCard },
    tableCell: { paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
    tableCellText: { color: textPrimary, fontSize: 11, fontWeight: '600' },
    statusBadgeCell: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

    // Estilos de los switches estilo Web
    switchRow: { flexDirection: 'row', gap: 8 },
    switchCol: { 
      flex: 1, 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      backgroundColor: themeColors.inputBg, 
      paddingVertical: 8, 
      paddingHorizontal: 12, 
      borderRadius: Layout.borderRadius.input, 
      borderWidth: 1, 
      borderColor: themeColors.inputBorder 
    },
    switchLabel: { color: textPrimary, fontSize: 12, fontWeight: '700' },

    settingRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    settingLabel: { color: textPrimary, fontSize: 14, fontWeight: '700' },
    settingDesc: { color: textSecondary, fontSize: 11, marginTop: 2, fontWeight: '500' },
    divider: { height: 1, backgroundColor: borderCol, marginVertical: 14 },

    selectorLabel: { color: textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
    soundScroll: { marginTop: 10 },
    soundPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
    soundPillActive: { backgroundColor: Colors.brand.primary + '18', borderColor: Colors.brand.primary + '40' },
    soundPillInactive: { backgroundColor: bgCardSecondary, borderColor: borderCol },
    soundText: { fontSize: 11, fontWeight: '700' },
    soundTextActive: { color: Colors.brand.primary },
    soundTextInactive: { color: textMuted },

    pointsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    pointTag: { backgroundColor: bgCardSecondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: borderCol },
    pointTagText: { color: textSecondary, fontSize: 10, fontWeight: '700' },

    roiContainer: { width: '100%', aspectRatio: 16/9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginTop: 16, borderWidth: 1, borderColor: borderCol },
    roiImage: { width: '100%', height: '100%', opacity: 0.25 },
    roiOverlay: { ...StyleSheet.absoluteFillObject, padding: 12 },
    roiTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#000000cc' : '#ffffffcc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', gap: 6, borderWidth: 1, borderColor: borderCol },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F44336' },
    roiTagText: { color: textPrimary, fontSize: 10, fontWeight: '700' },
    roiVideo: { width: '100%', height: '100%', backgroundColor: '#000' },
    playOverlayBtn: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', gap: 8 },
    playBtnText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    pauseBtn: { position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },

    alarmBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, backgroundColor: bgCardSecondary },
    alarmBoxActive: { backgroundColor: 'rgba(244, 67, 54, 0.04)', borderWidth: 1, borderColor: 'rgba(244, 67, 54, 0.15)' },
    alarmParams: { marginTop: 14 },
    inputGroup: { gap: 6 },
    darkInput: { 
      backgroundColor: themeColors.inputBg, 
      height: Layout.height.input, 
      borderRadius: Layout.borderRadius.input, 
      paddingHorizontal: 14, 
      color: textPrimary, 
      fontSize: 13, 
      fontWeight: '700', 
      borderWidth: 1, 
      borderColor: themeColors.inputBorder 
    },
    timeRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
    timeInputBox: { flex: 1, gap: 6 },

    saveBtn: { backgroundColor: Colors.brand.primary, height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8, alignSelf: 'center', paddingHorizontal: 24 },
    saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  });
};


