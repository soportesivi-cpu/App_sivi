import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ImageBackground,
  Image,
  Modal,
  ScrollView,
  TextInput,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Alert as RNAlert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useAppStore } from '../../services/store';
import { getWorkspacesEvents, classifyWorkspacesEvent, getMediaUrl, parseUTCDate, addIncidentDescription, getTrueAlertName, getWorkspacesDevices } from '../../services/api';
import { wsService } from '../../services/websocket';
import Loading from '../../components/Loading';
import { playNotificationSound } from '../../services/sound';
import { useLocalSearchParams, router } from 'expo-router';

type Alert = {
  id: number;
  probability: string | number;
  createdAt: string;
  device?: { name: string; deviceId?: string };
  deviceId?: string;
  tag?: string;
  motive_categorie?: string;
  url_evidence?: string;
  face_detected_url?: string;
  is_confirmed?: boolean | null;
  is_fp?: boolean | null;
  is_ignored?: boolean | null;
  state?: string;
  vinfo?: string;
  name_categorie?: string;
  incidentId?: number;
  incidentName?: string;
  sentDescriptions?: Array<{ id: number | string; username: string; description: string; timestamp: string }>;
};

type AlertCardItemProps = {
  item: Alert;
  viewMode: 'grid' | 'list';
  onPress: (alert: Alert) => void;
  domain: string | null;
  formatHora: (fecha: string) => string;
  getAnalyticTheme: (tag: string) => { color: string; icon: string; label: string };
  isDarkMode: boolean;
  styles: any;
};

// Registry to track alert cards that have already run their neon highlight animation
const alreadyBlinkedAlerts = new Set<number>();

function AlertCardItem({
  item,
  viewMode,
  onPress,
  domain,
  formatHora,
  getAnalyticTheme,
  isDarkMode,
  styles
}: AlertCardItemProps) {
  const [isNew, setIsNew] = useState(false);
  const blinkAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // If this alert has already run its blink animation during this app session, skip it
    if (alreadyBlinkedAlerts.has(item.id)) {
      setIsNew(false);
      return;
    }

    let animation: Animated.CompositeAnimation | null = null;
    const alertTime = parseUTCDate(item.createdAt).getTime();
    const systemTime = new Date().getTime();
    const diffSeconds = (systemTime - alertTime) / 1000;

    const isWithin30s = diffSeconds >= 0 && diffSeconds < 30;

    if (isWithin30s) {
      setIsNew(true);
      alreadyBlinkedAlerts.add(item.id);

      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          })
        ])
      );
      animation.start();

      const timer = setTimeout(() => {
        setIsNew(false);
        if (animation) animation.stop();
      }, 10000);

      return () => {
        clearTimeout(timer);
        if (animation) animation.stop();
      };
    } else {
      setIsNew(false);
    }
  }, [item.createdAt, item.id]);

  const alarmName = useMemo(() => {
    if (item.vinfo) {
      try {
        const vinfoObj = typeof item.vinfo === 'string' ? JSON.parse(item.vinfo) : item.vinfo;
        const name = vinfoObj?.name || vinfoObj?.alarm_name || vinfoObj?.alarmName;
        if (name && name.trim()) return name.trim();
      } catch (e) {
        // ignore
      }
    }
    return item.motive_categorie || item.tag || 'Detección General';
  }, [item.vinfo, item.motive_categorie, item.tag]);

  const typeTag = item.motive_categorie || item.tag || 'Detección General';
  const theme = getAnalyticTheme(typeTag);

  const probNum = Number(item.probability) || 0;
  const prob = probNum > 1 ? probNum : probNum * 100;

  const isResolved = item.is_confirmed === true || item.is_fp === true || item.is_ignored === true || item.state === 'resolved' || item.state === 'ignored';

  const getEvidenceUrl = (alertItem: Alert) => {
    return getMediaUrl(alertItem.url_evidence, domain);
  };

  if (viewMode === 'grid') {
    return (
      <TouchableOpacity
        style={[
          styles.gridCard,
          isNew && { borderColor: '#ff0055', borderWidth: 1 }
        ]}
        activeOpacity={0.8}
        onPress={() => onPress(item)}
      >
        <View style={styles.gridCardHeader}>
          <Ionicons name="videocam" size={12} color="#2E9BFF" style={{ marginRight: 2 }} />
          <Text style={styles.gridCardCamName} numberOfLines={1}>
            {item.device?.name || 'Cámara'}
          </Text>
        </View>

        <Image
          source={{ uri: getEvidenceUrl(item) || 'https://images.unsplash.com/photo-1557597774-9d273605dfa9' }}
          style={styles.gridCardImage}
          resizeMode="cover"
        />

        <View style={styles.gridCardFooter}>
          <Text style={styles.gridCardTitle} numberOfLines={1}>
            {alarmName}
          </Text>
          <View style={styles.gridCardLabelRow}>
            <Text style={styles.gridCardLabel}>PROB.</Text>
            <Text style={styles.gridCardLabel}>HORA</Text>
          </View>
          <View style={styles.gridCardValueRow}>
            <Text style={styles.gridCardProbValue}>{prob.toFixed(0)}%</Text>
            <Text style={styles.gridCardTimeValue}>{formatHora(item.createdAt)}</Text>
          </View>
        </View>

        {isNew && (
          <Animated.View style={[
            styles.neonBorder,
            {
              opacity: blinkAnim,
              borderRadius: 14
            }
          ]} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderColor: isNew ? '#ff0055' : theme.color + '40' },
        isNew && { borderWidth: 1.5 }
      ]}
      activeOpacity={0.8}
      onPress={() => onPress(item)}
    >
      <ImageBackground
        source={{ uri: getEvidenceUrl(item) || 'https://images.unsplash.com/photo-1557597774-9d273605dfa9' }}
        style={styles.cardImage}
        imageStyle={{ opacity: 0.8 }}
      >
        <View style={styles.cardOverlayTop}>
          <View style={[styles.badge, { backgroundColor: isResolved ? (item.is_confirmed === true ? '#4caf50' : item.is_fp === true ? '#ff9800' : '#ffffff60') : '#2196f3' }]}>
            <Text style={styles.badgeText}>
              {isResolved ? (item.is_confirmed === true ? 'CONFIRMADA' : item.is_fp === true ? 'FALSO POS.' : 'IGNORADA') : 'PENDIENTE'}
            </Text>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.cardFooter}>
        <View style={styles.footerRow}>
          <View style={styles.footerInfo}>
            <Text style={[styles.cardTipo, { color: theme.color }]}>
              <Ionicons name={theme.icon as any} size={14} /> {alarmName.toUpperCase()}
            </Text>
            <Text style={styles.cardCam} numberOfLines={1}>
              {item.device?.name || item.deviceId || 'Cámara no especificada'}
            </Text>
          </View>
          <View style={styles.footerMetrics}>
            <Text style={styles.cardHora}>{formatHora(item.createdAt)}</Text>
            <Text style={styles.cardProb}>{prob.toFixed(0)}%</Text>
          </View>
        </View>
      </View>

      {isNew && (
        <Animated.View style={[
          styles.neonBorder,
          {
            opacity: blinkAnim,
            borderRadius: 16
          }
        ]} />
      )}
    </TouchableOpacity>
  );
}

