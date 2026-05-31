import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../services/store';

// Colores SIVI (Secure Core Aesthetic)
const SIVI_THEME = {
  background: '#0A0A0B',
  surface: '#121214',
  primary: '#2E9BFF', 
  text: '#ffffff',
  textMuted: '#ffffff', // De plomo a blanco para máxima claridad
  border: '#ffffff10'
};

export default function TabsLayout() {
  const { userData, impersonatedWorkspace, activeWorkspace } = useAppStore();
  const isSuperAdmin = userData?.role?.name === 'SuperAdmin';
  const restrictAccess = isSuperAdmin && !impersonatedWorkspace;
  const currentWs = impersonatedWorkspace || activeWorkspace;
  const hideCameras = restrictAccess || (currentWs?.type === 'local' && !isSuperAdmin);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0E0E0E',
          borderTopColor: SIVI_THEME.border,
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
          display: restrictAccess ? 'none' : 'flex', // Ocultamos la barra completa si no hay workspace
        },
        tabBarActiveTintColor: SIVI_THEME.primary,
        tabBarInactiveTintColor: SIVI_THEME.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        }
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "grid" : "grid-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cameras"
        options={{
          title: 'Cámaras',
          href: hideCameras ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "videocam" : "videocam-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alertas',
          href: restrictAccess ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "notifications" : "notifications-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Eventos',
          href: restrictAccess ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "flash" : "flash-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Buscar',
          href: restrictAccess ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "search" : "search-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="event-config"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}