import { useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../services/store';
import { getAlerts } from '../../services/api';
import { wsService } from '../../services/websocket';
import Loading from '../../components/Loading';

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
  state?: string;
};

export default function AlertsScreen() {
  const { activeDomain: domain, isDarkMode } = useAppStore();
  const [alerts, setAlerts]   = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    cargarAlertas();
    conectarWebSocket();
    return () => wsService.disconnect();
  }, []);

  async function cargarAlertas() {
    try {
      const data = await getAlerts();
      setAlerts(data?.rows || []);
    } catch (e) {
      console.log('Error alertas:', e);
    } finally {
      setLoading(false);
    }
  }

  async function conectarWebSocket() {
    wsService.connect((data) => {
      // Nueva alerta en tiempo real → agregar al inicio
      if (data?.tag || data?.probability || data?.id) {
        setAlerts(prev => [data, ...prev].slice(0, 100));
      }
    });
  }

  function formatHora(fecha: string) {
    if(!fecha) return '--:--';
    return new Date(fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }
  function formatFechaPrecisa(fecha: string) {
    if(!fecha) return '--';
    return new Date(fecha).toLocaleString('es-PE', { 
       month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  }

  // Generador de Temas Gráficos por Tipo Analítica (Fuego, Placa, Rostro...)
  function getAnalyticTheme(tag: string) {
    const t = (tag || '').toLowerCase();
    if (t.includes('fire') || t.includes('fuego') || t.includes('weapon') || t.includes('arma')) {
      return { color: '#f44336', icon: 'flame', label: 'CRÍTICA' }; 
    }
    if (t.includes('lpr') || t.includes('plate') || t.includes('placa')) {
      return { color: '#03a9f4', icon: 'car', label: 'VEHÍCULO' }; 
    }
    if (t.includes('face') || t.includes('rostro')) {
      return { color: '#4caf50', icon: 'person', label: 'ROSTRO' }; 
    }
    if (t.includes('count') || t.includes('aforo') || t.includes('people')) {
      return { color: '#9c27b0', icon: 'people', label: 'MÉTRICA' };
    }
    if (t.includes('zone') || t.includes('zona') || t.includes('intrus')) {
      return { color: '#ff9800', icon: 'warning', label: 'INTRUSIÓN' }; 
    }
    return { color: '#2196f3', icon: 'scan', label: 'ACTIVO' }; 
  }

  // Construccion del Endpoint de la Imagen basado en el JSON
  function getEvidenceUrl(item: Alert) {
    if (!domain || !item.url_evidence) return null;
    // Remueve /alice-media ya que la web usa /tracker...
    const cleanPath = item.url_evidence.replace('/alice-media', '');
    return `https://${domain}${cleanPath}`; 
  }

  // Controlador de las acciones rápidas
  async function handleQuickAction(action: string) {
     if(!selectedAlert) return;
     console.log(`Ejecutando acción: ${action} sobre alerta ID: ${selectedAlert.id}`);
     // Aquí irá la llamada fetch real al Backend para actualizar estado de confirmación
     alert(`Llamada API Simulada: ${action}`);
     setSelectedAlert(null); // cerrar modal
  }

  if (loading) {
    return <Loading />;
  }

  const styles = getStyles(isDarkMode);

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.titulo}>Alertas</Text>
          <Text style={styles.subtitulo}>Analítica Inteligente</Text>
        </View>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Feed en vivo</Text>
        </View>
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.lista}
        renderItem={({ item }) => {
          const typeTag = item.motive_categorie || item.tag || 'Detección General';
          const theme = getAnalyticTheme(typeTag);
          
          const probNum = Number(item.probability) || 0;
          const prob = probNum > 1 ? probNum : probNum * 100;
          
          const isConfirmed = item.is_confirmed === true;
          
          return (
            <TouchableOpacity 
               style={[styles.card, { borderColor: theme.color + '40' }]}
               activeOpacity={0.8}
               onPress={() => setSelectedAlert(item)}
            >
              <ImageBackground 
                  // Placeholder visual si no hay evidencia
                  source={{ uri: getEvidenceUrl(item) || 'https://images.unsplash.com/photo-1557597774-9d273605dfa9' }} 
                  style={styles.cardImage}
                  imageStyle={{ opacity: 0.8 }}
              >
                 <View style={styles.cardOverlayTop}>
                    <View style={[styles.badge, { backgroundColor: isConfirmed ? '#4caf50' : '#2196f3' }]}>
                       <Text style={styles.badgeText}>
                         {isConfirmed ? 'CONFIRMADA' : 'AUTOMÁTICA'}
                       </Text>
                    </View>
                 </View>
              </ImageBackground>
              
              <View style={styles.cardFooter}>
                 <View style={styles.footerRow}>
                    <View style={styles.footerInfo}>
                       <Text style={[styles.cardTipo, { color: theme.color }]}>
                          <Ionicons name={theme.icon as any} size={14}/> {typeTag.toUpperCase()}
                       </Text>
                       <Text style={styles.cardCam} numberOfLines={1}>
                          {item.device?.name || (item as any).Device?.name || item.deviceId || 'Cámara no especificada'}
                       </Text>
                    </View>
                    <View style={styles.footerMetrics}>
                       <Text style={styles.cardHora}>{formatHora(item.createdAt)}</Text>
                       <Text style={styles.cardProb}>{prob.toFixed(0)}%</Text>
                    </View>
                 </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.centrado}>
            <Ionicons name="shield-checkmark" size={48} color="#ffffff20" />
            <Text style={styles.vacio}>Sistema Seguro. Sin alertas recientes.</Text>
          </View>
        }
      />

      {/* MODAL DE GESTIÓN RÁPIDA DE INCIDENTES */}
      <Modal
        visible={!!selectedAlert}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedAlert(null)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Incidente: {selectedAlert?.motive_categorie || selectedAlert?.tag || 'Detección'}</Text>
              <TouchableOpacity onPress={() => setSelectedAlert(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
               {/* Evidencia Fotográfica */}
               <View style={styles.evidenceContainer}>
                  <Text style={styles.sectionTitle}>Evidencia Principal</Text>
                  <Image 
                     source={{ uri: selectedAlert ? getEvidenceUrl(selectedAlert) || undefined : undefined }} 
                     style={styles.evidenceImage}
                     resizeMode="cover"
                  />
               </View>

               {/* Datasheet (Desglose tabla) */}
               <View style={styles.dataheet}>
                  <View style={styles.dataRow}>
                     <Text style={styles.dataLabel}>Device</Text>
                     <Text style={styles.dataVal}>{selectedAlert?.device?.name || (selectedAlert as any)?.Device?.name || selectedAlert?.deviceId || 'Desconocido'}</Text>
                  </View>
                  <View style={styles.dataRow}>
                     <Text style={styles.dataLabel}>Probability</Text>
                     <Text style={styles.dataVal}>
                        {selectedAlert ? Math.round(Number(selectedAlert.probability) > 1 ? Number(selectedAlert.probability) : Number(selectedAlert.probability) * 100) : 0}%
                     </Text>
                  </View>
                  <View style={styles.dataRow}>
                     <Text style={styles.dataLabel}>Date/Time</Text>
                     <Text style={styles.dataVal}>{formatFechaPrecisa(selectedAlert?.createdAt || '')}</Text>
                  </View>
                  <View style={[styles.dataRow, { borderBottomWidth: 0 }]}>
                     <Text style={styles.dataLabel}>Incident Type</Text>
                     <Text style={[styles.dataVal, { color: selectedAlert?.is_confirmed ? '#4caf50' : '#2196f3' }]}>
                        {selectedAlert?.is_confirmed ? 'CONFIRMED ALERT' : 'AUTOMATIC ACTIVATION'}
                     </Text>
                  </View>
               </View>

               {/* Acciones del Operador */}
               <Text style={styles.sectionTitle}>Intervención Rapida</Text>
               <View style={styles.actionsBox}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4caf50' }]} onPress={() => handleQuickAction('CONFIRM')}>
                     <Ionicons name="checkmark-circle" size={20} color="#fff" />
                     <Text style={styles.actionBtnText}>CONFIRMAR ALERTA</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ff9800', marginTop: 10 }]} onPress={() => handleQuickAction('FALSE_POSITIVE')}>
                     <Ionicons name="warning" size={20} color="#fff" />
                     <Text style={styles.actionBtnText}>FALSO POSITIVO</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#f44336', marginTop: 10 }]} onPress={() => handleQuickAction('IGNORE')}>
                     <Ionicons name="close-circle" size={20} color="#fff" />
                     <Text style={styles.actionBtnText}>IGNORAR</Text>
                  </TouchableOpacity>
               </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  const modalBg = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.4)';
  const modalHeaderBg = isDark ? '#0d0d0d' : '#f3f4f6';

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
    marginBottom: 20,
  },
  titulo: { color: textPrimary, fontSize: 24, fontWeight: '700' },
  subtitulo: { color: '#2196f3', fontSize: 13, fontWeight: '500', marginTop: 2 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f4433620', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f44336' },
  liveText: { color: '#f44336', fontSize: 11, fontWeight: '700' },
  
  lista: { paddingHorizontal: 15, paddingBottom: 20 },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, gap: 15 },
  vacio: { color: textSecondary, fontSize: 14 },
  
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
  badgeRed: { backgroundColor: '#f44336' },
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
  
  cardTipo: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  cardCam: { color: textSecondary, fontSize: 14, fontWeight: '500', marginTop: 4 },
  cardHora: { color: textMuted, fontSize: 11, marginBottom: 2 },
  cardProb: { color: textPrimary, fontSize: 16, fontWeight: '800' },
  
  // MODAL STYLES
  modalBg: {
    flex: 1,
    backgroundColor: modalBg,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: bgCard,
    height: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: modalHeaderBg,
    borderBottomWidth: 1,
    borderBottomColor: borderCol
  },
  modalHeaderTitle: { color: textPrimary, fontSize: 16, fontWeight: '700', textTransform: 'uppercase' },
  closeBtn: { padding: 4 },
  modalScroll: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: { color: textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10, marginTop: 5 },
  evidenceContainer: {
    marginBottom: 20,
  },
  evidenceImage: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  dataheet: {
    backgroundColor: isDark ? '#0d0d0d' : '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: borderCol,
    padding: 15,
    marginBottom: 25,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#ffffff08' : '#e5e7eb',
  },
  dataLabel: { color: textSecondary, fontSize: 12, fontWeight: '600' },
  dataVal: { color: textPrimary, fontSize: 12, fontWeight: '600' },
  
  actionsBox: {
    marginTop: 5,
  },
  actionBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 8,
  }
});
};
