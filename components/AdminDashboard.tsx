import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { useAppStore } from '../services/store';
import { getDashboard, getWorkspaces } from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Svg, { Circle, G } from 'react-native-svg';

// Colores extraídos del Mockup de Stitch (Tailwind config)
const theme = {
  background: '#000000',
  surfaceLow: '#1A1C2C', // Azul oscuro grisáceo de las capturas
  surfaceHigh: '#25283D',
  primary: '#2E9BFF', // Azul brillante SIVI
  secondary: '#5AC8FA',
  tertiary: '#F44336', // Rojo de alerta
  warning: '#FF9800', // Naranja falso positivo
  success: '#4CAF50', // Verde confirmación
  onBackground: '#FFFFFF',
  onSurface: '#FFFFFF',
  onSurfaceVariant: '#ffffff', // Blanco puro para máxima legibilidad
  outline: '#ffffff15',
  outlineVariant: '#ffffff',
  primaryContainer: '#2E9BFF20',
  secondaryContainer: '#5AC8FA',
  error: '#F44336',
};

export default function AdminDashboard() {
  const { userData, clearSession, impersonatedWorkspace, setImpersonatedWorkspace, activeWorkspace, isHydrated, activeDomain } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedInterval, setSelectedInterval] = useState<'hoy' | 'ayer' | 'semana' | '15dias' | '30dias'>('hoy');

  const isSuperAdmin = userData?.role?.name === 'SuperAdmin';
  const currentWs = impersonatedWorkspace || activeWorkspace;

  // ─── CÁLCULO DE PORCENTAJES PARA EL DONUT DE CLASIFICACIÓN ──────────────
  const fp = dashboardData?.classification?.falsePositive || 0;
  const tp = dashboardData?.classification?.positive || 0;
  const pending = dashboardData?.classification?.pending || 0;
  const total = fp + tp + pending;

  const fpPct = total > 0 ? (fp / total) * 100 : 0;
  const tpPct = total > 0 ? (tp / total) * 100 : 0;
  const pendingPct = total > 0 ? (pending / total) * 100 : 100;

  useEffect(() => {
    async function fetchData() {
      if (!isHydrated) return;

      setLoading(true);
      try {
        if (!activeDomain) {
          console.warn("Domain not ready, waiting for configuration...");
          return;
        }

        if (isSuperAdmin && !impersonatedWorkspace) {
          const res = await getWorkspaces() as any;
          const wsList = Array.isArray(res) ? res : (res?.rows || []);
          setWorkspaces(wsList);
          setDashboardData(null);
        } else {
          const data = await getDashboard(impersonatedWorkspace?.work_id, selectedInterval);
          setDashboardData(data);
          setWorkspaces([]);
        }
      } catch (error) {
        console.error("Error cargando dashboard:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [isHydrated, activeDomain, impersonatedWorkspace, isSuperAdmin, activeWorkspace, selectedInterval]);

  async function handleLogout() {
    await clearSession();
  }

  return (
    <View style={styles.safeArea}>
      {/* HEADER TOPBAR */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#2E9BFF20', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="shield-checkmark" size={18} color="#2E9BFF" />
          </View>
          <Text style={{ color: '#2E9BFF', fontSize: 20, fontWeight: '900', letterSpacing: -1, marginLeft: 10 }}>SIVI</Text>
        </View>
        <View style={styles.headerRight}>
          {currentWs && (
            <View style={[
              styles.envBadge, 
              { 
                backgroundColor: currentWs.type === 'local' ? '#FF980015' : '#4CAF5015', 
                borderColor: currentWs.type === 'local' ? '#FF980050' : '#4CAF5050', 
                borderWidth: 1 
              }
            ]}>
              <Text style={[styles.envText, { color: currentWs.type === 'local' ? '#FF9800' : '#4CAF50' }]}>
                {currentWs.type === 'local' ? 'LOCAL' : 'NUBE'}
              </Text>
            </View>
          )}
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{userData?.role?.name === 'SuperAdmin' ? 'SUPER' : 'ADM'}</Text>
          </View>
          {isSuperAdmin && !impersonatedWorkspace ? (
            <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
              <Ionicons name="log-out-outline" size={22} color={theme.tertiary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={styles.iconButton}>
              <Ionicons name="settings-outline" size={22} color={theme.onSurfaceVariant} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* IMPERSONATION BANNER */}
      {impersonatedWorkspace && (
        <View style={{ backgroundColor: theme.primaryContainer, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
            <Ionicons name="eye" size={14} color="#fff" /> Viendo como: {impersonatedWorkspace.name}
          </Text>
          <TouchableOpacity 
            onPress={() => setImpersonatedWorkspace(null)} 
            style={{ backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Salir</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.onSurfaceVariant, marginTop: 16 }}>Obteniendo datos...</Text>
        </View>
      ) : workspaces.length > 0 ? (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>WORKSPACES DISPONIBLES</Text>
          {workspaces.map((ws: any) => {
            const workId = ws.work_id || ws.manager_id || ws.id?.toString();
            return (
              <View key={workId} style={[styles.card, { marginBottom: 12, padding: 16 }]}>
                <View style={[styles.rowCenter, { justifyContent: 'space-between' }]}>
                  <View>
                    <Text style={[styles.textBody, { fontWeight: 'bold', fontSize: 16 }]}>{ws.name || 'Workspace'}</Text>
                    <Text style={[styles.textLabel, { marginTop: 4 }]}>ID: {workId}</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setImpersonatedWorkspace({ ...ws, work_id: workId })}
                    style={{ backgroundColor: theme.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>ADMINISTRAR</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : dashboardData ? (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          
          {/* TÍTULO PRINCIPAL DEL DASHBOARD */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 16 }}>
            <Text style={[styles.dashboardTitle, { marginTop: 0, marginBottom: 0 }]}>DASHBOARD</Text>
            {dashboardData?.isConsolidated && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#2E9BFF15',
                borderColor: '#2E9BFF50',
                borderWidth: 1,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                gap: 4
              }}>
                <Ionicons name="flash" size={11} color="#2E9BFF" />
                <Text style={{ color: '#2E9BFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>GATEWAY</Text>
              </View>
            )}
          </View>

          {/* SELECTOR HORIZONTAL DE INTERVALOS */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.intervalScroll} contentContainerStyle={styles.intervalContent}>
            {(['hoy', 'ayer', 'semana', '15dias', '30dias'] as const).map((intervalOpt) => {
              const label = 
                intervalOpt === 'hoy' ? 'Hoy' :
                intervalOpt === 'ayer' ? 'Ayer' :
                intervalOpt === 'semana' ? 'Semana' :
                intervalOpt === '15dias' ? 'Últimos 15 días' : 'Últimos 30 días';
              const isSelected = selectedInterval === intervalOpt;
              return (
                <TouchableOpacity 
                  key={intervalOpt} 
                  onPress={() => setSelectedInterval(intervalOpt)}
                  style={[
                    styles.intervalTab, 
                    isSelected ? styles.intervalTabActive : styles.intervalTabInactive
                  ]}
                >
                  <Text style={[
                    styles.intervalTabText, 
                    isSelected ? styles.intervalTabTextActive : styles.intervalTabTextInactive
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* CUADRICULA DE MÉTRICAS 2x2 (Diseño exacto de la imagen de Stitch) */}
          <View style={styles.gridContainer}>
            {/* CARD 1: TOTAL ALERTAS */}
            <View style={[styles.metricCard, styles.metricCardBlue]}>
              <View style={styles.metricCardHeader}>
                <View style={[styles.iconBox, { backgroundColor: '#1E6BCE' }]}>
                  <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.metricTextContainer}>
                  <Text style={styles.metricCardTitle}>TOTAL ALERTAS</Text>
                  <Text style={styles.metricCardValue}>{dashboardData.metrics?.total || 0}</Text>
                  <Text style={styles.metricCardSub}>Eventos en el intervalo</Text>
                  <Text style={styles.trendText}>
                    <Ionicons name="arrow-up" size={11} color="#4ADE80" /> 12% vs ayer
                  </Text>
                </View>
              </View>
            </View>

            {/* CARD 2: TOTAL ALERTAS ATENDIDAS */}
            <View style={[styles.metricCard, styles.metricCardRed]}>
              <View style={styles.metricCardHeader}>
                <View style={[styles.iconBox, { backgroundColor: '#B82424' }]}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.metricTextContainer}>
                  <Text style={styles.metricCardTitle}>TOTAL ALERTAS ATENDIDAS</Text>
                  <Text style={styles.metricCardValue}>{dashboardData.metrics?.resolved || 0}</Text>
                  <Text style={styles.metricCardSub}>Eventos en el intervalo</Text>
                  <Text style={styles.trendTextGray}>Sin cambios vs ayer</Text>
                </View>
              </View>
            </View>

            {/* CARD 3: ALERTAS SIN RESOLVER */}
            <View style={[styles.metricCard, styles.metricCardRed]}>
              <View style={styles.metricCardHeader}>
                <View style={[styles.iconBox, { backgroundColor: '#B82424' }]}>
                  <Ionicons name="alert-circle" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.metricTextContainer}>
                  <Text style={styles.metricCardTitle}>ALERTAS SIN RESOLVER</Text>
                  <Text style={styles.metricCardValue}>{dashboardData.metrics?.unresolved || 0}</Text>
                  <Text style={styles.metricCardSub}>Eventos en el intervalo</Text>
                  <Text style={styles.trendText}>
                    <Ionicons name="arrow-up" size={11} color="#4ADE80" /> 12% vs ayer
                  </Text>
                </View>
              </View>
            </View>

            {/* CARD 4: PORCENTAJE DE OPERACIÓN EFECTIVA */}
            <View style={[styles.metricCard, styles.metricCardRed]}>
              <View style={styles.metricCardHeader}>
                <View style={[styles.iconBox, { backgroundColor: '#B82424' }]}>
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900', fontFamily: 'monospace' }}>%</Text>
                </View>
                <View style={styles.metricTextContainer}>
                  <Text style={styles.metricCardTitle}>PORCENTAJE DE OPERACIÓN EFECTIVA</Text>
                  <Text style={styles.metricCardValue}>{dashboardData.metrics?.effective || "0%"}</Text>
                  <Text style={styles.metricCardSub}>Eventos en el intervalo</Text>
                  <Text style={styles.trendTextGray}>Sin cambios vs ayer</Text>
                </View>
              </View>
            </View>
          </View>

          {/* SECCIÓN CLASIFICACIÓN POR FALSO POSITIVO */}
          <View style={styles.classificationContainer}>
            <Text style={styles.classificationTitle}>CLASIFICACIÓN POR FALSO POSITIVO</Text>
            
            <View style={styles.classificationBody}>
              {/* DONUT CHART NATIVO PROPORCIONAL SVG */}
              <View style={styles.donutWrapper}>
                <Svg width={110} height={110} viewBox="0 0 100 100">
                  <G transform="rotate(-90 50 50)">
                    {/* Fondo base (gris oscuro muy sutil) */}
                    <Circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#ffffff10"
                      strokeWidth="10"
                    />

                    {/* Segmento 3: Pendiente de clasificar (Teal) */}
                    {pendingPct > 0 && (
                      <Circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#0D9488"
                        strokeWidth="10"
                        strokeDasharray="238.76"
                        strokeDashoffset={238.76 - (238.76 * pendingPct) / 100}
                        transform={`rotate(${(fpPct + tpPct) * 3.6} 50 50)`}
                      />
                    )}

                    {/* Segmento 2: Positivo (Púrpura) */}
                    {tpPct > 0 && (
                      <Circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#A855F7"
                        strokeWidth="10"
                        strokeDasharray="238.76"
                        strokeDashoffset={238.76 - (238.76 * tpPct) / 100}
                        transform={`rotate(${fpPct * 3.6} 50 50)`}
                      />
                    )}

                    {/* Segmento 1: Falso Positivo (Celeste) */}
                    {fpPct > 0 && (
                      <Circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#2E9BFF"
                        strokeWidth="10"
                        strokeDasharray="238.76"
                        strokeDashoffset={238.76 - (238.76 * fpPct) / 100}
                      />
                    )}
                  </G>
                </Svg>

                {/* CENTRO DEL DONUT */}
                <View style={[styles.donutHole, { position: 'absolute', width: 76, height: 76, borderRadius: 38, backgroundColor: '#1A1C2C', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={styles.donutHoleLabel}>TOTAL</Text>
                  <Text style={styles.donutHoleValue}>{total}</Text>
                </View>
              </View>

              {/* LEYENDAS DETALLADAS A LA DERECHA */}
              <View style={styles.legendContainer}>
                {/* Leyenda 1: Falso Positivo */}
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#2E9BFF' }]} />
                  <Text style={styles.legendLabel}>Falso positivo</Text>
                  <Text style={styles.legendValue}>
                    {dashboardData.classification?.falsePositive || 0} ({dashboardData.metrics?.total > 0 ? (((dashboardData.classification?.falsePositive || 0) / dashboardData.metrics?.total) * 100).toFixed(2) : "0.00"}%)
                  </Text>
                </View>

                {/* Leyenda 2: Positivo */}
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#A855F7' }]} />
                  <Text style={styles.legendLabel}>Positivo</Text>
                  <Text style={styles.legendValue}>
                    {dashboardData.classification?.positive || 0} ({dashboardData.metrics?.total > 0 ? (((dashboardData.classification?.positive || 0) / dashboardData.metrics?.total) * 100).toFixed(2) : "0.00"}%)
                  </Text>
                </View>

                {/* Leyenda 3: Pendiente de clasificar */}
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#0D9488' }]} />
                  <Text style={styles.legendLabel}>Pendiente de clasificar</Text>
                  <Text style={styles.legendValue}>
                    {dashboardData.classification?.pending || 0} ({dashboardData.metrics?.total > 0 ? (((dashboardData.classification?.pending || 0) / dashboardData.metrics?.total) * 100).toFixed(2) : "100.00"}%)
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* SECCIÓN TIEMPO DE RESPUESTA DEL OPERADOR */}
          <View style={styles.responseTimeContainer}>
            <Text style={styles.classificationTitle}>TIEMPO DE RESPUESTA DEL OPERADOR</Text>
            
            <View style={styles.responseTimeRow}>
              {/* Promedio */}
              <View style={[styles.responseCol, styles.rightBorder]}>
                <Text style={styles.responseLabel}>Promedio</Text>
                <Text style={styles.responseValueWhite}>{dashboardData.responseTime?.avg || '4.1 h'}</Text>
              </View>
              
              {/* Mediana */}
              <View style={[styles.responseCol, styles.rightBorder]}>
                <Text style={styles.responseLabel}>Mediana</Text>
                <Text style={styles.responseValueWhite}>{dashboardData.responseTime?.median || '7.5 h'}</Text>
              </View>
              
              {/* Mínimo */}
              <View style={[styles.responseCol, styles.rightBorder]}>
                <Text style={styles.responseLabel}>Mínimo</Text>
                <Text style={styles.responseValueGreen}>{dashboardData.responseTime?.min || '2.6 h'}</Text>
              </View>
              
              {/* % sin respuesta */}
              <View style={styles.responseCol}>
                <Text style={styles.responseLabel}>% sin respuesta</Text>
                <Text style={styles.responseValueYellow}>{dashboardData.responseTime?.unanswered || '0%'}</Text>
              </View>
            </View>
          </View>

          {/* ÚLTIMAS ALERTAS LIST (Limitado a 5 alertas más recientes) */}
          <View style={[styles.rowCenter, { justifyContent: 'space-between', marginTop: 28, marginBottom: 12 }]}>
            <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0, fontSize: 13 }]}>ÚLTIMAS ALERTAS (24H)</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/alerts')}>
              <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>Ver todas</Text>
            </TouchableOpacity>
          </View>
          
          {dashboardData.recentAlerts && dashboardData.recentAlerts.length === 0 ? (
            <View style={[styles.card, { padding: 20, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }]}>
              <Ionicons name="information-circle-outline" size={24} color={theme.onSurfaceVariant} style={{ opacity: 0.5, marginBottom: 6 }} />
              <Text style={{ color: theme.onSurfaceVariant, fontSize: 13, opacity: 0.6, fontWeight: '500' }}>
                Sin alertas en las últimas 24h
              </Text>
            </View>
          ) : (
            (dashboardData.recentAlerts || []).slice(0, 5).map((alert: any) => (
              <TouchableOpacity key={alert.id} style={styles.alertRow} onPress={() => router.push(`/(tabs)/alerts?alertId=${alert.id}&createdAt=${alert.rawItem?.createdAt || alert.createdAt || ''}`)}>
                <View style={styles.alertThumbContainer}>
                  {alert.img ? (
                    <Image source={{ uri: alert.img }} style={styles.alertThumb} />
                  ) : (
                    <View style={[styles.alertThumb, { justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="videocam-off" size={24} color={theme.onSurfaceVariant} />
                    </View>
                  )}
                  <View style={[styles.alertThumbBorder, { borderColor: `${theme.primary}40` }]} />
                </View>
                <View style={styles.alertInfo}>
                  <View style={styles.rowCenter}>
                    <Ionicons name={alert.icon as any} size={14} color={alert.type === 'error' ? theme.tertiary : theme.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
                  </View>
                  <Text style={styles.alertMeta}>{alert.time} • {alert.camera}</Text>
                </View>
                <View style={[styles.alertBadge, { 
                    backgroundColor: alert.type === 'error' ? `${theme.tertiary}15` : `${theme.primary}15`,
                    borderColor: alert.type === 'error' ? `${theme.tertiary}40` : `${theme.primary}40`
                  }]}>
                  <Text style={[styles.textMono, { color: alert.type === 'error' ? theme.tertiary : theme.primary, fontSize: 11 }]}>{alert.percent}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : null}

      {/* Settings Modal eliminado - Navegación directa activada */}

    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 50,
    paddingBottom: 8,
    borderBottomWidth: 0,
    backgroundColor: theme.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.outlineVariant + '50',
    marginRight: 8,
  },
  headerTitle: {
    color: theme.onBackground,
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  envBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  envText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  roleBadge: {
    backgroundColor: theme.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  iconButton: {
    marginLeft: 12,
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex1: {
    flex: 1,
  },
  card: {
    backgroundColor: theme.surfaceLow,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffffff10',
  },
  textBody: {
    color: theme.onSurface,
    fontSize: 14,
  },
  textLabel: {
    color: theme.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  textMono: {
    color: theme.onSurface,
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: theme.surfaceHigh,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.primary,
    borderRadius: 3,
  },
  sectionTitle: {
    color: theme.onSurface,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: theme.surfaceLow,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffffff10',
    marginBottom: 8,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  kpiLabel: {
    color: theme.onSurface,
    fontSize: 11,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  alertRow: {
    flexDirection: 'row',
    backgroundColor: theme.surfaceLow,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ffffff10',
    marginBottom: 8,
    alignItems: 'center',
  },
  alertThumbContainer: {
    width: 64,
    height: 48,
    borderRadius: 4,
    backgroundColor: theme.surfaceHigh,
    marginRight: 12,
    overflow: 'hidden',
  },
  alertThumb: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  alertThumbBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 1,
    borderRadius: 4,
  },
  alertInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  alertTitle: {
    color: theme.onSurface,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  alertMeta: {
    color: theme.outlineVariant,
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 4,
    marginLeft: 8,
  },
  // Settings Modal
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.surfaceLow,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.outlineVariant + '30',
  },
  modalHeaderTitle: {
    color: theme.onSurface,
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
    gap: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    color: theme.onSurface,
    fontSize: 16,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.error + '20',
    borderWidth: 1,
    borderColor: theme.error + '50',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  logoutText: {
    color: theme.error,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  dashboardTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 16,
  },
  intervalScroll: {
    marginBottom: 20,
    flexDirection: 'row',
  },
  intervalContent: {
    gap: 8,
  },
  intervalTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  intervalTabActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  intervalTabInactive: {
    backgroundColor: '#151724',
    borderColor: '#ffffff10',
  },
  intervalTabText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  intervalTabTextActive: {
    color: '#FFFFFF',
  },
  intervalTabTextInactive: {
    color: '#9CA3AF',
  },
  metricCard: {
    width: '48.5%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    marginBottom: 4,
  },
  metricCardBlue: {
    backgroundColor: '#0B305C', // Deep royal blue matching the image perfectly
    borderColor: '#2E9BFF30',
  },
  metricCardRed: {
    backgroundColor: '#5C1A1A', // Deep burgundy/crimson matching the image perfectly
    borderColor: '#EF444430',
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  metricTextContainer: {
    flex: 1,
  },
  metricCardTitle: {
    color: '#E5E7EB', // Brighter text color for optimal contrast
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  metricCardValue: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  metricCardSub: {
    color: '#D1D5DB', // Bright silver-grey contrast
    fontSize: 10,
    marginBottom: 6,
  },
  trendText: {
    color: '#4ADE80', // High contrast vibrant light green
    fontSize: 11,
    fontWeight: 'bold',
  },
  trendTextGray: {
    color: '#E5E7EB', // Light silver grey trend contrast
    fontSize: 11,
    fontWeight: '600',
  },
  classificationContainer: {
    backgroundColor: theme.surfaceLow,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffffff10',
    marginBottom: 20,
  },
  classificationTitle: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  classificationBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  donutWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutBase: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 12,
    justifyContent: 'center',
    alignItems: 'center',
    // Usamos colores de fondo elegantes
    backgroundColor: 'transparent',
  },
  donutHole: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#1A1C2C', // Coincide con theme.surfaceLow para un efecto de corte limpio
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutHoleLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: 'bold',
  },
  donutHoleValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  legendContainer: {
    flex: 1,
    marginLeft: 16,
    gap: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    flex: 1,
  },
  legendValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  responseTimeContainer: {
    backgroundColor: theme.surfaceLow,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffffff10',
    marginBottom: 10,
  },
  responseTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  responseCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightBorder: {
    borderRightWidth: 1,
    borderRightColor: '#ffffff10',
  },
  responseLabel: {
    color: '#6B7280',
    fontSize: 10,
    marginBottom: 6,
    textAlign: 'center',
  },
  responseValueWhite: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  responseValueGreen: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  responseValueYellow: {
    color: '#FFB300',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  }
});
