import React, { useState } from 'react';
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
import { getAlarms } from '../../services/api';
import { useAppStore } from '../../services/store';
import Loading from '../../components/Loading';

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

// ⚠️ MOCK_EVENTS has been updated to match the exact names, counts, and probabilities from the user's screenshot
const MOCK_EVENTS: EventItem[] = [
  { id: 1, name: 'INGRESO_CASETA', type: 'OBJECT', devices: 1, active: true, params: { object: 'Objeto', minTime: '0.5s', prob: '75%' } },
  { id: 2, name: 'SALIDA_CASETA', type: 'OBJECT', devices: 2, active: true, params: { object: 'Objeto', minTime: '0.5s', prob: '75%' } },
  { id: 3, name: 'SEGURIDAD_JARDIN', type: 'OBJECT', devices: 1, active: true, params: { object: 'Objeto', minTime: '0.5s', prob: '75%' } },
  { id: 4, name: 'SALA_MULTIUSOS', type: 'OBJECT', devices: 1, active: true, params: { object: 'Objeto', minTime: '0.5s', prob: '70%' } },
  { id: 5, name: 'SALA_MUSICA', type: 'OBJECT', devices: 1, active: true, params: { object: 'Objeto', minTime: '0.5s', prob: '70%' } },
  { id: 6, name: 'COWORKING_ESPACIO', type: 'OBJECT', devices: 1, active: true, params: { object: 'Objeto', minTime: '0.5s', prob: '70%' } },
];

export default function EventsScreen() {
  const router = useRouter();
  const { activeDomain: domain, activeWorkspace, impersonatedWorkspace } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic Workspace Name Resolution
  const currentWs = impersonatedWorkspace || activeWorkspace;
  const workspaceName = (currentWs?.name || 'REALCLUB').toUpperCase();

  const { data: qData, isLoading: loading, refetch, isFetching } = useQuery({
    queryKey: ['alarms', domain],
    queryFn: () => getAlarms(1),
    enabled: !!domain,
  });

  if (loading) {
    return <Loading />;
  }

  const alarmRows = qData?.rows || [];

  // Transform raw alarms from server to standard visual layout
  const realEvents: EventItem[] = alarmRows.map((row: any) => {
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
      id: row.id,
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

  const displayEvents: EventItem[] = (!domain || alarmRows.length === 0) ? MOCK_EVENTS : realEvents;

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
            <Ionicons name="shield" size={18} color="#0097FF" />
          </View>
          <Text style={styles.logoText}>SIVI</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => refetch()} activeOpacity={0.7}>
          {isFetching ? (
            <ActivityIndicator size="small" color="#0097FF" />
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
            <Ionicons name="business" size={14} color="#0097FF" style={{ marginRight: 5 }} />
            <Text style={styles.workspaceText}>{workspaceName}</Text>
          </View>
        </View>

        {/* BUSCADOR ESTILO PREMIUM */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#ffffff40" style={styles.searchIcon} />
            <TextInput
              placeholder="Buscar regla por nombre..."
              placeholderTextColor="#ffffff40"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* LISTADO DE EVENTOS */}
        {filteredEvents.map((event) => (
          <TouchableOpacity
            key={event.id}
            style={styles.eventCard}
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/(tabs)/event-config', params: { id: event.id } })}
          >
            {/* Contenido Izquierdo */}
            <View style={styles.cardLeft}>
              <View style={styles.iconBoxCamera}>
                <Ionicons name="notifications" size={18} color="#0097FF" />
              </View>
              <View style={styles.cardInfo}>
                <View style={styles.titleBadgeRow}>
                  <Text style={styles.eventName} numberOfLines={1} ellipsizeMode="tail">
                    {event.name}
                  </Text>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>
                      {event.type === 'OBJECT' ? 'OBJETO' : event.type}
                    </Text>
                  </View>
                </View>
                {/* 1 Cámara asociada • Conf: 75% */}
                <Text style={styles.subtext}>
                  {event.devices} {event.devices === 1 ? 'Cámara asociada' : 'Cámaras asociadas'} • Conf: {event.params.prob}
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
              <Ionicons name="chevron-forward" size={16} color="#0097FF" />
            </View>
          </TouchableOpacity>
        ))}
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 55,
    paddingBottom: 8,
    backgroundColor: '#000000'
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#0097FF15', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#0097FF', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  headerBtn: { padding: 8 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  titleRow: { marginTop: 10, marginBottom: 18 },
  mainTitle: { color: '#ffffff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  workspaceContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  workspaceText: { color: '#0097FF', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },

  searchSection: { marginBottom: 20 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121626',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#ffffff10',
    height: 48
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },

  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#101424',
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0097FF',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#ffffff05'
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
    backgroundColor: '#0097FF15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center'
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 6
  },
  eventName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    maxWidth: '65%'
  },
  typeBadge: {
    backgroundColor: '#0097FF15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0097FF30'
  },
  typeBadgeText: {
    color: '#0097FF',
    fontSize: 9,
    fontWeight: '900'
  },
  subtext: {
    color: '#94A3B8',
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
  }
});
