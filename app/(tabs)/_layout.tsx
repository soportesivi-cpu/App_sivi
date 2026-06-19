import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../services/store';
import { Colors } from '../../constants/theme';

export default function TabsLayout() {
  const { userData, impersonatedWorkspace, isDarkMode } = useAppStore();
  const themeColors = isDarkMode ? Colors.dark : Colors.light;
  const isSuperAdmin = userData?.role?.name === 'SuperAdmin';
  const restrictAccess = isSuperAdmin && !impersonatedWorkspace;
  const hideCameras = restrictAccess;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDarkMode ? '#0E0E0E' : '#FFFFFF',
          borderTopColor: themeColors.border,
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
          display: restrictAccess ? 'none' : 'flex', // Ocultamos la barra completa si no hay workspace
        },
        tabBarActiveTintColor: Colors.brand.primary,
        tabBarInactiveTintColor: themeColors.textMuted,
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