export default function AlertsScreen() {
  const { activeDomain: domain, isDarkMode, userData, workspaceSessions, activeWorkspace, impersonatedWorkspace } = useAppStore();
  const { alertId, createdAt } = useLocalSearchParams<{ alertId?: string; createdAt?: string }>();
  const currentWs = impersonatedWorkspace || activeWorkspace;

  const activeSession = useMemo(() => {
    const wsId = currentWs?.id || currentWs?.workspace || '';
    const match = workspaceSessions?.find((s: any) => s.workspace?.toLowerCase() === wsId.toLowerCase());
    return match ? [match] : [];
  }, [workspaceSessions, currentWs]);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [loadingSingleAlert, setLoadingSingleAlert] = useState(false);
  const devicesMapRef = useRef<Record<string, string>>({});

  // States for Incident Minuta Note
  const [noteText, setNoteText] = useState('');
  const [sendingNote, setSendingNote] = useState(false);

  // UI Layout and Filtering States
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isZoomVisible, setIsZoomVisible] = useState(false);

  // States for Real-Time Popup
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);

  const [realTimePopupAlert, setRealTimePopupAlert] = useState<Alert | null>(null);
  const popupAnim = useRef(new Animated.Value(-300)).current;
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dismissRealTimePopup = useCallback(() => {
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = null;
    }
    Animated.timing(popupAnim, {
      toValue: -300,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      setRealTimePopupAlert(null);
    });
  }, [popupAnim]);

  const triggerRealTimePopup = useCallback((alertItem: Alert) => {
    playNotificationSound().catch(() => { });

    setRealTimePopupAlert(alertItem);

    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }

    popupAnim.setValue(-300);
    Animated.spring(popupAnim, {
      toValue: Platform.OS === 'ios' ? 60 : 40,
      useNativeDriver: true,
      friction: 8,
      tension: 45,
    }).start();

    popupTimeoutRef.current = setTimeout(() => {
      dismissRealTimePopup();
    }, 10000);
  }, [popupAnim, dismissRealTimePopup]);

  useEffect(() => {
    isFocusedRef.current = isFocused;
    if (!isFocused) {
      dismissRealTimePopup();
    }
  }, [isFocused, dismissRealTimePopup]);

  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    wsService.disconnect();
    conectarWebSocket();
    return () => wsService.disconnect();
  }, [domain, activeSession]);

  useEffect(() => {
    cargarAlertas(1, false);
  }, [activeSession, domain]);

  useEffect(() => {
    if (!alertId) return;

    const targetId = Number(alertId);
    const matchedAlert = alerts.find(a => Number(a.id) === targetId);

    if (matchedAlert) {
      setSelectedAlert(matchedAlert);
      router.setParams({ alertId: undefined, createdAt: undefined });
    } else {
      // Si la alerta no está en la memoria inicial, la buscamos directamente en el backend
      // usando un micro-rango de tiempo de 20 segundos alrededor de su fecha de creación.
      buscarYAbrirAlertaIndividual(targetId, createdAt);
    }
  }, [alertId, alerts, createdAt]);

  async function buscarYAbrirAlertaIndividual(targetId: number, targetCreatedAt?: string) {
    if (activeSession.length === 0) return;
    setLoadingSingleAlert(true);
    try {
      // Determinamos el micro-rango de fecha de 20 segundos (10s antes y 10s después de la alerta)
      let fromDate: Date;
      let toDate: Date;

      if (targetCreatedAt) {
        const alertTime = new Date(targetCreatedAt);
        fromDate = new Date(alertTime.getTime() - 10 * 1000);
        toDate = new Date(alertTime.getTime() + 10 * 1000);
      } else {
        // Fallback defensivo si no viene la fecha: últimas 24h
        toDate = new Date();
        fromDate = new Date(toDate.getTime() - 24 * 60 * 60 * 1000);
      }

      const formatLimaISO = (d: Date) => {
        const options = {
          timeZone: 'America/Lima',
          year: 'numeric' as const, month: '2-digit' as const, day: '2-digit' as const,
          hour: '2-digit' as const, minute: '2-digit' as const, second: '2-digit' as const,
          hour12: false
        };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(d);
        const getVal = (type: string) => parts.find(p => p.type === type)?.value || '';
        return `${getVal('year')}-${getVal('month')}-${getVal('day')}T${getVal('hour')}:${getVal('minute')}:${getVal('second')}-05:00`;
      };

      const [alertsData, smartEventsData] = await Promise.all([
        getWorkspacesEvents({
          sessions: activeSession,
          eventType: 'alert',
          from: formatLimaISO(fromDate),
          to: formatLimaISO(toDate),
          timezone: 'America/Lima',
          page: 1,
          limit: 10
        }).catch(() => null),
        getWorkspacesEvents({
          sessions: activeSession,
          eventType: 'smart_event',
          from: formatLimaISO(fromDate),
          to: formatLimaISO(toDate),
          timezone: 'America/Lima',
          page: 1,
          limit: 10
        }).catch(() => null)
      ]);

      const rawRows = [
        ...(alertsData?.rows || []),
        ...(smartEventsData?.rows || [])
      ];

      const mappedRows = rawRows.map((alert: any) => {
        const devId = alert.device_id || alert.deviceId || alert.device?.id || alert.device?.deviceId;
        let matchedName = '';
        if (devId && devicesMapRef.current[String(devId)]) matchedName = devicesMapRef.current[String(devId)];
        if (!matchedName && alert.device?.name && alert.device.name !== 'Cámara' && alert.device.name !== 'Cámara Principal') {
          matchedName = alert.device.name;
        }
        if (!matchedName) {
          if (alert.motive_categorie && alert.motive_categorie !== 'Alert' && alert.motive_categorie.includes('_')) matchedName = alert.motive_categorie;
          else if (alert.title && alert.title !== 'Alert' && alert.title.includes('_')) matchedName = alert.title;
        }

        const normalizedMotive = alert.motive_categorie || alert.motive || alert.title || alert.label || alert.name || getTrueAlertName(alert.tag || 'alert');

        return {
          ...alert,
          motive_categorie: normalizedMotive,
          device: { ...alert.device, name: matchedName || 'Cámara' }
        };
      });

      // Deduplicamos los resultados por ID
      const uniqueRowsMap = new Map<number, any>();
      mappedRows.forEach(item => {
        if (item && item.id) {
          uniqueRowsMap.set(Number(item.id), item);
        }
      });

      const matchedAlert = uniqueRowsMap.get(targetId);
      if (matchedAlert) {
        setSelectedAlert(matchedAlert);
      } else {
        console.log(`[ALERTA INDIVIDUAL] ⚠️ No se encontró la alerta ID ${targetId} en el micro-rango de 20s.`);
        RNAlert.alert('Alerta no encontrada', 'La alerta seleccionada no pudo ser localizada en el registro de las últimas 24 horas.');
      }
      router.setParams({ alertId: undefined, createdAt: undefined });
    } catch (err) {
      console.log('Error buscando alerta individual:', err);
    } finally {
      setLoadingSingleAlert(false);
    }
  }

  function cargarMasAlertas() {
    if (loading || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    cargarAlertas(nextPage, true);
  }

  async function cargarAlertas(pageToLoad = 1, isNextPage = false) {
    if (pageToLoad === 1) {
      setLoading(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }
    try {
      // 1. Mapa de dispositivos — siempre via gateway
      let devicesMap: Record<string, string> = {};
      try {
        const devsData = await getWorkspacesDevices(activeSession);
        const devsList = devsData?.workspaces?.[0]?.devices || [];
        devsList.forEach((d: any) => {
          const idStr = String(d.id);
          const devIdStr = d.deviceId ? String(d.deviceId) : '';
          if (d.name) {
            devicesMap[idStr] = d.name;
            if (devIdStr) devicesMap[devIdStr] = d.name;
          }
        });
        devicesMapRef.current = devicesMap;
      } catch (err) {
        console.log('Error construyendo mapa de dispositivos:', err);
      }

      // 2. Alertas — siempre via gateway
      if (activeSession.length === 0) {
        setAlerts([]);
        return;
      }

      const toDate = new Date();
      const fromDate = new Date(toDate.getTime() - 24 * 60 * 60 * 1000);

      const formatLimaISO = (d: Date) => {
        const options = {
          timeZone: 'America/Lima',
          year: 'numeric' as const, month: '2-digit' as const, day: '2-digit' as const,
          hour: '2-digit' as const, minute: '2-digit' as const, second: '2-digit' as const,
          hour12: false
        };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(d);
        const getVal = (type: string) => parts.find(p => p.type === type)?.value || '';
        return `${getVal('year')}-${getVal('month')}-${getVal('day')}T${getVal('hour')}:${getVal('minute')}:${getVal('second')}-05:00`;
      };

      const limitPerPage = 30;
      const data = await getWorkspacesEvents({
        sessions: activeSession,
        eventType: 'alert',
        from: formatLimaISO(fromDate),
        to: formatLimaISO(toDate),
        timezone: 'America/Lima',
        page: pageToLoad,
        limit: limitPerPage
      });

      // 3. Cruzar con mapa de dispositivos
      const rawRows = data?.rows || [];
      const mappedRows = rawRows.map((alert: any) => {
        const devId = alert.device_id || alert.deviceId || alert.device?.id || alert.device?.deviceId;
        let matchedName = '';
        if (devId && devicesMap[String(devId)]) matchedName = devicesMap[String(devId)];
        if (!matchedName && alert.device?.name && alert.device.name !== 'Cámara' && alert.device.name !== 'Cámara Principal') {
          matchedName = alert.device.name;
        }
        if (!matchedName) {
          if (alert.motive_categorie && alert.motive_categorie !== 'Alert' && alert.motive_categorie.includes('_')) matchedName = alert.motive_categorie;
          else if (alert.title && alert.title !== 'Alert' && alert.title.includes('_')) matchedName = alert.title;
        }

        // INTERVENCIÓN QUIRÚRGICA: Normaliza el nombre de la alerta igual que en el WebSocket
        const normalizedMotive = alert.motive_categorie || alert.motive || alert.title || alert.label || alert.name || getTrueAlertName(alert.tag || 'alert');

        return {
          ...alert,
          motive_categorie: normalizedMotive, // Asegura que siempre viaje un nombre válido
          device: { ...alert.device, name: matchedName || 'Cámara' }
        };
      });

      if (isNextPage) {
        setAlerts(prev => {
          const merged = [...prev, ...mappedRows];
          if (merged.length >= 150) {
            setHasMore(false);
            return merged.slice(0, 150);
          }
          return merged;
        });
      } else {
        setAlerts(mappedRows);
        setPage(1);
        if (mappedRows.length < limitPerPage || mappedRows.length >= 150) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      }
    } catch (e) {
      console.log('Error alertas:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function conectarWebSocket() {
    wsService.connect();
    const unsubscribe = wsService.subscribe((payload: any) => {
      const channel = payload?.channel;
      const IGNORED_CHANNELS = ['alarm_stats', 'alarm_throughput', 'statistics', 'data', 'states_workspace', 'states_camera', 'heartbeat', 'ping', 'pong', 'status'];
      if (channel && IGNORED_CHANNELS.includes(channel)) {
        return;
      }

      let rawPayload = payload?.data || payload;
      if (!rawPayload) return;

      if (rawPayload.data && Array.isArray(rawPayload.data)) {
        rawPayload = rawPayload.data;
      } else if (rawPayload.data && typeof rawPayload.data === 'object') {
        rawPayload = rawPayload.data;
      }

      let alertsArray = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
      if (alertsArray.length === 0) return;

      const newAlerts: Alert[] = [];

      alertsArray.forEach(rawData => {
        // Only process events that have an associated alarm configuration/rule (Smart Events)
        const hasRule = !!(rawData.ruleId || rawData.rule_id || rawData.vinfo);
        if (!hasRule) {
          return;
        }

        const id = rawData.id ?? Math.floor(Math.random() * 1000000);

        const tag = rawData.tag || (channel === 'event_motion' ? 'motion' : channel) || 'alert';

        const rawDev = rawData.device || rawData.Device || rawData.camera || rawData.Camera;
        const devId = rawData.device_id || rawData.deviceId || rawDev?.id || rawDev?.deviceId;
        let possibleName = 'Cámara';
        if (devId && devicesMapRef.current[String(devId)]) {
          possibleName = devicesMapRef.current[String(devId)];
        }




        let motive_categorie = rawData.motive_categorie || rawData.motive || rawData.title || rawData.label || rawData.name || undefined;

        if (possibleName !== 'Cámara') {
          // Ya mapeado exitosamente
        } else if (rawData.device_name) possibleName = rawData.device_name;
        else if (rawData.deviceName) possibleName = rawData.deviceName;
        else if (rawData.camera_name) possibleName = rawData.camera_name;
        else if (rawData.cameraName) possibleName = rawData.cameraName;
        else if (rawData.camera) possibleName = rawData.camera;
        else if (rawDev && typeof rawDev === 'object' && rawDev.name && rawDev.name !== 'Cámara' && rawDev.name !== 'Cámara Principal') {
          possibleName = rawDev.name;
        } else if (rawDev && typeof rawDev === 'string' && rawDev !== 'Cámara' && rawDev !== 'Cámara Principal') {
          possibleName = rawDev;
        } else if (motive_categorie && motive_categorie !== 'Alert' && motive_categorie.includes('_')) {
          possibleName = motive_categorie;
          motive_categorie = getTrueAlertName(tag);
        } else if (rawData.title && rawData.title !== 'Alert' && rawData.title.includes('_')) {
          possibleName = rawData.title;
          motive_categorie = getTrueAlertName(tag);
        }

        const device = rawDev && typeof rawDev === 'object' ? { ...rawDev, name: possibleName } : { name: possibleName };



        let face_detected_url = undefined;
        if (typeof rawData.face_detected_url === 'string') {
          face_detected_url = rawData.face_detected_url;
        }

        let fc = rawData.facecropping;
        if (typeof fc === 'string' && fc.trim().startsWith('[')) {
          try { fc = JSON.parse(fc); } catch (e) { }
        }
        if (Array.isArray(fc) && fc.length > 0) {
          const first = fc[0];
          if (first) face_detected_url = first.url || first.path || face_detected_url;
        } else if (typeof fc === 'string' && fc.trim() !== '') {
          face_detected_url = fc;
        }

        let url_evidence = rawData.url_evidence || rawData.image_url || rawData.image || rawData.url_photo || rawData.url_photo_event || rawData.thumbnail_url || rawData.img || undefined;
        if (!url_evidence && face_detected_url) {
          url_evidence = face_detected_url;
        }

        if (!motive_categorie) {
          motive_categorie = getTrueAlertName(tag);
        }

        if (!url_evidence && !face_detected_url) return;

        const IGNORED_TAGS = [
          'heartbeat', 'keepalive', 'status', 'statistics', 'ping', 'pong',
          'alarm_stats', 'alarm_throughput', 'data', 'states_workspace', 'states_camera'
        ];
        const rawTag = (tag || '').toLowerCase();
        const rawMotive = (motive_categorie || '').toLowerCase();
        const isIgnored = IGNORED_TAGS.some(ignored => rawTag.includes(ignored) || rawMotive.includes(ignored));
        if (isIgnored) return;

        const probability = rawData.probability ?? rawData.prob ?? rawData.confidence ?? rawData.tag_value ?? rawData.percent ?? 0.95;
        const createdAt = rawData.createdAt || rawData.created_at || rawData.timestamp || rawData.time || new Date().toISOString();

        newAlerts.push({
          id, probability, createdAt, device, tag, motive_categorie, url_evidence, face_detected_url,
          is_confirmed: rawData.is_confirmed ?? null,
          is_fp: rawData.is_fp ?? null,
          is_ignored: rawData.is_ignored ?? null,
          state: rawData.state ?? 'pending',
          vinfo: typeof rawData.vinfo === 'string' ? rawData.vinfo : JSON.stringify(rawData.vinfo || {}),
          name_categorie: rawData.name_categorie || undefined
        });
      });

      if (newAlerts.length > 0) {
        setAlerts(prev => {
          const validNew = newAlerts.filter(na => !prev.some(pa => pa.id === na.id || (pa.device?.name === na.device?.name && pa.createdAt === na.createdAt)));
          if (validNew.length === 0) return prev;

          console.log(`[ALERTA RT] ✅ Agregando ${validNew.length} alertas nuevas.`);

          if (isFocusedRef.current) {
            setTimeout(() => {
              triggerRealTimePopup(validNew[0]);
            }, 50);
          }

          return [...validNew, ...prev].slice(0, 100);
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }

  function formatHora(fecha: string) {
    if (!fecha) return '--:--';
    return parseUTCDate(fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  function formatFechaPrecisa(fecha: string) {
    if (!fecha) return '--';
    return parseUTCDate(fecha).toLocaleString('es-PE', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function getAnalyticTheme(tag: string) {
    const t = (tag || '').toLowerCase();
    if (t.includes('fire') || t.includes('fuego') || t.includes('weapon') || t.includes('arma') || t.includes('crítica') || t.includes('critical')) {
      return { color: '#f44336', icon: 'flame', label: 'CRÍTICA' };
    }
    if (t.includes('lpr') || t.includes('plate') || t.includes('placa') || t.includes('car')) {
      return { color: '#03a9f4', icon: 'car', label: 'VEHÍCULO' };
    }
    if (t.includes('face') || t.includes('rostro')) {
      return { color: '#4caf50', icon: 'person', label: 'ROSTRO' };
    }
    if (t.includes('count') || t.includes('aforo') || t.includes('people')) {
      return { color: '#9c27b0', icon: 'people', label: 'MÉTRICA' };
    }
    if (t.includes('zone') || t.includes('zona') || t.includes('intrus') || t.includes('motion') || t.includes('movimiento')) {
      return { color: '#ff9800', icon: 'warning', label: 'INTRUSIÓN' };
    }
    return { color: '#2196f3', icon: 'scan', label: 'ACTIVO' };
  }

  function getEvidenceUrl(item: Alert) {
    return getMediaUrl(item.url_evidence, domain);
  }



  async function handleQuickAction(alertItem: Alert, action: 'CONFIRM' | 'FALSE_POSITIVE' | 'IGNORE') {
    const originalAlerts = [...alerts];
    const originalSelectedAlert = selectedAlert ? { ...selectedAlert } : null;

    // 1. Optimistic Update
    setAlerts(prev => prev.map(a => {
      if (a.id === alertItem.id) {
        return {
          ...a,
          is_confirmed: action === 'CONFIRM' ? true : action === 'FALSE_POSITIVE' ? false : null,
          is_fp: action === 'FALSE_POSITIVE' ? true : false,
          is_ignored: action === 'IGNORE' ? true : false,
          state: action === 'IGNORE' ? 'ignored' : 'resolved'
        };
      }
      return a;
    }));

    if (selectedAlert && selectedAlert.id === alertItem.id) {
      setSelectedAlert(prev => prev ? {
        ...prev,
        is_confirmed: action === 'CONFIRM' ? true : action === 'FALSE_POSITIVE' ? false : null,
        is_fp: action === 'FALSE_POSITIVE' ? true : false,
        is_ignored: action === 'IGNORE' ? true : false,
        state: action === 'IGNORE' ? 'ignored' : 'resolved'
      } : null);
    }

    // 2. Async Sync — siempre via gateway orquestador
    let incidentRes: any = null;
    try {
      const gateClassification = action === 'CONFIRM' ? 'confirm' : action === 'FALSE_POSITIVE' ? 'false_positive' : 'ignore';
      console.log(`[API SYNC] 🚀 Clasificando alerta ID ${alertItem.id} — ${gateClassification}`);
      incidentRes = await classifyWorkspacesEvent({
        eventType: 'alert',
        eventId: alertItem.id,
        classification: gateClassification
      });
      console.log(`[API SYNC] ✅ Alerta ID ${alertItem.id} clasificada:`, incidentRes);
    } catch (error) {
      console.error(`[API SYNC] ❌ Fallo al clasificar alerta ${alertItem.id}:`, error);
      setAlerts(originalAlerts);
      setSelectedAlert(originalSelectedAlert);
      RNAlert.alert('Error de Sincronización', 'No se pudo guardar la clasificación. Verifica tu conexión.');
      return;
    }

    if (incidentRes && incidentRes.id) {
      const incidentId = Number(incidentRes.id);
      const incidentName = incidentRes.name || (action === 'CONFIRM' ? 'Manual Confirmation' : action === 'FALSE_POSITIVE' ? 'False Positive' : 'Ignore Alert');

      setAlerts(prev => prev.map(a => {
        if (a.id === alertItem.id) {
          return {
            ...a,
            incidentId,
            incidentName,
            sentDescriptions: a.sentDescriptions || []
          };
        }
        return a;
      }));

      if (selectedAlert && selectedAlert.id === alertItem.id) {
        setSelectedAlert(prev => prev ? {
          ...prev,
          incidentId,
          incidentName,
          sentDescriptions: prev.sentDescriptions || []
        } : null);
      }
    }
  }

  async function handleSendNote() {
    if (!noteText.trim() || !selectedAlert) return;

    const eventId = selectedAlert.id;
    const incidentId = selectedAlert.incidentId ?? Math.floor(Math.random() * 100000) + 50000;
    const incidentName = selectedAlert.incidentName ?? (selectedAlert.is_confirmed === true ? 'Manual Confirmation' : selectedAlert.is_confirmed === false ? 'False Positive' : 'Ignore Alert');

    setSendingNote(true);

    try {
      console.log(`[API DESCRIPTION] 🚀 Sincronizando nota de incidente ID ${incidentId} con el servidor...`);
      const response = await addIncidentDescription({
        eventId,
        incidentId,
        name: incidentName,
        description: noteText.trim()
      });

      // Formato para mostrar fecha y hora actual en la nota
      const formattedDate = new Date().toLocaleDateString('es-PE', { month: 'short', day: 'numeric', year: 'numeric' });
      const formattedTime = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const timestampStr = `${formattedDate}, ${formattedTime}`;

      const newDescription = {
        id: response?.id || Math.floor(Math.random() * 1000000),
        username: userData?.Username || 'admin',
        description: noteText.trim(),
        timestamp: timestampStr
      };

      setSelectedAlert(prev => prev ? {
        ...prev,
        sentDescriptions: [...(prev.sentDescriptions || []), newDescription]
      } : null);

      setAlerts(prev => prev.map(a => {
        if (a.id === eventId) {
          return {
            ...a,
            sentDescriptions: [...(a.sentDescriptions || []), newDescription]
          };
        }
        return a;
      }));

      setNoteText('');
      console.log('[API DESCRIPTION] ✅ Nota enviada y guardada correctamente.');
    } catch (error) {
      console.error('[API DESCRIPTION] ❌ Error al enviar nota:', error);
      RNAlert.alert('Fallo de Sincronización', 'No se pudo registrar la nota en el servidor SIVI local. Por favor, verifica tu conexión.');
    } finally {
      setSendingNote(false);
    }
  }

  if (loading) {
    return <Loading />;
  }

  const filteredAlerts = alerts.filter(item => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const typeTag = (item.motive_categorie || item.tag || '').toLowerCase();
    const camName = (item.device?.name || '').toLowerCase();
    return typeTag.includes(query) || camName.includes(query);
  });

  const styles = getStyles(isDarkMode);

  return (
    <View style={styles.container}>
      {/* HEADER ORIGINAL */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Ionicons name="shield-checkmark" size={20} color="#2E9BFF" />
          <Text style={styles.logoText}>SIVI</Text>
        </View>

        <TouchableOpacity
          style={styles.toggleViewBtn}
          activeOpacity={0.8}
          onPress={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')}
        >
          <Ionicons
            name={viewMode === 'grid' ? "list-outline" : "grid-outline"}
            size={20}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      {/* TITULO DE GESTION */}
      <View style={styles.titleContainer}>
        <Text style={styles.tituloGestion}>Gestión de Alertas</Text>

        {/* CAPSULA DE CONTEO */}
        <View style={styles.capsuleBadge}>
          <View style={styles.capsuleDot} />
          <Text style={styles.capsuleText}>últimas {filteredAlerts.length} alertas</Text>
        </View>
      </View>

      {/* BUSCADOR */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#ffffff40" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Buscar por cámara o tipo..."
          placeholderTextColor="#ffffff40"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={16} color="#ffffff40" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        key={viewMode}
        numColumns={viewMode === 'grid' ? 2 : 1}
        data={filteredAlerts}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => (
          <AlertCardItem
            item={item}
            viewMode={viewMode}
            onPress={setSelectedAlert}
            domain={domain}
            formatHora={formatHora}
            getAnalyticTheme={getAnalyticTheme}
            isDarkMode={isDarkMode}
            styles={styles}
          />
        )}
        ListEmptyComponent={
          <View style={styles.centrado}>
            <Ionicons name="shield-checkmark" size={48} color="#ffffff20" />
            <Text style={styles.vacio}>Sistema Seguro. Sin alertas recientes.</Text>
          </View>
        }
        onEndReached={cargarMasAlertas}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#2E9BFF" />
            </View>
          ) : !hasMore && alerts.length > 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ color: '#ffffff40', fontSize: 11, fontWeight: '600' }}>
                Fin del historial reciente (Máx. 150 alertas)
              </Text>
            </View>
          ) : null
        }
      />

      {/* MODAL DE CARGA TRANSPARENTE PARA ALERTA INDIVIDUAL */}
      {loadingSingleAlert && (
        <Modal transparent={true} visible={true} animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#161622', padding: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ffffff10' }}>
              <ActivityIndicator size="large" color="#2E9BFF" />
              <Text style={{ color: '#fff', marginTop: 10, fontSize: 13, fontWeight: '600' }}>Cargando detalles de alerta...</Text>
            </View>
          </View>
        </Modal>
      )}

      {/* MODAL DETALLE (Estilo Maqueta SIVI Premium) */}
      <Modal
        visible={!!selectedAlert}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setSelectedAlert(null);
          setIsZoomVisible(false);
        }}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>

            {/* Cabecera del Modal (Mockup) */}
            <View style={styles.modalHeaderMockup}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="calendar-outline" size={16} color="#2E9BFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalHeaderDateText}>
                  {selectedAlert ? formatFechaPrecisa(selectedAlert.createdAt) : ''}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setSelectedAlert(null);
                  setIsZoomVisible(false);
                }}
                style={styles.modalHeaderCloseBtn}
              >
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Evidencia Fotográfica con overlay e interactividad de Zoom */}
              {selectedAlert && (
                <View style={styles.evidenceContainerMockup}>
                  <Text style={styles.evidenceLabelTitle}>EVIDENCIA</Text>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.evidenceImageWrapper}
                    onPress={() => setIsZoomVisible(true)}
                  >
                    <Image
                      source={{ uri: getEvidenceUrl(selectedAlert) || undefined }}
                      style={styles.evidenceImageMockup}
                      resizeMode="cover"
                    />
                    <View style={styles.evidenceCamOverlay}>
                      <Text style={styles.evidenceCamOverlayText} numberOfLines={1}>
                        {(selectedAlert.device?.name || 'Cámara').toUpperCase()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* Datasheet 2x2 (Grid de 4 tarjetas) */}
              {selectedAlert && (() => {
                const probNum = Number(selectedAlert.probability) || 0;
                const prob = probNum > 1 ? probNum : probNum * 100;

                return (
                  <View style={styles.gridContainer2x2}>
                    {/* Dispositivo (Expandido a ancho completo) */}
                    <View style={[styles.infoFullCard, { marginBottom: 10 }]}>
                      <Text style={styles.gridItemLabel}>DISPOSITIVO</Text>
                      <Text style={styles.gridItemVal} numberOfLines={1}>
                        {selectedAlert.device?.name || 'Cámara'}
                      </Text>
                    </View>

                    <View style={styles.gridRow2x2}>
                      {/* Probabilidad */}
                      <View style={styles.gridItemCard}>
                        <Text style={styles.gridItemLabel}>PROBABILIDAD</Text>
                        <Text style={[styles.gridItemVal, { color: '#4caf50' }]}>
                          {prob.toFixed(0)}%
                        </Text>
                      </View>
                      {/* Fecha */}
                      <View style={styles.gridItemCard}>
                        <Text style={styles.gridItemLabel}>FECHA DE ALERTA</Text>
                        <Text style={styles.gridItemVal} numberOfLines={1}>
                          {selectedAlert ? formatFechaPrecisa(selectedAlert.createdAt) : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })()}

              {/* Sección INFORMACIÓN DE ALERTA */}
              {selectedAlert && (() => {
                let vinfoObj: any = {};
                if (selectedAlert.vinfo) {
                  try {
                    vinfoObj = typeof selectedAlert.vinfo === 'string' ? JSON.parse(selectedAlert.vinfo) : selectedAlert.vinfo;
                  } catch (e) {
                    vinfoObj = {};
                  }
                }

                const alarmName = (
                  vinfoObj?.name ||
                  vinfoObj?.alarm_name ||
                  vinfoObj?.alarmName ||
                  selectedAlert.motive_categorie ||
                  selectedAlert.name_categorie ||
                  (selectedAlert as any).title ||
                  (selectedAlert as any).motive ||
                  selectedAlert.tag ||
                  'Alerta de Seguridad'
                ).trim();

                let scheduleVal = "00:00:00 - 23:59:00";
                let intervalVal = "daily";

                if (vinfoObj?.schedule) {
                  scheduleVal = vinfoObj.schedule;
                } else {
                  const detailDev = vinfoObj?.Detail_device_alarm?.[0];
                  const detailSched = detailDev?.detail_schedule_device?.[0];
                  if (detailSched?.start && detailSched?.end) {
                    scheduleVal = `${detailSched.start} - ${detailSched.end}`;
                  }
                }

                if (vinfoObj?.interval) {
                  intervalVal = vinfoObj.interval;
                } else {
                  const detailDev = vinfoObj?.Detail_device_alarm?.[0];
                  const detailSched = detailDev?.detail_schedule_device?.[0];
                  if (detailSched?.interval) {
                    intervalVal = detailSched.interval;
                  }
                }

                return (
                  <View style={styles.infoSectionMockup}>
                    <Text style={styles.infoSectionTitle}>INFORMACIÓN DE ALERTA</Text>

                    {/* Nombre de la Alarma (Full width) */}
                    <View style={styles.infoFullCard}>
                      <Text style={styles.infoItemLabel}>NOMBRE DE LA ALARMA</Text>
                      <Text style={styles.infoItemVal}>{alarmName}</Text>
                    </View>

                    {/* Calendario & Intervalo (2 Columnas) */}
                    <View style={styles.gridRow2x2}>
                      <View style={styles.gridItemCard}>
                        <Text style={styles.gridItemLabel}>CALENDARIO</Text>
                        <Text style={styles.gridItemVal}>{scheduleVal}</Text>
                      </View>
                      <View style={styles.gridItemCard}>
                        <Text style={styles.gridItemLabel}>INTERVALO</Text>
                        <Text style={styles.gridItemVal}>{intervalVal}</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}

              {/* Acciones de Resolución o Registro de Minutas */}
              {selectedAlert && (() => {
                const isResolved = selectedAlert.is_confirmed === true || selectedAlert.is_fp === true || selectedAlert.is_ignored === true || selectedAlert.state === 'resolved' || selectedAlert.state === 'ignored';
                const resolvedLabel = selectedAlert.is_confirmed === true ? 'ALERTA CONFIRMADA' : selectedAlert.is_fp === true ? 'FALSO POSITIVO' : 'ALERTA IGNORADA';
                const resolvedColor = selectedAlert.is_confirmed === true ? '#4CAF50' : selectedAlert.is_fp === true ? '#FF9800' : '#ffffff60';

                return (
                  <View style={styles.resolutionSectionMockup}>
                    <Text style={styles.resolutionSectionTitle}>RESOLUCIÓN DE SEGURIDAD</Text>

                    {isResolved ? (
                      <View style={styles.resolvedContainerMockup}>
                        {/* Status Badge */}
                        <View style={[styles.resolvedHeaderBadge, { backgroundColor: resolvedColor + '18', borderColor: resolvedColor + '40' }]}>
                          <Ionicons name="shield-checkmark" size={16} color={resolvedColor} style={{ marginRight: 6 }} />
                          <Text style={[styles.resolvedHeaderBadgeText, { color: resolvedColor }]}>{resolvedLabel}</Text>
                        </View>

                        {/* Input Box para Nota/Minuta */}
                        <View style={styles.minutaInputSection}>
                          <Text style={styles.minutaLabel}>REGISTRO DE MINUTA / BITÁCORA</Text>
                          <View style={styles.minutaInputRow}>
                            <TextInput
                              placeholder="Escribe una descripción del incidente..."
                              placeholderTextColor="#ffffff30"
                              multiline
                              style={styles.minutaInput}
                              value={noteText}
                              onChangeText={setNoteText}
                            />
                            <TouchableOpacity
                              style={[styles.minutaSendBtn, !noteText.trim() && { opacity: 0.5 }]}
                              onPress={handleSendNote}
                              disabled={sendingNote || !noteText.trim()}
                            >
                              {sendingNote ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Ionicons name="send" size={16} color="#fff" />
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Notas Enviadas dinámicamente en esta sesión */}
                        {selectedAlert.sentDescriptions && selectedAlert.sentDescriptions.length > 0 ? (
                          <View style={styles.sentNotesList}>
                            {selectedAlert.sentDescriptions.map((note) => (
                              <View key={note.id} style={styles.sentNoteCard}>
                                <View style={styles.sentNoteHeader}>
                                  <View style={styles.sentNoteUserBadge}>
                                    <Text style={styles.sentNoteUserText}>{note.username}</Text>
                                  </View>
                                  <Text style={styles.sentNoteTimeText}>{note.timestamp}</Text>
                                </View>
                                <Text style={styles.sentNoteBodyText}>{note.description}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <View style={styles.modalActionSectionMockup}>
                        <View style={styles.modalActionsRowMockup}>
                          <TouchableOpacity
                            style={[styles.modalActionBtnMockup, { backgroundColor: '#4CAF50' }]}
                            onPress={() => handleQuickAction(selectedAlert, 'CONFIRM')}
                          >
                            <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.modalActionBtnTextMockup}>CONFIRMAR</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.modalActionBtnMockup, { backgroundColor: '#FF9800' }]}
                            onPress={() => handleQuickAction(selectedAlert, 'FALSE_POSITIVE')}
                          >
                            <Ionicons name="alert-circle" size={16} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.modalActionBtnTextMockup}>FALSO POS.</Text>
                          </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                          style={styles.modalActionBtnFullMockup}
                          onPress={() => handleQuickAction(selectedAlert, 'IGNORE')}
                        >
                          <Ionicons name="close-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                          <Text style={styles.modalActionBtnTextFullMockup}>IGNORAR EVENTO</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL SECUNDARIO ZOOM DE IMAGEN EVIDENCIA */}
      <Modal
        visible={isZoomVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsZoomVisible(false)}
      >
        <TouchableOpacity
          style={styles.zoomContainer}
          activeOpacity={1}
          onPress={() => setIsZoomVisible(false)}
        >
          <View style={styles.zoomHeader}>
            <Text style={styles.zoomHeaderTitle} numberOfLines={1}>
              {selectedAlert ? (selectedAlert.device?.name || 'Cámara').toUpperCase() : 'VISOR'}
            </Text>
            <TouchableOpacity
              onPress={() => setIsZoomVisible(false)}
              style={styles.zoomCloseBtn}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <Image
            source={{ uri: selectedAlert ? getEvidenceUrl(selectedAlert) || undefined : undefined }}
            style={styles.zoomImage}
            resizeMode="contain"
          />

          <View style={styles.zoomFooter}>
            <Text style={styles.zoomFooterText}>Toca en cualquier parte para cerrar</Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* POP-UP FLOTANTE DE ALERTAS EN TIEMPO REAL */}
      {realTimePopupAlert && (
        <Animated.View
          style={[
            styles.popupContainer,
            {
              transform: [{ translateY: popupAnim }]
            }
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => {
              setSelectedAlert(realTimePopupAlert);
              dismissRealTimePopup();
            }}
            style={styles.popupCard}
          >
            {(() => {
              const typeTag = realTimePopupAlert.motive_categorie || realTimePopupAlert.tag || 'Detección';
              const theme = getAnalyticTheme(typeTag);
              const probNum = Number(realTimePopupAlert.probability) || 0;
              const prob = probNum > 1 ? probNum : probNum * 100;

              let popupVinfo: any = {};
              if (realTimePopupAlert.vinfo) {
                try {
                  popupVinfo = typeof realTimePopupAlert.vinfo === 'string' ? JSON.parse(realTimePopupAlert.vinfo) : realTimePopupAlert.vinfo;
                } catch (e) {}
              }
              const popupAlarmName = (
                popupVinfo?.name ||
                popupVinfo?.alarm_name ||
                popupVinfo?.alarmName ||
                realTimePopupAlert.motive_categorie ||
                realTimePopupAlert.name_categorie ||
                'Alerta de Seguridad'
              ).trim();

              return (
                <>
                  <View style={[styles.popupAccentLine, { backgroundColor: theme.color }]} />
                  <View style={styles.popupContent}>
                    {/* Header */}
                    <View style={styles.popupHeader}>
                      <View style={styles.popupLiveBadge}>
                        <View style={styles.popupLiveDot} />
                        <Text style={styles.popupLiveText}>NUEVA ALERTA EN TIEMPO REAL</Text>
                      </View>
                      <TouchableOpacity style={styles.popupCloseBtn} onPress={dismissRealTimePopup}>
                        <Ionicons name="close" size={16} color="#ffffff80" />
                      </TouchableOpacity>
                    </View>

                    {/* Body */}
                    <View style={styles.popupBody}>
                      <Image
                        source={{ uri: getEvidenceUrl(realTimePopupAlert) || 'https://images.unsplash.com/photo-1557597774-9d273605dfa9' }}
                        style={styles.popupEvidenceImage}
                        resizeMode="cover"
                      />
                      <View style={styles.popupDetails}>
                        <View style={styles.popupDeviceRow}>
                          <Ionicons name="videocam" size={12} color="#2E9BFF" style={{ marginRight: 4 }} />
                          <Text style={styles.popupDeviceName} numberOfLines={1}>
                            {realTimePopupAlert.device?.name || 'CÁMARA'}
                          </Text>
                        </View>
                        <Text style={styles.popupAlarmName} numberOfLines={1}>
                          {popupAlarmName}
                        </Text>
                        <View style={styles.popupMetricsRow}>
                          <Text style={styles.popupMetricLabel}>Probabilidad: </Text>
                          <Text style={[styles.popupMetricValue, { color: theme.color }]}>
                            {prob.toFixed(2)}%
                          </Text>
                        </View>
                        <View style={styles.popupTimeRow}>
                          <Ionicons name="calendar-outline" size={10} color="#ffffff60" style={{ marginRight: 4 }} />
                          <Text style={styles.popupTimeText}>
                            {formatFechaPrecisa(realTimePopupAlert.createdAt)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Quick Action Buttons */}
                    <View style={styles.popupActionsRow}>
                      <TouchableOpacity
                        style={[styles.popupActionBtn, { backgroundColor: '#4CAF50' }]}
                        onPress={() => {
                          handleQuickAction(realTimePopupAlert, 'CONFIRM');
                          dismissRealTimePopup();
                        }}
                      >
                        <Ionicons name="checkmark-circle" size={12} color="#fff" style={{ marginRight: 3 }} />
                        <Text style={styles.popupActionBtnText}>CONFIRMAR</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.popupActionBtn, { backgroundColor: '#FF9800' }]}
                        onPress={() => {
                          handleQuickAction(realTimePopupAlert, 'FALSE_POSITIVE');
                          dismissRealTimePopup();
                        }}
                      >
                        <Ionicons name="alert-circle" size={12} color="#fff" style={{ marginRight: 3 }} />
                        <Text style={styles.popupActionBtnText}>FALSO POS.</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              );
            })()}
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const getStyles = (isDark: boolean) => {
  const bgMain = isDark ? '#0d0d0d' : '#f3f4f6';
  const bgCard = isDark ? '#161622' : '#ffffff';
  const textPrimary = isDark ? '#ffffff' : '#111827';
  const textSecondary = isDark ? '#ffffff60' : '#6b7280';
  const textMuted = isDark ? '#ffffff40' : '#9ca3af';
  const borderCol = isDark ? '#ffffff10' : '#e5e7eb';


  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: bgMain,
      paddingTop: 60,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 10,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    logoText: {
      color: '#2E9BFF',
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    toggleViewBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: '#161622',
      borderWidth: 1,
      borderColor: '#ffffff15',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    titleContainer: {
      paddingHorizontal: 20,
      marginBottom: 15,
    },
    tituloGestion: {
      color: '#ffffff',
      fontSize: 28,
      fontWeight: '800',
    },
    capsuleBadge: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      alignItems: 'center',
      backgroundColor: 'rgba(46, 155, 255, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(46, 155, 255, 0.25)',
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 5,
      marginTop: 10,
    },
    capsuleDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#2E9BFF',
      marginRight: 6,
    },
    capsuleText: {
      color: '#2E9BFF',
      fontSize: 12,
      fontWeight: '700',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#161622',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#ffffff10',
      paddingHorizontal: 15,
      height: 48,
      marginHorizontal: 20,
      marginBottom: 20,
    },
    searchInput: {
      flex: 1,
      color: '#ffffff',
      fontSize: 14,
      marginLeft: 10,
      paddingVertical: 8,
    },
    titulo: { color: textPrimary, fontSize: 24, fontWeight: '700' },
    subtitulo: { color: '#2196f3', fontSize: 13, fontWeight: '500', marginTop: 2 },
    liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f4433620', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f44336' },
    liveText: { color: '#f44336', fontSize: 11, fontWeight: '700' },

    lista: {
      paddingHorizontal: 10,
      paddingBottom: 30
    },
    centrado: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: 15 },
    vacio: { color: textSecondary, fontSize: 14 },

    // GRID CARD STYLES
    gridCard: {
      flex: 1,
      margin: 6,
      backgroundColor: bgCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#ffffff10',
      overflow: 'hidden',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    gridCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      borderBottomWidth: 1,
      borderBottomColor: '#ffffff05',
    },
    gridCardCamName: {
      color: textSecondary,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    gridCardImage: {
      width: '100%',
      height: 110,
      backgroundColor: '#050505',
    },
    gridCardFooter: {
      padding: 10,
      backgroundColor: bgCard,
    },
    gridCardTitle: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '800',
      marginBottom: 8,
    },
    gridCardLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    gridCardLabel: {
      color: textMuted,
      fontSize: 9,
      fontWeight: '700',
    },
    gridCardValueRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    gridCardProbValue: {
      color: '#2E9BFF',
      fontSize: 16,
      fontWeight: '900',
    },
    gridCardTimeValue: {
      color: textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },

    card: {
      backgroundColor: bgCard,
      borderRadius: 14,
      marginBottom: 16,
      overflow: 'hidden',
      borderWidth: 1,
    },
    cardImage: {
      width: '100%',
      height: 180,
      backgroundColor: '#050505',
      justifyContent: 'flex-start',
    },
    cardOverlayTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 10,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

    cardFooter: {
      backgroundColor: bgCard,
      padding: 15,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    footerInfo: { flex: 1 },
    footerMetrics: { alignItems: 'flex-end' },

    cardTipo: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
    cardCam: { color: textSecondary, fontSize: 14, fontWeight: '500', marginTop: 4 },
    cardHora: { color: textMuted, fontSize: 11, marginBottom: 2 },
    cardProb: { color: textPrimary, fontSize: 16, fontWeight: '800' },

    // MODAL DETALLE PREMIUM (ESTILO MOCKUP SIVI)
    modalBg: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: '#0d0d0d',
      height: '90%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden',
    },
    modalHeaderMockup: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 15,
      backgroundColor: '#0d0d0d',
      borderBottomWidth: 1,
      borderBottomColor: '#ffffff05',
    },
    modalHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    modalHeaderDateText: {
      color: '#2E9BFF',
      fontSize: 14,
      fontWeight: '800',
    },
    modalHeaderCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalScroll: {
      paddingHorizontal: 20,
      paddingBottom: 50,
    },
    evidenceContainerMockup: {
      marginTop: 10,
      marginBottom: 20,
    },
    evidenceLabelTitle: {
      color: textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 10,
      textTransform: 'uppercase',
    },
    evidenceImageWrapper: {
      width: '100%',
      height: 220,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#000',
      borderWidth: 1,
      borderColor: '#ffffff08',
    },
    evidenceImageMockup: {
      width: '100%',
      height: '100%',
    },
    evidenceCamOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    evidenceCamOverlayText: {
      color: '#ffffffaa',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },

    // GRID 2x2 METADATA STYLES
    gridContainer2x2: {
      flexDirection: 'column',
      gap: 12,
      marginBottom: 25,
    },
    gridRow2x2: {
      flexDirection: 'row',
      gap: 12,
    },
    gridItemCard: {
      flex: 1,
      backgroundColor: '#161622',
      borderWidth: 1,
      borderColor: '#ffffff05',
      borderRadius: 10,
      padding: 12,
      justifyContent: 'center',
    },
    gridItemLabel: {
      color: textMuted,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    gridItemVal: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700',
    },

    // INFORMACIÓN DE ALERTA STYLES
    infoSectionMockup: {
      marginBottom: 25,
    },
    infoSectionTitle: {
      color: '#2E9BFF',
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 12,
      textTransform: 'uppercase',
    },
    infoFullCard: {
      backgroundColor: '#161622',
      borderWidth: 1,
      borderColor: '#ffffff05',
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    },
    infoItemLabel: {
      color: textMuted,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    infoItemVal: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '800',
    },

    // RESOLUTION SECTION STYLES
    resolutionSectionMockup: {
      marginTop: 5,
    },
    resolutionSectionTitle: {
      color: textMuted,
      fontSize: 11,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: 1,
      marginBottom: 15,
      textTransform: 'uppercase',
    },
    modalActionSectionMockup: {
      backgroundColor: '#0d0d0d',
      borderRadius: 12,
      gap: 12,
    },
    modalActionsRowMockup: {
      flexDirection: 'row',
      gap: 12,
    },
    modalActionBtnMockup: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 8,
      gap: 6,
    },
    modalActionBtnTextMockup: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    modalActionBtnFullMockup: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 8,
      backgroundColor: '#f44336',
      gap: 6,
    },
    modalActionBtnTextFullMockup: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    resolvedContainerMockup: {
      backgroundColor: '#161622',
      borderWidth: 1,
      borderColor: '#ffffff05',
      borderRadius: 12,
      padding: 15,
    },
    resolvedHeaderBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: 15,
    },
    resolvedHeaderBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    minutaInputSection: {
      marginBottom: 10,
    },
    minutaLabel: {
      color: textMuted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    minutaInputRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    minutaInput: {
      flex: 1,
      backgroundColor: '#050505',
      borderWidth: 1,
      borderColor: borderCol,
      borderRadius: 10,
      color: textPrimary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      minHeight: 45,
      textAlignVertical: 'top',
    },
    minutaSendBtn: {
      width: 45,
      height: 45,
      borderRadius: 10,
      backgroundColor: '#4CAF50',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sentNotesList: {
      flexDirection: 'column',
      gap: 10,
      marginTop: 15,
      borderTopWidth: 1,
      borderColor: borderCol,
      paddingTop: 15,
    },
    sentNoteCard: {
      backgroundColor: '#0d0d0d',
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: borderCol,
    },
    sentNoteHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    sentNoteUserBadge: {
      backgroundColor: '#2E9BFF20',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    sentNoteUserText: {
      color: '#2E9BFF',
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    sentNoteTimeText: {
      color: textMuted,
      fontSize: 9,
      fontWeight: '600',
    },
    sentNoteBodyText: {
      color: textPrimary,
      fontSize: 13,
      lineHeight: 18,
    },

    // EVIDENCIA ZOOM MODAL STYLES
    zoomContainer: {
      flex: 1,
      backgroundColor: 'black',
      justifyContent: 'center',
      alignItems: 'center',
    },
    zoomHeader: {
      position: 'absolute',
      top: 50,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      zIndex: 10,
    },
    zoomHeaderTitle: {
      color: '#ffffffaa',
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    zoomCloseBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoomImage: {
      width: '100%',
      height: '75%',
    },
    zoomFooter: {
      position: 'absolute',
      bottom: 40,
      alignItems: 'center',
    },
    zoomFooterText: {
      color: '#ffffff60',
      fontSize: 11,
      fontWeight: '500',
    },

    // REAL-TIME POPUP OVERLAY STYLES
    popupContainer: {
      position: 'absolute',
      left: 15,
      right: 15,
      zIndex: 10000,
    },
    popupCard: {
      flexDirection: 'row',
      backgroundColor: 'rgba(22, 22, 34, 0.98)',
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: '#ffffff10',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      elevation: 10,
    },
    popupAccentLine: {
      width: 6,
      height: '100%',
    },
    popupContent: {
      flex: 1,
      padding: 12,
    },
    popupHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    popupLiveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(244, 67, 54, 0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    popupLiveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#F44336',
      marginRight: 6,
    },
    popupLiveText: {
      color: '#F44336',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    popupCloseBtn: {
      padding: 4,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 12,
    },
    popupBody: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    popupEvidenceImage: {
      width: 70,
      height: 70,
      borderRadius: 8,
      backgroundColor: '#000',
    },
    popupDetails: {
      flex: 1,
      marginLeft: 12,
    },
    popupDeviceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
    },
    popupDeviceName: {
      color: '#ffffffaa',
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    popupAlarmName: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 4,
    },
    popupMetricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
    },
    popupMetricLabel: {
      color: '#ffffff60',
      fontSize: 10,
      fontWeight: '600',
    },
    popupMetricValue: {
      fontSize: 11,
      fontWeight: '900',
    },
    popupTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    popupTimeText: {
      color: '#ffffff50',
      fontSize: 9,
      fontWeight: '600',
    },
    popupActionsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    popupActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
    },
    popupActionBtnText: {
      color: '#ffffff',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    neonBorder: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderWidth: 2,
      borderColor: '#ff0055',
      pointerEvents: 'none',
      shadowColor: '#ff0055',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 8,
      elevation: 5,
    },
  });
};
