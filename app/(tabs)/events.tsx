import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { getAlarms } from '../../services/api';
import { useAppStore } from '../../services/store';
import { wsService } from '../../services/websocket';
import Loading from '../../components/Loading';
import { Colors, Layout } from '../../constants/theme';

interface EventItem {
  id: number | string;
  name: string;
  type: string;
  devices: number;
  active: boolean;
  params: {
    object: string;
    minTime: string;
    prob: string;
  };
}

// ⚠️ MOCK_EVENTS has been updated to match the exact names, counts, and properties from the user's screenshot
const MOCK_EVENTS: EventItem[] = [
  { id: 1, name: 'INGRESO_CASTAÑOS_Aforo', type: 'OBJECT', devices: 1, active: true, params: { object: 'person', minTime: '2.0s', prob: '75%' } },
  { id: 2, name: 'SALIDA_CASTAÑOS_AFORO', type: 'OBJECT', devices: 1, active: true, params: { object: 'person', minTime: '0.2s', prob: '75%' } },
  { id: 3, name: 'SEGURIDAD_JGRANDA_Aforo', type: 'OBJECT', devices: 1, active: true, params: { object: 'person', minTime: '0.2s', prob: '75%' } },
  { id: 4, name: 'SALA_MULTIUSO_SOTANO_Zona_Segura', type: 'OBJECT', devices: 1, active: true, params: { object: 'person', minTime: '0.2s', prob: '70%' } },
  { id: 5, name: 'SALA_MUSICA_SOTANO_Zona_Segura', type: 'OBJECT', devices: 1, active: true, params: { object: 'person', minTime: '0.2s', prob: '70%' } },
  { id: 6, name: 'COWORKING_2_Zona_Segura', type: 'OBJECT', devices: 1, active: true, params: { object: 'person', minTime: '0.2s', prob: '70%' } },
  { id: 7, name: 'DETECCION_MANOS_ARRIBA', type: 'ACTION', devices: 4, active: true, params: { object: 'actions', minTime: '0.2s', prob: '85%' } },
  { id: 8, name: 'CANCHA_3_Zona_Segura', type: 'OBJECT', devices: 1, active: true, params: { object: 'person', minTime: '0.2s', prob: '70%' } },
  { id: 9, name: 'LOCKER_CAMERINO_DAMAS_Zona_Segura', type: 'OBJECT', devices: 1, active: true, params: { object: 'person', minTime: '0.2s', prob: '70%' } },
  { id: 10, name: 'CAMARA_GERENCIA_Zona_Segura', type: 'OBJECT', devices: 1, active: true, params: { object: 'person', minTime: '0.2s', prob: '70%' } },
  { id: 11, name: 'LOCKER_CAMERINO_VARONES_Zona_Segura', type: 'OBJECT', devices: 1, active: true, params: { object: 'person', minTime: '0.2s', prob: '70%' } },
  { id: 12, name: 'CAJA_Zona_Segura', type: 'OBJECT', devices: 1, active: true, params: { object: 'person', minTime: '0.2s', prob: '70%' } },
  { id: 13, name: 'CUARTO_MAQUINAS_EDIFICIO_Zona_Segura', type: 'OBJECT', devices: 1, active: true, params: { object: 'person', minTime: '0.2s', prob: '70%' } },
  { id: 14, name: 'ASOCIADOS_Zona_Segura', type: 'OBJECT', devices: 1, active: true, params: { object: 'person', minTime: '0.2s', prob: '70%' } },
  { id: 15, name: 'PASILLO_ASOCIADOS_Zona_Segura', type: 'OBJECT', devices: 1, active: true, params: { object: 'person', minTime: '0.2s', prob: '70%' } },
];

