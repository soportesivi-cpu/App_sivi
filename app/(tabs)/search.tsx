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
  Alert,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../services/store';
import { getDevices, searchForense, getWorkspacesDevices, confirmAlert, falsePositiveAlert } from '../../services/api';
import { Colors, Layout } from '../../constants/theme';

const ANALYTIC_TRANSLATIONS: Record<string, string> = {
  'Todas': 'Todas',
  'Face': 'Rostro',
  'LPR': 'Placas (LPR)',
  'Object': 'Objetos',
  'Action': 'Acciones'
};

const { width } = Dimensions.get('window');

const FilterBox = ({ label, value, icon, onPress }: { label: string, value: string, icon: string, onPress: () => void }) => {
  const { isDarkMode } = useAppStore();
  const styles = getStyles(isDarkMode);
  return (
    <TouchableOpacity style={styles.filterBoxContainer} onPress={onPress}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterBox}>
        <Text style={styles.filterValue} numberOfLines={1}>{value}</Text>
        <Ionicons name={icon as any} size={16} color={Colors.brand.primary} />
      </View>
    </TouchableOpacity>
  );
};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function formatDateRangeLabel(start: Date, end: Date): string {
  const startDay = start.getDate();
  const startMonth = MONTH_NAMES[start.getMonth()];
  const startYear = start.getFullYear();

  const endDay = end.getDate();
  const endMonth = MONTH_NAMES[end.getMonth()];
  const endYear = end.getFullYear();

  if (startYear === endYear) {
    if (start.getMonth() === end.getMonth()) {
      if (startDay === endDay) {
        return `${startDay} de ${startMonth}, ${startYear}`;
      }
      return `${startDay} - ${endDay} de ${startMonth}, ${startYear}`;
    }
    return `${startDay} de ${startMonth} - ${endDay} de ${endMonth}, ${startYear}`;
  }
  return `${startDay} de ${startMonth}, ${startYear} - ${endDay} de ${endMonth}, ${endYear}`;
}

