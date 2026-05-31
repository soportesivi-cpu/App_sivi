import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
  StatusBar,
  Switch,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../services/store';
import { getDevices, searchForense, getWorkspacesDevices, confirmAlert, falsePositiveAlert } from '../../services/api';

const { width } = Dimensions.get('window');

const FilterBox = ({ label, value, icon, onPress }: { label: string, value: string, icon: string, onPress: () => void }) => (
  <TouchableOpacity style={styles.filterBoxContainer} onPress={onPress}>
    <Text style={styles.filterLabel}>{label}</Text>
    <View style={styles.filterBox}>
      <Text style={styles.filterValue} numberOfLines={1}>{value}</Text>
      <Ionicons name={icon as any} size={16} color="#2E9BFF" />
    </View>
  </TouchableOpacity>
);

// Componente de Calendario Interno
const CustomCalendar = React.memo(({ dateRange, setDateRange }: any) => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeader}>
         <Text style={styles.calendarMonth}>Mayo 2026</Text>
         <View style={{ flexDirection: 'row', gap: 15 }}>
            <Ionicons name="chevron-back" size={20} color="#ffffff" />
            <Ionicons name="chevron-forward" size={20} color="#ffffff" />
         </View>
      </View>
      <View style={styles.weekDays}>
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, idx) => <Text key={`${d}-${idx}`} style={styles.weekDayText}>{d}</Text>)}
      </View>
      <View style={styles.daysGrid}>
        {[1,2,3,4,5].map(i => <View key={`empty-${i}`} style={styles.dayBox} />)}
        {days.map(d => {
          const isSelected = d >= dateRange.start && d <= dateRange.end;
          const isStart = d === dateRange.start;
          const isEnd = d === dateRange.end;
          return (
            <TouchableOpacity 
              key={d} 
              activeOpacity={0.7}
              style={[
                styles.dayBox, 
                isSelected && styles.dayBoxSelected,
                isStart && styles.dayBoxStart,
                isEnd && styles.dayBoxEnd
              ]}
              onPress={() => {
                if (d < dateRange.start || (d > dateRange.start && dateRange.end !== dateRange.start)) {
                  setDateRange({ ...dateRange, start: d, end: d, label: `Mayo ${d}` });
                } else {
                  setDateRange({ ...dateRange, end: d, label: `${dateRange.start} - ${d} Mayo` });
                }
              }}
            >
              <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>{d}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const CustomTimePicker = React.memo(({ type, currentHour, currentMin, onSelect }: any) => {
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const mins = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  
  const hourScrollRef = React.useRef<ScrollView>(null);
  const minScrollRef = React.useRef<ScrollView>(null);

  React.useEffect(() => {
    // Solo al inicio para posicionar
    const hIdx = hours.indexOf(currentHour);
    const mIdx = mins.indexOf(currentMin);
    setTimeout(() => {
      if (hIdx !== -1) hourScrollRef.current?.scrollTo({ y: hIdx * 40, animated: false });
      if (mIdx !== -1) minScrollRef.current?.scrollTo({ y: mIdx * 40, animated: false });
    }, 100);
  }, []);

  const handleScrollEnd = (unit: 'hour' | 'min', event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / 40);
    const list = unit === 'hour' ? hours : mins;
    if (index >= 0 && index < list.length) {
      onSelect(type, unit, list[index]);
    }
  };

  return (
    <View style={styles.timeScrollerContainer}>
      <Text style={styles.timeLabel}>{type === 'start' ? 'HORA INICIO' : 'HORA FIN'}</Text>
      <View style={styles.pickerRow}>
        <View style={styles.pickerScrollWrapper}>
          <ScrollView 
            ref={hourScrollRef}
            style={styles.pickerScroll} 
            showsVerticalScrollIndicator={false}
            snapToInterval={40}
            decelerationRate="fast"
            onMomentumScrollEnd={(e) => handleScrollEnd('hour', e)}
            onScrollEndDrag={(e) => handleScrollEnd('hour', e)}
            contentContainerStyle={{ paddingVertical: 40 }}
          >
            {hours.map((h, idx) => (
              <TouchableOpacity key={h} style={styles.pickerItem} onPress={() => {
                onSelect(type, 'hour', h);
                hourScrollRef.current?.scrollTo({ y: idx * 40, animated: true });
              }}>
                <Text style={[styles.pickerItemText, currentHour === h && styles.pickerItemActive]}>{h}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <Text style={styles.pickerSeparator}>:</Text>

        <View style={styles.pickerScrollWrapper}>
          <ScrollView 
            ref={minScrollRef}
            style={styles.pickerScroll} 
            showsVerticalScrollIndicator={false}
            snapToInterval={40}
            decelerationRate="fast"
            onMomentumScrollEnd={(e) => handleScrollEnd('min', e)}
            onScrollEndDrag={(e) => handleScrollEnd('min', e)}
            contentContainerStyle={{ paddingVertical: 40 }}
          >
            {mins.map((m, idx) => (
              <TouchableOpacity key={m} style={styles.pickerItem} onPress={() => {
                onSelect(type, 'min', m);
                minScrollRef.current?.scrollTo({ y: idx * 40, animated: true });
              }}>
                <Text style={[styles.pickerItemText, currentMin === m && styles.pickerItemActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
});

// Contenedor Independiente para el Modal de Hora (Aislamiento de Estado para Fluidez)
const TimePickerModalContent = ({ initialTime, onConfirm }: any) => {
  const [internalTime, setInternalTime] = React.useState(initialTime);

  const handleSelect = React.useCallback((type: 'start' | 'end', unit: 'hour' | 'min', val: string) => {
    setInternalTime((prev: any) => ({
      ...prev,
      [type === 'start' ? (unit === 'hour' ? 'startHour' : 'startMin') : (unit === 'hour' ? 'endHour' : 'endMin')]: val
    }));
  }, []);

  return (
    <View style={{ paddingVertical: 10 }}>
      <CustomTimePicker 
        type="start" 
        currentHour={internalTime.startHour}
        currentMin={internalTime.startMin}
        onSelect={handleSelect} 
      />
      <View style={{ height: 1, backgroundColor: '#ffffff05', marginVertical: 15 }} />
      <CustomTimePicker 
        type="end" 
        currentHour={internalTime.endHour}
        currentMin={internalTime.endMin}
        onSelect={handleSelect} 
      />
      <TouchableOpacity 
        style={[styles.executeBtn, { margin: 20, height: 48 }]} 
        onPress={() => onConfirm(internalTime)}
      >
         <Text style={styles.executeBtnText}>Confirmar</Text>
      </TouchableOpacity>
    </View>
  );
};

// Contenedor Independiente para el Modal de Fecha
const DatePickerModalContent = ({ initialDate, onConfirm }: any) => {
  const [internalDate, setInternalDate] = React.useState(initialDate);

  return (
    <View>
      <CustomCalendar dateRange={internalDate} setDateRange={setInternalDate} />
      <TouchableOpacity 
        style={[styles.executeBtn, { margin: 20, height: 48 }]} 
        onPress={() => onConfirm(internalDate)}
      >
         <Text style={styles.executeBtnText}>Aplicar Rango</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Tarjeta de resultado con imagen segura ────────────────────────────────
const ResultCard = React.memo(({ res, viewMode, onPress }: { res: any; viewMode: 'grid' | 'list'; onPress: () => void }) => {
  const [imgError, setImgError] = React.useState(false);
  const isGrid = viewMode === 'grid';

  return (
    <TouchableOpacity
      style={isGrid ? styles.resCard : styles.resRow}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={isGrid ? styles.resThumb : styles.resThumbSmall}>
        {!imgError && res.img ? (
          <Image
            source={{ uri: res.img }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#1A1C2C', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name={res.icon as any} size={isGrid ? 32 : 22} color={res.color || '#2E9BFF'} />
          </View>
        )}
        <View style={styles.thumbOverlay}>
          <View style={styles.camBadge}>
            <Text style={styles.camBadgeText} numberOfLines={1}>{res.cam}</Text>
          </View>
          <View style={[styles.confBadge, res.confidence >= 80 ? styles.confHigh : styles.confMid]}>
            <Text style={styles.confText}>{res.confidence}%</Text>
          </View>
        </View>
      </View>
      <View style={styles.resFooter}>
        <View style={styles.resInfoMain}>
          <Text style={styles.resName} numberOfLines={1}>{res.name}</Text>
          <Ionicons name={res.icon as any} size={16} color={res.color} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <View style={styles.resTimeRow}>
            <Ionicons name="time-outline" size={12} color="#ffffff40" />
            <Text style={styles.resTimeText} numberOfLines={1}>{res.time}</Text>
          </View>
          {res.workspace && (
            <View style={styles.workspaceBadge}>
              <Text style={styles.workspaceBadgeText}>{res.workspace}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Modal de Detalle Completo ──────────────────────────────────────────────
const ResultDetailModal = ({ item, onClose }: { item: any | null; onClose: () => void }) => {
  const [imgError, setImgError] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
    setConfirming(false);
  }, [item?.id]);

  if (!item) return null;

  const raw = item.rawItem || {};
  const plate = raw.plate || raw.plate_char || null;
  const faceName = raw.user_trained?.userName || raw.user_trained?.name || null;
  const tags = Array.isArray(raw.tags) ? raw.tags : [];
  const listName = raw.list_name || raw.listName || null;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await confirmAlert(item.id);
      Alert.alert('✅ Confirmada', 'El evento fue confirmado correctamente.');
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo confirmar el evento.');
    } finally {
      setConfirming(false);
    }
  };

  const handleFalsePositive = async () => {
    Alert.alert(
      'Falso Positivo',
      '¿Marcar este evento como falso positivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', style: 'destructive',
          onPress: async () => {
            setConfirming(true);
            try {
              await falsePositiveAlert(item.id);
              Alert.alert('⚠️ Registrado', 'Marcado como falso positivo.');
              onClose();
            } catch {
              Alert.alert('Error', 'No se pudo registrar el falso positivo.');
            } finally {
              setConfirming(false);
            }
          }
        }
      ]
    );
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.detailOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.detailSheet}>
          {/* Imagen de evidencia */}
          <View style={styles.detailImageContainer}>
            {!imgError && item.img ? (
              <Image
                source={{ uri: item.img }}
                style={styles.detailImage}
                resizeMode="cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <View style={[styles.detailImage, { backgroundColor: '#1A1C2C', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name={item.icon as any} size={60} color={item.color || '#2E9BFF'} />
                <Text style={{ color: '#ffffff40', fontSize: 12, marginTop: 10 }}>Sin imagen disponible</Text>
              </View>
            )}
            {/* Badge de tipo */}
            <View style={[styles.detailTypeBadge, { backgroundColor: item.color + '22', borderColor: item.color + '60' }]}>
              <Ionicons name={item.icon as any} size={14} color={item.color} />
              <Text style={[styles.detailTypeText, { color: item.color }]}>{item.type}</Text>
            </View>
            {/* Botón cerrar */}
            <TouchableOpacity style={styles.detailCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
            {/* Título */}
            <Text style={styles.detailTitle}>{item.name}</Text>
            <Text style={styles.detailTime}>{item.time}</Text>

            {/* Grid de metadatos */}
            <View style={styles.detailMetaGrid}>
              <DetailMetaItem icon="videocam" label="Cámara" value={item.cam} />
              <DetailMetaItem icon="bar-chart" label="Confianza" value={`${item.confidence}%`} />
              {item.workspace && <DetailMetaItem icon="business" label="Sucursal" value={item.workspace} highlight />}
              {plate && <DetailMetaItem icon="car" label="Placa" value={plate} />}
              {faceName && <DetailMetaItem icon="person" label="Persona" value={faceName} />}
              {listName && <DetailMetaItem icon="list" label="Lista" value={listName} />}
            </View>

            {/* Tags */}
            {tags.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={styles.detailSectionLabel}>ETIQUETAS</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {tags.map((t: string, i: number) => (
                    <View key={i} style={styles.tagChip}>
                      <Text style={styles.tagChipText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Botones de Acción */}
            <View style={styles.detailActions}>
              <TouchableOpacity
                style={[styles.detailActionBtn, styles.detailActionConfirm]}
                onPress={handleConfirm}
                disabled={confirming}
              >
                {confirming ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.detailActionText}>Confirmar</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.detailActionBtn, styles.detailActionFP]}
                onPress={handleFalsePositive}
                disabled={confirming}
              >
                <Ionicons name="close-circle" size={18} color="#fff" />
                <Text style={styles.detailActionText}>Falso Positivo</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const DetailMetaItem = ({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) => (
  <View style={styles.detailMetaItem}>
    <View style={styles.detailMetaIcon}>
      <Ionicons name={icon as any} size={14} color={highlight ? '#2E9BFF' : '#ffffff60'} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.detailMetaLabel}>{label}</Text>
      <Text style={[styles.detailMetaValue, highlight && { color: '#2E9BFF' }]} numberOfLines={1}>{value}</Text>
    </View>
  </View>
);

export default function SearchScreen() {
  const { activeDomain: domain, workspaceSessions } = useAppStore();
  const [selectedWorkspaces, setSelectedWorkspaces] = React.useState<string[]>(() => {
    return workspaceSessions ? workspaceSessions.map((s: any) => s.workspace) : [];
  });
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = React.useState('');
  
  // Estados de Filtros
  const [activeModal, setActiveModal] = React.useState<'analytic' | 'camera' | 'date' | 'time' | 'workspaces' | null>(null);
  const [selectedAnalytic, setSelectedAnalytic] = React.useState('Todas');
  const [selectedCameras, setSelectedCameras] = React.useState<any[]>([]);
  const [dateRange, setDateRange] = React.useState({ label: 'Mayo 10 - 17', start: 10, end: 17 });
  const [timeRange, setTimeRange] = React.useState({ startHour: '08', startMin: '00', endHour: '20', endMin: '00' });

  // Obtener Cámaras Reales de las sucursales seleccionadas
  const { data: camData, isLoading: camsLoading } = useQuery({
    queryKey: ['cameras-search', selectedWorkspaces, workspaceSessions, domain],
    queryFn: async () => {
      // Fallback a getDevices() local si no hay Gateway o no hay sucursales elegidas
      if (!workspaceSessions || workspaceSessions.length === 0 || selectedWorkspaces.length === 0) {
        return getDevices();
      }
      
      const filteredSessions = workspaceSessions.filter((s: any) => 
        selectedWorkspaces.map(w => w.toLowerCase()).includes(s.workspace?.toLowerCase())
      );
      
      if (filteredSessions.length === 0) {
        return { rows: [] };
      }
      
      try {
        const res = await getWorkspacesDevices(filteredSessions);
        let allDevices: any[] = [];
        const workspacesRes = res?.workspaces || [];
        workspacesRes.forEach((ws: any) => {
          const devices = ws.devices || [];
          devices.forEach((dev: any) => {
            allDevices.push({
              ...dev,
              id: dev.id || `dev-${Math.random()}`,
              workspaceLabel: ws.workspace,
              name: `${dev.name} (${ws.workspace})`
            });
          });
        });
        return { rows: allDevices };
      } catch (e) {
        console.warn('[API GATEWAY] Falló obtención de cámaras consolidadas, haciendo fallback local...', e);
        return getDevices();
      }
    }
  });
  const cameras = camData?.rows || [];

  // Estados de búsqueda forense real
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [loadingResults, setLoadingResults] = React.useState(false);
  const [detailItem, setDetailItem] = React.useState<any | null>(null);

  const onExecuteSearch = async () => {
    setLoadingResults(true);
    try {
      const startDay = dateRange.start.toString().padStart(2, '0');
      const endDay = dateRange.end.toString().padStart(2, '0');
      const dateFrom = `2026-05-${startDay}T${timeRange.startHour}:${timeRange.startMin}:00`;
      const dateTo = `2026-05-${endDay}T${timeRange.endHour}:${timeRange.endMin}:59`;
      
      let deviceId: string | undefined;
      if (selectedCameras.length > 0) {
        const camObj = cameras.find((c: any) => c.id === selectedCameras[0]);
        if (camObj) {
          deviceId = camObj.deviceId || camObj.id?.toString();
        }
      }

      const res = await searchForense({
        type: selectedAnalytic,
        date_from: dateFrom,
        date_to: dateTo,
        hourFrom: `${timeRange.startHour}:${timeRange.startMin}`,
        hourTo: `${timeRange.endHour}:${timeRange.endMin}`,
        device_id: deviceId,
        page: 1,
        query: searchQuery,
        selectedWorkspaces: selectedWorkspaces
      });

      setSearchResults(res?.rows || []);
    } catch (error) {
      console.error('Error en búsqueda forense real:', error);
    } finally {
      setLoadingResults(false);
    }
  };

  React.useEffect(() => {
    if (cameras.length > 0) {
      onExecuteSearch();
    }
  }, [cameras.length]);

  const filteredResults = searchResults.filter(res => {
    const matchesSearch = res.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         res.cam.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getCameraLabel = () => {
    if (selectedCameras.length === 0) return 'Todas las cámaras';
    if (selectedCameras.length === 1) {
      const cam = cameras.find((c: any) => c.id === selectedCameras[0]);
      return cam ? cam.name : '1 Cámara';
    }
    return `${selectedCameras.length} Cámaras`;
  };

  const SelectionModal = ({ title, visible, onClose, children }: { title: string, visible: boolean, onClose: () => void, children: React.ReactNode }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
           <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                 <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
           </View>
           <ScrollView style={styles.modalBody}>
              {children}
           </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* TOP BAR SIVI */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#2E9BFF20', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="shield-checkmark" size={18} color="#2E9BFF" />
          </View>
          <Text style={{ color: '#2E9BFF', fontSize: 20, fontWeight: '900', letterSpacing: -1, marginLeft: 10 }}>SIVI</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 4, marginBottom: 15 }}>
        <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '800' }}>Búsqueda Forense</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* SEARCH BAR */}
        <View style={styles.searchSection}>
           <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#ffffff90" />
              <TextInput 
                placeholder="Buscar por ID, placa, o notas..." 
                placeholderTextColor="#ffffff30"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
           </View>
        </View>

        {/* WORKSPACE MULTI-SELECT BOX */}
        {workspaceSessions && workspaceSessions.length > 1 && (
          <TouchableOpacity 
            style={styles.workspaceSelectorContainer}
            onPress={() => setActiveModal('workspaces')}
            activeOpacity={0.7}
          >
            <Text style={styles.filterLabel}>Sucursales a Buscar</Text>
            <View style={styles.workspaceSelectorBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="business" size={18} color="#2E9BFF" />
                <Text style={styles.workspaceSelectorValue} numberOfLines={1}>
                  {selectedWorkspaces.length === 0 
                    ? 'Ninguna sucursal seleccionada'
                    : selectedWorkspaces.length === workspaceSessions.length
                    ? 'Todas las sucursales'
                    : `${selectedWorkspaces.length} de ${workspaceSessions.length} sucursales`
                  }
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color="#2E9BFF" />
            </View>
          </TouchableOpacity>
        )}

        {/* FILTER GRID */}
        <View style={styles.filterGrid}>
          <View style={styles.filterRow}>
            <FilterBox 
              label="TIPO DE ANALÍTICA" 
              value={selectedAnalytic} 
              icon="chevron-down" 
              onPress={() => setActiveModal('analytic')} 
            />
            <FilterBox 
              label="CÁMARA(S)" 
              value={getCameraLabel()} 
              icon="videocam" 
              onPress={() => setActiveModal('camera')} 
            />
          </View>
          <View style={styles.filterRow}>
            <FilterBox 
              label="RANGO DE FECHA" 
              value={dateRange.label} 
              icon="calendar" 
              onPress={() => setActiveModal('date')} 
            />
            <FilterBox 
              label="RANGO DE HORA" 
              value={`${timeRange.startHour}:${timeRange.startMin} - ${timeRange.endHour}:${timeRange.endMin}`} 
              icon="time" 
              onPress={() => setActiveModal('time')} 
            />
          </View>
        </View>

        {/* MODALES DE SELECCIÓN */}
        <SelectionModal 
          title="Seleccionar Analítica" 
          visible={activeModal === 'analytic'} 
          onClose={() => setActiveModal(null)}
        >
          {['Todas', 'Face', 'LPR', 'Object', 'Action'].map(type => (
            <TouchableOpacity 
              key={type} 
              style={[styles.modalItem, selectedAnalytic === type && styles.modalItemActive]}
              onPress={() => { setSelectedAnalytic(type); setActiveModal(null); }}
            >
               <Text style={[styles.modalItemText, selectedAnalytic === type && styles.modalItemTextActive]}>{type}</Text>
               {selectedAnalytic === type && <Ionicons name="checkmark-circle" size={20} color="#2E9BFF" />}
            </TouchableOpacity>
          ))}
        </SelectionModal>

        <SelectionModal 
          title="Seleccionar Cámaras" 
          visible={activeModal === 'camera'} 
          onClose={() => setActiveModal(null)}
        >
          {camsLoading ? (
            <ActivityIndicator color="#2E9BFF" style={{ marginVertical: 20 }} />
          ) : (
            <>
              <TouchableOpacity 
                style={[styles.modalItem, selectedCameras.length === 0 && styles.modalItemActive]}
                onPress={() => setSelectedCameras([])}
              >
                 <Text style={[styles.modalItemText, selectedCameras.length === 0 && styles.modalItemTextActive]}>Todas las cámaras</Text>
                 {selectedCameras.length === 0 && <Ionicons name="checkmark-circle" size={20} color="#2E9BFF" />}
              </TouchableOpacity>
              {cameras.map((cam: any) => {
                const isSelected = selectedCameras.includes(cam.id);
                return (
                  <TouchableOpacity 
                    key={cam.id} 
                    style={[styles.modalItem, isSelected && styles.modalItemActive]}
                    onPress={() => {
                      if (isSelected) setSelectedCameras(selectedCameras.filter(id => id !== cam.id));
                      else setSelectedCameras([...selectedCameras, cam.id]);
                    }}
                  >
                     <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>{cam.name}</Text>
                     {isSelected && <Ionicons name="checkmark-circle" size={20} color="#2E9BFF" />}
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </SelectionModal>

        <SelectionModal 
          title="Rango de Fecha (Mayo 2026)" 
          visible={activeModal === 'date'} 
          onClose={() => setActiveModal(null)}
        >
          <DatePickerModalContent 
            initialDate={dateRange} 
            onConfirm={(val: any) => { setDateRange(val); setActiveModal(null); }} 
          />
        </SelectionModal>

        <SelectionModal 
          title="Seleccionar Horario" 
          visible={activeModal === 'time'} 
          onClose={() => setActiveModal(null)}
        >
          <TimePickerModalContent 
            initialTime={timeRange} 
            onConfirm={(val: any) => { setTimeRange(val); setActiveModal(null); }} 
          />
        </SelectionModal>

        <SelectionModal 
          title="Seleccionar Sucursales" 
          visible={activeModal === 'workspaces'} 
          onClose={() => setActiveModal(null)}
        >
          {workspaceSessions && (
            <>
              {/* Opción Seleccionar Todas */}
              <TouchableOpacity 
                style={[
                  styles.modalItem, 
                  selectedWorkspaces.length === workspaceSessions.length && styles.modalItemActive
                ]}
                onPress={() => {
                  if (selectedWorkspaces.length === workspaceSessions.length) {
                    setSelectedWorkspaces([]);
                  } else {
                    setSelectedWorkspaces(workspaceSessions.map((s: any) => s.workspace));
                  }
                }}
              >
                <Text style={[
                  styles.modalItemText, 
                  selectedWorkspaces.length === workspaceSessions.length && styles.modalItemTextActive
                ]}>Seleccionar Todas</Text>
                <Switch
                  value={selectedWorkspaces.length === workspaceSessions.length}
                  onValueChange={() => {
                    if (selectedWorkspaces.length === workspaceSessions.length) {
                      setSelectedWorkspaces([]);
                    } else {
                      setSelectedWorkspaces(workspaceSessions.map((s: any) => s.workspace));
                    }
                  }}
                  trackColor={{ false: '#333', true: '#2E9BFF' }}
                  thumbColor="#fff"
                />
              </TouchableOpacity>
              
              <View style={{ height: 1, backgroundColor: '#ffffff05', marginVertical: 10 }} />

              {/* Lista de Workspaces individuales */}
              {workspaceSessions.map((s: any) => {
                const isSelected = selectedWorkspaces.map(w => w.toLowerCase()).includes(s.workspace?.toLowerCase());
                return (
                  <TouchableOpacity 
                    key={s.workspace} 
                    style={[styles.modalItem, isSelected && styles.modalItemActive]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedWorkspaces(selectedWorkspaces.filter(w => w.toLowerCase() !== s.workspace.toLowerCase()));
                      } else {
                        setSelectedWorkspaces([...selectedWorkspaces, s.workspace]);
                      }
                    }}
                  >
                     <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>{s.workspace}</Text>
                     <Switch
                       value={isSelected}
                       onValueChange={() => {
                         if (isSelected) {
                           setSelectedWorkspaces(selectedWorkspaces.filter(w => w.toLowerCase() !== s.workspace.toLowerCase()));
                         } else {
                           setSelectedWorkspaces([...selectedWorkspaces, s.workspace]);
                         }
                       }}
                       trackColor={{ false: '#333', true: '#2E9BFF' }}
                       thumbColor="#fff"
                     />
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </SelectionModal>

        {/* PRIMARY ACTION */}
        <TouchableOpacity 
          style={styles.executeBtn}
          onPress={onExecuteSearch}
          disabled={loadingResults}
        >
          {loadingResults ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={styles.executeBtnText}>Ejecutar Búsqueda</Text>
            </>
          )}
        </TouchableOpacity>

        {/* RESULTS HEADER */}
        <View style={styles.resultsHeader}>
           <Text style={styles.resultsTitle}>Resultados <Text style={{color: '#ffffff40'}}>({filteredResults.length})</Text></Text>
           <View style={styles.viewToggle}>
              <TouchableOpacity 
                style={[styles.toggleBtn, viewMode === 'grid' && styles.toggleBtnActive]}
                onPress={() => setViewMode('grid')}
              >
                 <Ionicons name="grid" size={16} color={viewMode === 'grid' ? "#2E9BFF" : "#ffffff40"} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
                onPress={() => setViewMode('list')}
              >
                 <Ionicons name="list" size={16} color={viewMode === 'list' ? "#2E9BFF" : "#ffffff40"} />
              </TouchableOpacity>
           </View>
        </View>

        {/* RESULTS GRID/LIST */}
        {loadingResults ? (
          <View style={{ paddingVertical: 50, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#2E9BFF" />
            <Text style={{ color: '#ffffff60', fontSize: 13, fontWeight: '600', marginTop: 15 }}>Buscando detecciones...</Text>
          </View>
        ) : filteredResults.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="search-outline" size={48} color="#ffffff20" />
            <Text style={{ color: '#ffffff40', fontSize: 14, fontWeight: '600', marginTop: 12 }}>No se encontraron resultados</Text>
          </View>
        ) : (
          <View style={viewMode === 'grid' ? styles.resultsGrid : styles.resultsList}>
            {filteredResults.map(res => (
              <ResultCard
                key={res.id}
                res={res}
                viewMode={viewMode}
                onPress={() => setDetailItem(res)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* MODAL DETALLE DE RESULTADO */}
      <ResultDetailModal
        item={detailItem}
        onClose={() => setDetailItem(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 50,
    paddingBottom: 8, 
    borderBottomWidth: 0,
    backgroundColor: '#000000'
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { color: '#ffffff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  avatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', borderWidth: 2, borderColor: '#2E9BFF40' },
  avatarImg: { width: '100%', height: '100%' },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 120 },
  
  searchSection: { marginTop: 24, marginBottom: 15 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1C2C', height: 52, borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#ffffff15' },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, marginLeft: 10, fontWeight: '500' },

  filterGrid: { gap: 12, marginBottom: 20 },
  filterRow: { flexDirection: 'row', gap: 12 },
  filterBoxContainer: { flex: 1, gap: 8 },
  filterLabel: { color: '#E0E0E0', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginLeft: 2, textTransform: 'uppercase' },
  filterBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1C2C', height: 48, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#ffffff10' },
  filterValue: { color: '#fff', fontSize: 13, fontWeight: '700' },

  workspaceSelectorContainer: { marginBottom: 15, gap: 8 },
  workspaceSelectorBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1C2C', height: 48, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#ffffff10' },
  workspaceSelectorValue: { color: '#fff', fontSize: 13, fontWeight: '700' },

  executeBtn: { backgroundColor: '#2E9BFF', height: 58, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 25, shadowColor: '#2E9BFF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  executeBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 10 },
  resultsTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  viewToggle: { flexDirection: 'row', backgroundColor: '#111112', borderRadius: 10, padding: 3, borderWidth: 1, borderColor: '#ffffff10' },
  toggleBtn: { padding: 8, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#1A1C2C' },

  resultsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  resultsList: { gap: 12 },
  resRow: { flexDirection: 'row', backgroundColor: '#1A1C2C', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#ffffff10', height: 90 },
  resCard: { width: (width - 44) / 2, backgroundColor: '#1A1C2C', borderRadius: 18, marginBottom: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#ffffff10' },
  resThumb: { width: '100%', aspectRatio: 16 / 9 },
  resThumbSmall: { width: 120, height: '100%' },
  thumbOverlay: { ...StyleSheet.absoluteFillObject, padding: 8, justifyContent: 'space-between', flexDirection: 'row' },
  camBadge: { backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, height: 20, borderWidth: 0.5, borderColor: '#ffffff20' },
  camBadgeText: { color: '#2E9BFF', fontSize: 9, fontWeight: '900' },
  confBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, height: 20 },
  confHigh: { backgroundColor: '#4CAF50' },
  confMid: { backgroundColor: '#FF9800' },
  confText: { color: '#fff', fontSize: 9, fontWeight: '900' },

  resFooter: { flex: 1, padding: 14, justifyContent: 'center', gap: 4 },
  resInfoMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resName: { color: '#fff', fontSize: 14, fontWeight: '800', flex: 1, marginRight: 5 },
  resTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  resTimeText: { color: '#ffffff', fontSize: 10, fontWeight: '600' },

  // Estilos de Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#121214', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40, maxHeight: '80%', borderWidth: 1, borderColor: '#ffffff10' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, borderBottomWidth: 1, borderBottomColor: '#ffffff08' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  modalBody: { paddingHorizontal: 10 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, marginHorizontal: 10, borderRadius: 15, marginBottom: 5 },
  modalItemActive: { backgroundColor: '#2E9BFF15' },
  modalItemText: { color: '#ffffff80', fontSize: 15, fontWeight: '600' },
  modalItemTextActive: { color: '#2E9BFF', fontWeight: '800' },
  timeInput: { backgroundColor: '#1A1C2C', color: '#fff', padding: 15, borderRadius: 12, fontSize: 18, fontWeight: '800', textAlign: 'center', borderWidth: 1, borderColor: '#ffffff15' },

  // Estilos de Calendario
  calendarContainer: { padding: 15, backgroundColor: '#000000', borderRadius: 20 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 5 },
  calendarMonth: { color: '#fff', fontSize: 18, fontWeight: '900' },
  weekDays: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  weekDayText: { color: '#ffffff40', fontSize: 12, fontWeight: '800', width: (width - 80) / 7, textAlign: 'center' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayBox: { width: (width - 80) / 7, height: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  dayBoxSelected: { backgroundColor: '#2E9BFF30' },
  dayBoxStart: { backgroundColor: '#2E9BFF', borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  dayBoxEnd: { backgroundColor: '#2E9BFF', borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  dayText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  dayTextActive: { color: '#fff', fontWeight: '900' },

  // Estilos de Time Picker
  timeScrollerContainer: { paddingHorizontal: 20 },
  timeLabel: { color: '#ffffff40', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 15 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15 },
  pickerScroll: { height: 120, width: 60 },
  pickerScrollWrapper: { height: 120, width: 60, overflow: 'hidden' },
  pickerItem: { height: 40, justifyContent: 'center', alignItems: 'center' },
  pickerItemText: { color: '#ffffff40', fontSize: 20, fontWeight: '600' },
  pickerItemActive: { color: '#2E9BFF', fontSize: 26, fontWeight: '900' },
  pickerSeparator: { color: '#ffffff20', fontSize: 24, fontWeight: '900', marginTop: -5 },

  // Badge de sucursal en tarjetas
  workspaceBadge: { backgroundColor: '#2E9BFF15', borderColor: '#2E9BFF30', borderWidth: 0.5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  workspaceBadgeText: { color: '#2E9BFF', fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Modal de Detalle de Resultado
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  detailSheet: { backgroundColor: '#0D0D0F', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', borderWidth: 1, borderColor: '#ffffff08', overflow: 'hidden' },
  detailImageContainer: { width: '100%', height: 220, backgroundColor: '#1A1C2C', position: 'relative' },
  detailImage: { width: '100%', height: '100%' },
  detailTypeBadge: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  detailTypeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  detailCloseBtn: { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(0,0,0,0.6)', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  detailBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  detailTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 4 },
  detailTime: { color: '#ffffff50', fontSize: 13, fontWeight: '600', marginBottom: 20 },
  detailSectionLabel: { color: '#ffffff40', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  detailMetaGrid: { gap: 12, marginBottom: 20 },
  detailMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1A1C2C', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#ffffff08' },
  detailMetaIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#ffffff08', justifyContent: 'center', alignItems: 'center' },
  detailMetaLabel: { color: '#ffffff40', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  detailMetaValue: { color: '#fff', fontSize: 14, fontWeight: '700' },
  tagChip: { backgroundColor: '#2E9BFF15', borderWidth: 1, borderColor: '#2E9BFF30', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  tagChipText: { color: '#2E9BFF', fontSize: 12, fontWeight: '700' },
  detailActions: { flexDirection: 'row', gap: 12, marginBottom: 40, marginTop: 8 },
  detailActionBtn: { flex: 1, height: 52, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  detailActionConfirm: { backgroundColor: '#4CAF50' },
  detailActionFP: { backgroundColor: '#F44336' },
  detailActionText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