export default function EventsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { activeDomain: domain, activeWorkspace, impersonatedWorkspace, workspaceSessions, isDarkMode } = useAppStore();
  const styles = getStyles(isDarkMode);
  const themeColors = isDarkMode ? Colors.dark : Colors.light;
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic Workspace Name Resolution
  const currentWs = impersonatedWorkspace || activeWorkspace;
  const workspaceName = (currentWs?.name || 'REALCLUB').toUpperCase();

  const queryEnabled = !!(workspaceSessions && workspaceSessions.length > 0);
  console.log(`[EventsScreen] 🔐 workspaceSessions=${workspaceSessions?.length ?? 0} | queryEnabled=${queryEnabled} | wsId="${currentWs?.id}"`);

  const { data: qData, isLoading: loading, refetch, isFetching } = useQuery({
    queryKey: ['alarms', domain, currentWs?.id],
    queryFn: () => getAlarms(1),
    enabled: queryEnabled,
  });

  // 1. Sincronización automática al enfocar la pestaña
  useEffect(() => {
    if (isFocused) {
      console.log('[EventsScreen] 🔄 Pestaña enfocada. Sincronizando alarmas...');
      refetch();
    }
  }, [isFocused, refetch]);

  // 2. Sincronización reactiva en tiempo real vía WebSockets
  useEffect(() => {
    console.log('[EventsScreen] 📡 Suscribiendo listener de WebSockets para Smart Events...');
    const unsubscribe = wsService.subscribe((payload) => {
      // Reaccionamos a eventos de cambio en alarmas o estadísticas de aforo
      if (
        payload.channel === 'new_event' || 
        payload.channel === 'alarm_stats' || 
        payload.channel === 'new_alert' ||
        payload.channel === 'data'
      ) {
        console.log(`[EventsScreen] ⚡ Evento "${payload.channel}" recibido vía WS. Sincronizando alarmas en tiempo real...`);
        refetch();
      }
    });

    return () => {
      console.log('[EventsScreen] 🔌 Desuscribiendo listener de WebSockets...');
      unsubscribe();
    };
  }, [refetch]);

  if (loading) {
    return <Loading />;
  }

  // 1. Resolver la lista de alarmas de forma defensiva e insensible a la estructura
  const rawRows = (qData as any)?.rows;
  const alarmRows = Array.isArray(rawRows) ? rawRows : (Array.isArray(qData) ? qData : []);

  // Diagnóstico: cuántas alarmas crudas devolvió el servidor
  console.log(`[EventsScreen] 📊 alarmRows crudas del servidor: ${alarmRows.length}`);

  // Transform raw alarms from server to standard visual layout
  // ⚠️ FIX: Se eliminó el filtro "row.id !== undefined" que descartaba alarmas sin id explícito.
  // Algunas alarmas del servidor pueden llegar con id=0 (falsy) o sin ese campo y se perdían.
  const realEvents: EventItem[] = alarmRows
    .filter((row: any) => row !== null && row !== undefined)
    .map((row: any) => {
    let type = 'OBJECT';
    let objectName = 'Objeto';
    let minTime = '0.5s';
    let prob = '70%';

    if (row.Detail_rule_face__alarm && row.Detail_rule_face__alarm.length > 0) {
      type = 'FACE';
      objectName = 'Rostro';
      const rule = row.Detail_rule_face__alarm[0];
      prob = rule.prob ? `${rule.prob}%` : '95%';
    } else if (row.Detail_rule_lpr__alarm && row.Detail_rule_lpr__alarm.length > 0) {
      type = 'LPR';
      objectName = 'Placa';
      const rule = row.Detail_rule_lpr__alarm[0];
      prob = rule.prob ? `${rule.prob}%` : '98%';
    } else if (row.Detail_rule_obj_alarm && row.Detail_rule_obj_alarm.length > 0) {
      type = 'OBJECT';
      const rule = row.Detail_rule_obj_alarm[0];
      const tag = rule.tag || 'object';
      objectName = tag === 'gun' ? 'Arma' : tag === 'person' ? 'Persona' : tag.charAt(0).toUpperCase() + tag.slice(1);
      minTime = rule.alertime ? `${rule.alertime}s` : '0.2s';
      prob = rule.prob ? `${rule.prob}%` : '75%';
    } else if (row.Detail_rule_action_alarm && row.Detail_rule_action_alarm.length > 0) {
      type = 'ACTION';
      objectName = 'Acción';
      const rule = row.Detail_rule_action_alarm[0];
      prob = rule.prob ? `${rule.prob}%` : '90%';
    }

    return {
      // ⚠️ FIX: Usar row.id ?? row.name como clave para no perder alarmas con id=0
      id: row.id ?? row.name ?? Math.random(),
      name: row.name || 'Alerta Inteligente',
      type,
      devices: row.Detail_device_alarm?.length ?? 0,
      active: row.state ?? true,
      params: {
        object: objectName,
        minTime,
        prob
      }
    };
  });

  // Diagnóstico: cuántos eventos quedaron después del mapping
  console.log(`[EventsScreen] ✅ realEvents mapeados: ${realEvents.length}`);

  // ⚠️ FIX: La condición anterior usaba "!domain" que mostraba los 15 MOCK_EVENTS
  // si el dominio activo no estaba presente, ignorando los datos reales ya cargados.
  // Ahora solo usamos mocks si el servidor no devolvió absolutamente ninguna alarma real
  // Y además no tenemos habilitada la consulta de sesión activa (para evitar data leaks de Realclub en cmarket).
  const displayEvents: EventItem[] = (realEvents.length > 0 || queryEnabled) ? realEvents : MOCK_EVENTS;
  const isMockData = (realEvents.length === 0 && !queryEnabled);
  console.log(`[EventsScreen] 🖥️ Mostrando ${displayEvents.length} eventos (${isMockData ? 'MOCK' : 'REAL'})`);

  const filteredEvents = displayEvents.filter(ev =>
    ev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ev.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* HEADER TÁCTICO */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBox}>
            <Ionicons name="shield" size={18} color={Colors.brand.celeste} />
          </View>
          <Text style={styles.logoText}>SIVI</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => refetch()} activeOpacity={0.7}>
          {isFetching ? (
            <ActivityIndicator size="small" color={Colors.brand.celeste} />
          ) : (
            <Ionicons name="refresh" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* TÍTULO Y WORKSPACE */}
        <View style={styles.titleRow}>
          <Text style={styles.mainTitle}>Eventos Inteligentes</Text>
          <View style={styles.workspaceContainer}>
            <Ionicons name="business" size={14} color={Colors.brand.celeste} style={{ marginRight: 5 }} />
            <Text style={styles.workspaceText}>{workspaceName}</Text>
          </View>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={isDarkMode ? '#ffffff60' : '#4B5563'} style={styles.searchIcon} />
            <TextInput
              placeholder="Buscar regla por nombre..."
              placeholderTextColor={themeColors.inputPlaceholder}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* LISTADO DE EVENTOS */}
        {filteredEvents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="notifications-off-outline" size={32} color={Colors.brand.primary} />
            </View>
            <Text style={styles.emptyText}>Sin eventos configurados</Text>
            <Text style={styles.emptySubtext}>
              No hay alarmas o reglas activas para la sucursal {workspaceName.toLowerCase()}.
            </Text>
          </View>
        ) : (
          filteredEvents.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/(tabs)/event-config', params: { id: event.id } })}
            >
              {/* Contenido Izquierdo */}
              <View style={styles.cardLeft}>
                <View style={styles.iconBoxCamera}>
                  <Ionicons name="notifications" size={18} color={Colors.brand.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.eventName} numberOfLines={1} ellipsizeMode="tail">
                    {event.name}
                  </Text>
                  {/* Metadatos detallados de la Analítica */}
                  <Text style={[styles.subtext, { marginTop: 4 }]}>
                    Analítica: {event.type === 'OBJECT' ? 'OBJETO' : event.type}  •  Cámaras: {event.devices}  •  Conf: {event.params.prob}
                  </Text>
                </View>
              </View>

              {/* Contenido Derecho */}
              <View style={styles.cardRight}>
                <View style={styles.statusBadge}>
                  <View style={[styles.statusDot, { backgroundColor: event.active ? '#22C55E' : '#94A3B8' }]} />
                  <Text style={[styles.statusText, { color: event.active ? '#22C55E' : '#94A3B8' }]}>
                    {event.active ? 'ACTIVO' : 'INACTIVO'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.brand.primary} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (isDark: boolean) => {
  const themeColors = isDark ? Colors.dark : Colors.light;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 55,
      paddingBottom: 8,
      backgroundColor: themeColors.background
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logoBox: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.brand.celeste + '15', justifyContent: 'center', alignItems: 'center' },
    logoText: { color: Colors.brand.celeste, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
    headerBtn: { padding: 8 },

    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    titleRow: { marginTop: 10, marginBottom: 18 },
    mainTitle: { color: themeColors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    workspaceContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    workspaceText: { color: Colors.brand.celeste, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },

    searchSection: { marginBottom: 20 },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.inputBg,
      borderRadius: Layout.borderRadius.input,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: themeColors.inputBorder,
      height: Layout.height.input
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, color: themeColors.text, fontSize: 14 },

    eventCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: themeColors.surface,
      borderRadius: Layout.borderRadius.card,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: Colors.brand.primary,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: themeColors.border
    },
    cardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      paddingRight: 10
    },
    iconBoxCamera: {
      width: 42,
      height: 42,
      borderRadius: 10,
      backgroundColor: Colors.brand.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12
    },
    cardInfo: {
      flex: 1,
      justifyContent: 'center'
    },
    eventName: {
      color: themeColors.text,
      fontSize: 13,
      fontWeight: '800'
    },
    subtext: {
      color: themeColors.textSecondary,
      fontSize: 12,
      fontWeight: '500'
    },
    cardRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(34, 197, 94, 0.08)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 5
    },
    statusText: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.2
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 50,
      paddingHorizontal: 20,
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: themeColors.border,
      marginTop: 10
    },
    emptyIconBox: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: Colors.brand.primary + '10',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16
    },
    emptyText: {
      color: themeColors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 8,
      textAlign: 'center'
    },
    emptySubtext: {
      color: themeColors.textSecondary,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18
    }
  });
};