// Componente de Calendario Interno
const CustomCalendar = React.memo(({ dateRange, setDateRange }: any) => {
  const { isDarkMode } = useAppStore();
  const styles = getStyles(isDarkMode);
  const [viewDate, setViewDate] = React.useState(() => {
    return new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = MONTH_NAMES[month];

  const numDays = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const emptyDays = Array.from({ length: firstDayIndex }, (_, i) => i);
  const days = Array.from({ length: numDays }, (_, i) => i + 1);

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const clickedDate = new Date(year, month, day);
    const startStr = dateRange.start.getTime();
    const endStr = dateRange.end.getTime();

    if (startStr === endStr) {
      if (clickedDate >= dateRange.start) {
        setDateRange({
          start: dateRange.start,
          end: clickedDate,
          label: formatDateRangeLabel(dateRange.start, clickedDate)
        });
      } else {
        setDateRange({
          start: clickedDate,
          end: clickedDate,
          label: formatDateRangeLabel(clickedDate, clickedDate)
        });
      }
    } else {
      setDateRange({
        start: clickedDate,
        end: clickedDate,
        label: formatDateRangeLabel(clickedDate, clickedDate)
      });
    }
  };

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeader}>
         <Text style={styles.calendarMonth}>{`${monthName} ${year}`}</Text>
         <View style={{ flexDirection: 'row', gap: 15 }}>
            <TouchableOpacity onPress={handlePrevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
               <Ionicons name="chevron-back" size={20} color={isDarkMode ? '#ffffff' : '#111827'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
               <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#ffffff' : '#111827'} />
            </TouchableOpacity>
         </View>
      </View>
      <View style={styles.weekDays}>
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, idx) => <Text key={`${d}-${idx}`} style={styles.weekDayText}>{d}</Text>)}
      </View>
      <View style={styles.daysGrid}>
        {emptyDays.map(i => <View key={`empty-${i}`} style={styles.dayBox} />)}
        {days.map(d => {
          const currentDayDate = new Date(year, month, d);
          const currentDayTime = currentDayDate.getTime();
          const startTime = dateRange.start.getTime();
          const endTime = dateRange.end.getTime();

          const isSelected = currentDayTime >= startTime && currentDayTime <= endTime;
          const isStart = currentDayTime === startTime;
          const isEnd = currentDayTime === endTime;

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
              onPress={() => handleSelectDay(d)}
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
  const { isDarkMode } = useAppStore();
  const styles = getStyles(isDarkMode);
  const adjustTime = (unit: 'hour' | 'min', action: 'up' | 'down') => {
    let currentVal = parseInt(unit === 'hour' ? currentHour : currentMin, 10);
    const limit = unit === 'hour' ? 24 : 60;
    const step = 1;

    if (action === 'up') {
      currentVal = (currentVal + step) % limit;
    } else {
      currentVal = (currentVal - step + limit) % limit;
    }

    const newVal = currentVal.toString().padStart(2, '0');
    onSelect(type, unit, newVal);
  };

  return (
    <View style={styles.timePickerRowCompact}>
      <Text style={styles.timeLabelCompact}>
        {type === 'start' ? 'HORA INICIO' : 'HORA FIN'}
      </Text>
      <View style={styles.timeSelectorGroup}>
        {/* Selector de Horas */}
        <View style={styles.timeUnitCol}>
          <TouchableOpacity onPress={() => adjustTime('hour', 'up')} style={styles.arrowBtn}>
            <Ionicons name="chevron-up" size={18} color={Colors.brand.primary} />
          </TouchableOpacity>
          <Text style={styles.timeValueText}>{currentHour}</Text>
          <TouchableOpacity onPress={() => adjustTime('hour', 'down')} style={styles.arrowBtn}>
            <Ionicons name="chevron-down" size={18} color={Colors.brand.primary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.timeColon}>:</Text>

        {/* Selector de Minutos */}
        <View style={styles.timeUnitCol}>
          <TouchableOpacity onPress={() => adjustTime('min', 'up')} style={styles.arrowBtn}>
            <Ionicons name="chevron-up" size={18} color={Colors.brand.primary} />
          </TouchableOpacity>
          <Text style={styles.timeValueText}>{currentMin}</Text>
          <TouchableOpacity onPress={() => adjustTime('min', 'down')} style={styles.arrowBtn}>
            <Ionicons name="chevron-down" size={18} color={Colors.brand.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

// Contenedor Independiente para el Modal de Hora (Aislamiento de Estado para Fluidez)
const TimePickerModalContent = ({ initialTime, onConfirm }: any) => {
  const { isDarkMode } = useAppStore();
  const styles = getStyles(isDarkMode);
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
      <View style={{ height: 1, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', marginVertical: 15 }} />
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
  const { isDarkMode } = useAppStore();
  const styles = getStyles(isDarkMode);
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

// ─── Modal de Selección Genérico ──────────────────────────────────────────
const SelectionModal = React.memo(({ title, visible, onClose, children }: { title: string, visible: boolean, onClose: () => void, children: React.ReactNode }) => {
  const { isDarkMode } = useAppStore();
  const styles = getStyles(isDarkMode);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
           <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                 <Ionicons name="close" size={24} color={isDarkMode ? '#ffffff' : '#111827'} />
              </TouchableOpacity>
           </View>
           <ScrollView style={styles.modalBody}>
              {children}
           </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
});

// ─── Tarjeta de resultado con imagen segura ────────────────────────────────
const ResultCard = React.memo(({ res, viewMode, onPress }: { res: any; viewMode: 'grid' | 'list'; onPress: () => void }) => {
  const { isDarkMode } = useAppStore();
  const styles = getStyles(isDarkMode);
  const theme = isDarkMode ? Colors.dark : Colors.light;
  const [imgError, setImgError] = React.useState(false);
  const isGrid = viewMode === 'grid';
  const detection = extractObjectDetection(res.rawItem || res);

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
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.surfaceSecondary, justifyContent: 'center', alignItems: 'center' }]}>
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
        {!isGrid && (
          <View style={styles.resInfoMain}>
            <Text style={styles.resName} numberOfLines={1}>{res.name}</Text>
            <Ionicons name={res.icon as any} size={16} color={res.color} />
          </View>
        )}
        {detection && (
          <Text style={{ color: detection.color, fontSize: 11.5, fontWeight: '700', marginTop: 1, marginBottom: 2 }} numberOfLines={1}>
            {detection.icon} {detection.value}
          </Text>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <View style={styles.resTimeRow}>
            <Ionicons name="time-outline" size={12} color={isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
            <Text style={styles.resTimeText} numberOfLines={1}>{res.time}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

function extractFaceName(item: any): string | null {
  if (item.user_trained) {
    const name = item.user_trained.userName || item.user_trained.name;
    if (name && name.trim()) return name.trim();
  }
  
  const tag = item.tag ? item.tag.replace(/^,\s*/, '').trim() : '';
  if (!tag) return null;

  const motive = (item.motive_categorie || '').toLowerCase();
  const nameCat = (item.name_categorie || '').toLowerCase();
  const tagLower = tag.toLowerCase();

  const isRostro = motive.includes('face') || motive.includes('rostro') ||
                   nameCat.includes('face') || nameCat.includes('rostro') ||
                   tagLower.includes('face') || tagLower.includes('rostro') ||
                   !!item.face_detected_url;

  if (isRostro) {
    const ignored = ['person', 'face', 'rostro', 'unknown', 'alert', 'tracker', 'smart_event', 'smartevent'];
    if (!ignored.includes(tagLower)) {
      return tag;
    }
  }
  return null;
}

function extractPlate(item: any): string | null {
  if (item.plate && item.plate.trim()) return item.plate.trim();
  if (item.plate_char && item.plate_char.trim()) return item.plate_char.trim();

  const tag = item.tag ? item.tag.trim() : '';
  if (!tag) return null;

  const motive = (item.motive_categorie || '').toLowerCase();
  const nameCat = (item.name_categorie || '').toLowerCase();
  const tagLower = tag.toLowerCase();

  const isVehiculo = motive.includes('lpr') || motive.includes('plate') || motive.includes('placa') || motive.includes('car') || motive.includes('vehiculo') ||
                     nameCat.includes('lpr') || nameCat.includes('plate') || nameCat.includes('placa') || nameCat.includes('car') || nameCat.includes('vehiculo') ||
                     tagLower.includes('lpr') || tagLower.includes('plate') || tagLower.includes('placa') || tagLower.includes('car') || tagLower.includes('vehiculo');

  if (isVehiculo) {
    const ignored = ['car', 'vehicle', 'vehiculo', 'lpr', 'plate', 'placa', 'alert', 'tracker', 'smart_event', 'smartevent'];
    if (!ignored.includes(tagLower)) {
      return tag;
    }
  }
  return null;
}

type ObjectDetectionInfo = {
  label: string;
  value: string;
  color: string;
  icon: string;
};

function extractObjectDetection(item: any): ObjectDetectionInfo | null {
  // 1. Si es rostro conocido
  const faceName = extractFaceName(item);
  if (faceName) {
    return {
      label: 'PERSONA IDENTIFICADA',
      value: faceName.toUpperCase(),
      color: '#4caf50', // Verde
      icon: '👤'
    };
  }

  // 2. Si es placa LPR
  const plate = extractPlate(item);
  if (plate) {
    return {
      label: 'PLACA DETECTADA',
      value: plate.toUpperCase(),
      color: '#ffcf8f', // Beige
      icon: '🚗'
    };
  }

  // 3. Fallback a Detección de Objetos Genéricos o Amenazas
  if (!item.tag) return null;
  const tagLower = item.tag.toLowerCase();

  // Caso: Armas / Amenazas Críticas
  if (tagLower === 'weapon' || tagLower === 'gun' || tagLower === 'pistol' || tagLower === 'arma') {
    return {
      label: 'AMENAZA DETECTADA',
      value: 'ARMA DE FUEGO',
      color: '#f44336', // Rojo Crítico
      icon: '🔫'
    };
  }

  // Caso: Fuego / Humo
  if (tagLower === 'fire' || tagLower === 'smoke' || tagLower === 'fuego') {
    return {
      label: 'AMENAZA DETECTADA',
      value: 'INCENDIO / FUEGO',
      color: '#f44336', // Rojo Crítico
      icon: '🔥'
    };
  }

  // Caso: Persona Genérica
  if (tagLower === 'person' || tagLower === 'persona') {
    return {
      label: 'OBJETO DETECTADO',
      value: 'PERSONA',
      color: '#2E9BFF', // Azul SIVI
      icon: '👤'
    };
  }

  // Caso: Vehículo Genérico
  if (tagLower === 'car' || tagLower === 'truck' || tagLower === 'vehicle' || tagLower === 'moto') {
    return {
      label: 'OBJETO DETECTADO',
      value: 'VEHÍCULO',
      color: '#03a9f4', // Celeste
      icon: '🚗'
    };
  }

  return null;
}

// ─── Modal de Detalle Completo ──────────────────────────────────────────────
const ResultDetailModal = ({ item, onClose }: { item: any | null; onClose: () => void }) => {
  const { isDarkMode } = useAppStore();
  const styles = getStyles(isDarkMode);
  const theme = isDarkMode ? Colors.dark : Colors.light;
  const [imgError, setImgError] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
    setConfirming(false);
  }, [item?.id]);

  if (!item) return null;

  const raw = item.rawItem || {};
  const plate = extractPlate(raw);
  const faceName = extractFaceName(raw);
  const tags = Array.isArray(raw.tags) ? raw.tags : [];
  const listName = raw.list_name || raw.listName || null;

  let vinfoObj: any = {};
  if (raw.vinfo) {
    try {
      vinfoObj = typeof raw.vinfo === 'string' ? JSON.parse(raw.vinfo) : raw.vinfo;
    } catch (e) {
      vinfoObj = {};
    }
  }
  const smartEventName = 
    vinfoObj?.name || 
    vinfoObj?.alarm_name || 
    vinfoObj?.alarmName || 
    raw.motive_categorie || 
    raw.name_categorie || 
    raw.title || 
    null;

  const isConfirmed = raw.is_confirmed === true || raw.isConfirmed === true;
  const isFP = raw.is_fp === true || raw.isFp === true;
  const isIgnored = raw.is_ignored === true || raw.isIgnored === true || raw.state === 'ignored';

  let statusLabel = 'Pendiente';
  let statusDetail = 'Este evento aún no ha sido atendido.';
  let statusColor = '#2E9BFF';
  let statusIcon = 'time-outline';

  if (isConfirmed) {
    statusLabel = 'Alerta Confirmada';
    statusDetail = 'El operador ha verificado y confirmado este evento.';
    statusColor = '#4CAF50';
    statusIcon = 'checkmark-circle';
  } else if (isFP) {
    statusLabel = 'Falso Positivo';
    statusDetail = 'El operador marcó este evento como falso positivo.';
    statusColor = '#FF9800';
    statusIcon = 'close-circle';
  } else if (isIgnored) {
    statusLabel = 'Alerta Ignorada';
    statusDetail = 'El operador decidió ignorar este evento.';
    statusColor = '#9E9E9E';
    statusIcon = 'eye-off-outline';
  }

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
              <View style={[styles.detailImage, { backgroundColor: theme.surfaceSecondary, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name={item.icon as any} size={60} color={item.color || '#2E9BFF'} />
                <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 10 }}>Sin imagen disponible</Text>
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
              {smartEventName && <DetailMetaItem icon="flash" label="Smart Event" value={smartEventName} />}
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

            {/* Estado de Resolución/Atención */}
            <View style={{ marginBottom: 40, marginTop: 10 }}>
              <Text style={styles.detailSectionLabel}>ESTADO DE ATENCIÓN</Text>
              <View style={{
                backgroundColor: statusColor + '15',
                borderColor: statusColor + '40',
                borderWidth: 1,
                padding: 14,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12
              }}>
                <Ionicons name={statusIcon as any} size={22} color={statusColor} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: statusColor, fontSize: 15, fontWeight: '800' }}>{statusLabel}</Text>
                  <Text style={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontSize: 13.5, marginTop: 3, lineHeight: 18 }}>{statusDetail}</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const DetailMetaItem = ({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) => {
  const { isDarkMode } = useAppStore();
  const styles = getStyles(isDarkMode);
  return (
    <View style={styles.detailMetaItem}>
      <View style={styles.detailMetaIcon}>
        <Ionicons name={icon as any} size={14} color={highlight ? Colors.brand.primary : (isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)')} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailMetaLabel}>{label}</Text>
        <Text style={[styles.detailMetaValue, highlight && { color: Colors.brand.primary }]} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
};

export default function SearchScreen() {
  const { activeDomain: domain, workspaceSessions, activeWorkspace, impersonatedWorkspace, isDarkMode } = useAppStore();
  const styles = getStyles(isDarkMode);
  const theme = isDarkMode ? Colors.dark : Colors.light;
  const currentWs = impersonatedWorkspace || activeWorkspace;
  const currentWsName = currentWs?.id || currentWs?.workspace || '';

  const selectedWorkspaces = React.useMemo(() => {
    return currentWsName ? [currentWsName] : [];
  }, [currentWsName]);
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = React.useState('');
  
  // Estados de Filtros
  const [activeModal, setActiveModal] = React.useState<'analytic' | 'camera' | 'date' | 'time' | 'workspaces' | null>(null);
  const [selectedAnalytic, setSelectedAnalytic] = React.useState('Todas');
  const [selectedCameras, setSelectedCameras] = React.useState<any[]>([]);
  const [dateRange, setDateRange] = React.useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      start,
      end,
      label: formatDateRangeLabel(start, end)
    };
  });
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
              name: dev.name
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

  // Estados de búsqueda forense real y paginación
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [loadingResults, setLoadingResults] = React.useState(false);
  const [detailItem, setDetailItem] = React.useState<any | null>(null);
  const [page, setPage] = React.useState(1);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);

  const onExecuteSearch = async (targetPage: number = 1) => {
    if (targetPage === 1) {
      setLoadingResults(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const formatISODate = (d: Date) => {
        const yyyy = d.getFullYear();
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const dd = d.getDate().toString().padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      const dateFrom = `${formatISODate(dateRange.start)}T${timeRange.startHour}:${timeRange.startMin}:00`;
      
      let dateTo: string;
      const now = new Date();
      if (formatISODate(dateRange.end) === formatISODate(now)) {
        const currentHour = now.getHours().toString().padStart(2, '0');
        const currentMin = now.getMinutes().toString().padStart(2, '0');
        dateTo = `${formatISODate(dateRange.end)}T${currentHour}:${currentMin}:59`;
      } else {
        dateTo = `${formatISODate(dateRange.end)}T${timeRange.endHour}:${timeRange.endMin}:59`;
      }
      
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
        page: targetPage,
        query: searchQuery,
        selectedWorkspaces: selectedWorkspaces
      });

      const newRows = res?.rows || [];
      const totalPages = res?.pages || 1;

      if (targetPage === 1) {
        setSearchResults(newRows);
      } else {
        setSearchResults(prev => [...prev, ...newRows]);
      }

      setPage(targetPage);

      const apiHasMore = res?.hasMore ?? (newRows.length >= 30);
      if (!apiHasMore || newRows.length === 0) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (error) {
      console.error('Error en búsqueda forense real:', error);
    } finally {
      setLoadingResults(false);
      setLoadingMore(false);
    }
  };


  React.useEffect(() => {
    if (cameras.length > 0) {
      onExecuteSearch(1);
    }
  }, [cameras.length]);

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

  const filteredResults = searchResults.filter(res => {
    const queryLimpia = normalizarTexto(searchQuery);
    const palabrasBusqueda = queryLimpia.split(/\s+/).filter(p => p.length > 0);

    if (palabrasBusqueda.length === 0) return true;

    const faceName = extractFaceName(res.rawItem || res) || '';
    const plate = extractPlate(res.rawItem || res) || '';
    const tag = res.rawItem?.tag || '';
    const name = res.name || '';
    const cam = res.cam || '';

    const detection = extractObjectDetection(res.rawItem || res);
    const detectionText = detection ? `${detection.label} ${detection.value}` : '';
    const contenidoTarjeta = normalizarTexto(`${name} ${cam} ${faceName} ${plate} ${tag} ${detectionText}`);

    return palabrasBusqueda.every(palabra => contenidoTarjeta.includes(palabra));
  });

  const renderItem = React.useCallback(({ item }: { item: any }) => (
    <ResultCard
      res={item}
      viewMode={viewMode}
      onPress={() => setDetailItem(item)}
    />
  ), [viewMode]);

  const renderFooter = React.useCallback(() => {
    if (loadingMore) {
      return (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={Colors.brand.primary} />
        </View>
      );
    }
    if (!hasMore && filteredResults.length > 0) {
      return (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <Text style={{ color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', fontSize: 12, fontWeight: '600' }}>— Fin de los resultados —</Text>
        </View>
      );
    }
    return null;
  }, [loadingMore, hasMore, filteredResults.length]);

  const renderEmpty = React.useCallback(() => {
    if (loadingResults) {
      return (
        <View style={{ paddingVertical: 50, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
          <Text style={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontSize: 13, fontWeight: '600', marginTop: 15 }}>Buscando detecciones...</Text>
        </View>
      );
    }
    return (
      <View style={{ paddingVertical: 60, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="search-outline" size={48} color={isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
        <Text style={{ color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 14, fontWeight: '600', marginTop: 12 }}>No se encontraron resultados</Text>
      </View>
    );
  }, [loadingResults]);

  const getCameraLabel = () => {
    if (selectedCameras.length === 0) return 'Todas las cámaras';
    if (selectedCameras.length === 1) {
      const cam = cameras.find((c: any) => c.id === selectedCameras[0]);
      return cam ? cam.name : '1 Cámara';
    }
    return `${selectedCameras.length} Cámaras`;
  };

  return (
    <View style={styles.container}>
      {/* TOP BAR SIVI */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.brand.celeste + '20', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.brand.celeste} />
          </View>
          <Text style={{ color: Colors.brand.celeste, fontSize: 20, fontWeight: '900', letterSpacing: -1, marginLeft: 10 }}>SIVI</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 4, marginBottom: 15 }}>
        <Text style={{ color: isDarkMode ? '#ffffff' : '#111827', fontSize: 26, fontWeight: '800' }}>Búsqueda Forense</Text>
      </View>

      <FlatList
        data={loadingResults ? [] : filteredResults}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        key={viewMode}
        columnWrapperStyle={viewMode === 'grid' ? styles.resultsGrid : undefined}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
            {/* SEARCH BAR */}
            <View style={styles.searchSection}>
               <View style={styles.searchBar}>
                  <Ionicons name="search" size={18} color={theme.inputPlaceholder} />
                  <TextInput 
                    placeholder="Buscar por ID, placa, o notas..." 
                    placeholderTextColor={theme.inputPlaceholder}
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
               </View>
            </View>

            {/* FILTER GRID */}
            <View style={styles.filterGrid}>
              <View style={styles.filterRow}>
                <FilterBox 
                  label="TIPO DE ANALÍTICA" 
                  value={ANALYTIC_TRANSLATIONS[selectedAnalytic] || selectedAnalytic} 
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
                   <Text style={[styles.modalItemText, selectedAnalytic === type && styles.modalItemTextActive]}>
                     {ANALYTIC_TRANSLATIONS[type] || type}
                   </Text>
                   {selectedAnalytic === type && <Ionicons name="checkmark-circle" size={20} color={Colors.brand.primary} />}
                </TouchableOpacity>
              ))}
            </SelectionModal>

            <SelectionModal 
              title="Seleccionar Cámaras" 
              visible={activeModal === 'camera'} 
              onClose={() => setActiveModal(null)}
            >
              {camsLoading ? (
                <ActivityIndicator color={Colors.brand.primary} style={{ marginVertical: 20 }} />
              ) : (
                <>
                  <TouchableOpacity 
                    style={[styles.modalItem, selectedCameras.length === 0 && styles.modalItemActive]}
                    onPress={() => setSelectedCameras([])}
                  >
                     <Text style={[styles.modalItemText, selectedCameras.length === 0 && styles.modalItemTextActive]}>Todas las cámaras</Text>
                     {selectedCameras.length === 0 && <Ionicons name="checkmark-circle" size={20} color={Colors.brand.primary} />}
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
                         {isSelected && <Ionicons name="checkmark-circle" size={20} color={Colors.brand.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </SelectionModal>

            <SelectionModal 
              title="Seleccionar Rango de Fecha" 
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

            {/* PRIMARY ACTION */}
            <TouchableOpacity 
              style={styles.executeBtn}
              onPress={() => onExecuteSearch(1)}
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
               <Text style={styles.resultsTitle}>Resultados <Text style={{color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)'}}>({filteredResults.length})</Text></Text>
               <View style={styles.viewToggle}>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, viewMode === 'grid' && styles.toggleBtnActive]}
                    onPress={() => setViewMode('grid')}
                  >
                     <Ionicons name="grid" size={16} color={viewMode === 'grid' ? Colors.brand.primary : (isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)')} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
                    onPress={() => setViewMode('list')}
                  >
                     <Ionicons name="list" size={16} color={viewMode === 'list' ? Colors.brand.primary : (isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)')} />
                  </TouchableOpacity>
               </View>
            </View>
          </>
        }
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={() => {
          if (!loadingResults && !loadingMore && hasMore) {
            onExecuteSearch(page + 1);
          }
        }}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* MODAL DETALLE DE RESULTADO */}
      <ResultDetailModal
        item={detailItem}
        onClose={() => setDetailItem(null)}
      />
    </View>
  );
}

function getStyles(isDarkMode: boolean) {
  const theme = isDarkMode ? Colors.dark : Colors.light;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      paddingHorizontal: 20, 
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 50,
      paddingBottom: 8, 
      borderBottomWidth: 0,
      backgroundColor: theme.background
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerTitle: { color: theme.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    avatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', borderWidth: 2, borderColor: '#2E9BFF40' },
    avatarImg: { width: '100%', height: '100%' },

    scrollContent: { paddingHorizontal: 16, paddingBottom: 120 },
    
    searchSection: { marginTop: 24, marginBottom: 15 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, height: Layout.height.input, borderRadius: Layout.borderRadius.input, paddingHorizontal: 15, borderWidth: 1, borderColor: theme.inputBorder },
    searchInput: { flex: 1, color: theme.text, fontSize: 14, marginLeft: 10, fontWeight: '500' },

    filterGrid: { gap: 12, marginBottom: 20 },
    filterRow: { flexDirection: 'row', gap: 12 },
    filterBoxContainer: { flex: 1, gap: 8 },
    filterLabel: { color: isDarkMode ? '#E0E0E0' : '#374151', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginLeft: 2, textTransform: 'uppercase' },
    filterBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.inputBg, height: Layout.height.input, borderRadius: Layout.borderRadius.input, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.inputBorder },
    filterValue: { color: theme.text, fontSize: 13, fontWeight: '700' },

    workspaceSelectorContainer: { marginBottom: 15, gap: 8 },
    workspaceSelectorBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.inputBg, height: Layout.height.input, borderRadius: Layout.borderRadius.input, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.inputBorder },
    workspaceSelectorValue: { color: theme.text, fontSize: 13, fontWeight: '700' },

    executeBtn: { backgroundColor: Colors.brand.primary, height: 58, borderRadius: Layout.borderRadius.input, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 25, shadowColor: Colors.brand.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
    executeBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

    resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 10 },
    resultsTitle: { color: theme.text, fontSize: 20, fontWeight: '800' },
    viewToggle: { flexDirection: 'row', backgroundColor: isDarkMode ? '#111112' : '#E5E7EB', borderRadius: 10, padding: 3, borderWidth: 1, borderColor: theme.border },
    toggleBtn: { padding: 8, borderRadius: 8 },
    toggleBtnActive: { backgroundColor: theme.surface },

    resultsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    resultsList: { gap: 12 },
    resRow: { flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.border, height: 90 },
    resCard: { width: (width - 44) / 2, backgroundColor: theme.surface, borderRadius: 18, marginBottom: 15, overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
    resThumb: { width: '100%', aspectRatio: 16 / 9 },
    resThumbSmall: { width: 120, height: '100%' },
    thumbOverlay: { ...StyleSheet.absoluteFillObject, padding: 8 },
    camBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: 'rgba(0,0,0,0.7)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      height: 20,
      borderWidth: 0.5,
      borderColor: '#ffffff20',
      maxWidth: '80%',
    },
    camBadgeText: { color: Colors.brand.primary, fontSize: 11, fontWeight: '900' },
    confBadge: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      height: 20,
    },
    confHigh: { backgroundColor: '#4CAF50' },
    confMid: { backgroundColor: '#FF9800' },
    confText: { color: '#fff', fontSize: 11, fontWeight: '900' },

    resFooter: { flex: 1, padding: 14, justifyContent: 'center', gap: 4 },
    resInfoMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    resName: { color: theme.text, fontSize: 15.5, fontWeight: '800', flex: 1, marginRight: 5 },
    resTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    resTimeText: { color: theme.textSecondary, fontSize: 12, fontWeight: '600' },

    // Estilos de Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: theme.surfaceSecondary, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40, maxHeight: '80%', borderWidth: 1, borderColor: theme.border },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, borderBottomWidth: 1, borderBottomColor: theme.border },
    modalTitle: { color: theme.text, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
    modalBody: { paddingHorizontal: 10 },
    modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, marginHorizontal: 10, borderRadius: 15, marginBottom: 5 },
    modalItemActive: { backgroundColor: Colors.brand.primary + '15' },
    modalItemText: { color: theme.textSecondary, fontSize: 15, fontWeight: '600' },
    modalItemTextActive: { color: Colors.brand.primary, fontWeight: '800' },
    timeInput: { backgroundColor: theme.surface, color: theme.text, padding: 15, borderRadius: 12, fontSize: 18, fontWeight: '800', textAlign: 'center', borderWidth: 1, borderColor: theme.border },

    // Estilos de Calendario
    calendarContainer: { padding: 15, backgroundColor: theme.surface, borderRadius: 20 },
    calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 5 },
    calendarMonth: { color: theme.text, fontSize: 18, fontWeight: '900' },
    weekDays: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    weekDayText: { color: theme.textMuted, fontSize: 12, fontWeight: '800', width: (width - 80) / 7, textAlign: 'center' },
    daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayBox: { width: (width - 80) / 7, height: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
    dayBoxSelected: { backgroundColor: Colors.brand.primary + '30' },
    dayBoxStart: { backgroundColor: Colors.brand.primary, borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
    dayBoxEnd: { backgroundColor: Colors.brand.primary, borderTopRightRadius: 10, borderBottomRightRadius: 10 },
    dayText: { color: theme.text, fontSize: 14, fontWeight: '600' },
    dayTextActive: { color: '#fff', fontWeight: '900' },

    // Estilos de Time Picker Compacto con Flechas
    timePickerRowCompact: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    timeLabelCompact: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      flex: 1,
    },
    timeSelectorGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    timeUnitCol: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.inputBg,
      borderRadius: Layout.borderRadius.input,
      width: 48,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: theme.inputBorder,
    },
    arrowBtn: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    timeValueText: {
      color: Colors.brand.primary,
      fontSize: 16,
      fontWeight: '900',
      marginVertical: 1,
      fontFamily: 'monospace',
    },
    timeColon: {
      color: theme.textMuted,
      fontSize: 16,
      fontWeight: '900',
    },

    // Badge de sucursal en tarjetas
    workspaceBadge: { backgroundColor: Colors.brand.primary + '15', borderColor: Colors.brand.primary + '30', borderWidth: 0.5, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    workspaceBadgeText: { color: Colors.brand.primary, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

    // Modal de Detalle de Resultado
    detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    detailSheet: { backgroundColor: theme.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
    detailImageContainer: { width: '100%', height: 220, backgroundColor: theme.surfaceSecondary, position: 'relative' },
    detailImage: { width: '100%', height: '100%' },
    detailTypeBadge: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
    detailTypeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
    detailCloseBtn: { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(0,0,0,0.6)', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    detailBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
    detailTitle: { color: theme.text, fontSize: 22, fontWeight: '900', marginBottom: 4 },
    detailTime: { color: theme.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 20 },
    detailSectionLabel: { color: theme.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
    detailMetaGrid: { gap: 12, marginBottom: 20 },
    detailMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
    detailMetaIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
    detailMetaLabel: { color: theme.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    detailMetaValue: { color: theme.text, fontSize: 14, fontWeight: '700' },
    tagChip: { backgroundColor: Colors.brand.primary + '15', borderWidth: 1, borderColor: Colors.brand.primary + '30', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    tagChipText: { color: Colors.brand.primary, fontSize: 12, fontWeight: '700' },
    detailActions: { flexDirection: 'row', gap: 12, marginBottom: 40, marginTop: 8 },
    detailActionBtn: { flex: 1, height: 52, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    detailActionConfirm: { backgroundColor: '#4CAF50' },
    detailActionFP: { backgroundColor: '#F44336' },
    detailActionText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  });
}
