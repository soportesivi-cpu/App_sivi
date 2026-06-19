import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { useAppStore } from '../services/store';
import { wsService } from '../services/websocket';

const queryClient = new QueryClient();

export default function RootLayout() {
  const hydrate = useAppStore((state) => state.hydrate);
  const isHydrated = useAppStore((state) => state.isHydrated);
  const jwtToken = useAppStore((state) => state.jwtToken);
  const activeDomain = useAppStore((state) => state.activeDomain);
  const isDarkMode = useAppStore((state) => state.isDarkMode);

  useEffect(() => {
    hydrate();
  }, []);

  /**
   * Ciclo de vida del Socket.IO global.
   * Se conecta en cuanto hay token y dominio, y se reconecta si cambian.
   * Se desconecta cuando se borra (logout).
   */
  useEffect(() => {
    if (!isHydrated) return;

    // Desconectar cualquier sesión Socket.IO activa antes de cambiar o reconectar
    wsService.disconnect();

    if (jwtToken && activeDomain) {
      console.log(`[App] Token y dominio (${activeDomain}) detectados → conectando Socket.IO...`);
      wsService.connect();
    } else {
      console.log('[App] Sin token o sin dominio → desconectando Socket.IO...');
    }

    return () => {
      wsService.disconnect();
    };
  }, [isHydrated, jwtToken, activeDomain]);

  if (!isHydrated) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </QueryClientProvider>
  );
}
