import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

type AppState = {
  isHydrated: boolean;
  activeDomain: string | null;
  jwtToken: string | null;
  workspaceSessions: any[] | null; // <-- NUEVO: Sesiones completas de workspaces del orquestador
  userData: any | null;
  activeWorkspace: any | null; // <-- Guarda el workspace activo completo
  impersonatedWorkspace: any | null; // <-- NUEVO ESTADO PARA SUPERADMIN
  isDarkMode: boolean;
  soundEnabled: boolean; // <-- Preferencia de sonido de alertas
  hydrate: () => Promise<void>;
  setSession: (domain: string, token: string, jwt: string, user: any, workspace: any, sessions: any[]) => Promise<void>; // <-- Firma actualizada
  clearSession: () => Promise<void>;
  setImpersonatedWorkspace: (workspace: any | null) => void;
  toggleTheme: () => void;
  toggleSound: () => void;
  refreshWorkspacesSessions: () => Promise<{ success: boolean; total: number; failed: number; message: string }>;
};

export const useAppStore = create<AppState>((set, get) => ({
  isHydrated: false,
  activeDomain: null,
  jwtToken: null,
  workspaceSessions: null, // <-- VALOR INICIAL
  userData: null,
  activeWorkspace: null,
  impersonatedWorkspace: null,
  isDarkMode: true,
  soundEnabled: true,

  hydrate: async () => {
    try {
      const domain = await SecureStore.getItemAsync('active_domain');
      const token = await SecureStore.getItemAsync('jwt_token');
      const wsSessions = await SecureStore.getItemAsync('workspace_sessions'); // <-- Cargar sesiones
      const user = await SecureStore.getItemAsync('user_data');
      const ws = await SecureStore.getItemAsync('active_workspace');
      
      let parsedUser = null;
      if (user) {
        try { parsedUser = JSON.parse(user); } catch (e) {}
      }

      let parsedWs = null;
      if (ws) {
        try { parsedWs = JSON.parse(ws); } catch (e) {}
      }

      let parsedSessions = null;
      if (wsSessions) {
        try { parsedSessions = JSON.parse(wsSessions); } catch (e) {}
      }

      const themePref = await SecureStore.getItemAsync('theme_preference');
      const isDark = themePref ? themePref === 'dark' : true;

      const soundPref = await SecureStore.getItemAsync('sound_preference');
      const isSound = soundPref ? soundPref === 'enabled' : true;

      set({
        isHydrated: true,
        activeDomain: domain,
        jwtToken: token,
        workspaceSessions: parsedSessions,
        userData: parsedUser,
        activeWorkspace: parsedWs,
        isDarkMode: isDark,
        soundEnabled: isSound,
      });
    } catch (error) {
      set({ isHydrated: true });
    }
  },

  setSession: async (domain, token, jwt, user, workspace, sessions) => {
    await SecureStore.setItemAsync('active_domain', domain);
    await SecureStore.setItemAsync('workspace_token', token);
    await SecureStore.setItemAsync('jwt_token', jwt);
    await SecureStore.setItemAsync('user_data', JSON.stringify(user));
    await SecureStore.setItemAsync('active_workspace', JSON.stringify(workspace));
    await SecureStore.setItemAsync('workspace_sessions', JSON.stringify(sessions)); // Guardar sesiones
    set({ activeDomain: domain, jwtToken: jwt, userData: user, activeWorkspace: workspace, workspaceSessions: sessions });
  },

  clearSession: async () => {
    await SecureStore.deleteItemAsync('active_domain');
    await SecureStore.deleteItemAsync('jwt_token');
    await SecureStore.deleteItemAsync('workspace_token');
    await SecureStore.deleteItemAsync('workspace_sessions'); // Limpiar sesiones
    await SecureStore.deleteItemAsync('secure_user_pass'); // Limpiar contraseña guardada
    await SecureStore.deleteItemAsync('user_data');
    await SecureStore.deleteItemAsync('active_workspace');
    set({ activeDomain: null, jwtToken: null, workspaceSessions: null, userData: null, impersonatedWorkspace: null, activeWorkspace: null });
    router.replace('/(auth)/login');
  },

  setImpersonatedWorkspace: (workspace) => {
    if (workspace) {
      const currentDomain = get().activeDomain;
      set({ impersonatedWorkspace: workspace, activeDomain: workspace.domain || currentDomain });
    } else {
      const origWs = get().activeWorkspace;
      set({ impersonatedWorkspace: null, activeDomain: origWs ? origWs.domain : null });
    }
  },

  toggleTheme: () => {
    set((state) => {
      const newMode = !state.isDarkMode;
      SecureStore.setItemAsync('theme_preference', newMode ? 'dark' : 'light');
      return { isDarkMode: newMode };
    });
  },

  toggleSound: () => {
    set((state) => {
      const newSound = !state.soundEnabled;
      SecureStore.setItemAsync('sound_preference', newSound ? 'enabled' : 'disabled');
      return { soundEnabled: newSound };
    });
  },

  refreshWorkspacesSessions: async () => {
    try {
      const currentSessions = get().workspaceSessions;
      if (!currentSessions || currentSessions.length === 0) {
        return { success: false, total: 0, failed: 0, message: 'No hay sesiones de workspace activas' };
      }

      const { getWorkspacesSummary } = await import('./api');
      const summary = await getWorkspacesSummary(currentSessions);
      if (!summary) {
        return { success: false, total: 0, failed: 0, message: 'No se pudo obtener el estado de los workspaces' };
      }

      const validWorkspaces = summary.workspaces || [];
      const failures = summary.failures || [];

      // Filtrar y remover únicamente las sesiones con token inválido
      const invalidWorkspaces = failures
        .filter((f: any) => f.status === 'invalid_token')
        .map((f: any) => (f.workspace || '').toLowerCase());

      const updatedSessions = currentSessions.filter(
        (s: any) => !invalidWorkspaces.includes((s.workspace || '').toLowerCase())
      );

      // Si no quedan sesiones válidas (todas expiraron), cerramos sesión global
      if (updatedSessions.length === 0) {
        await get().clearSession();
        return { success: false, total: 0, failed: failures.length, message: 'Sesión expirada. Por favor, inicie sesión nuevamente.' };
      }

      // Si cambió el listado de sesiones válidas, lo actualizamos en Zustand y SecureStore
      if (updatedSessions.length !== currentSessions.length) {
        await SecureStore.setItemAsync('workspace_sessions', JSON.stringify(updatedSessions));
        set({ workspaceSessions: updatedSessions });
      }

      // Si tenemos un workspace impersonado activo y su sesión expiró, lo limpiamos
      const currentImpersonated = get().impersonatedWorkspace;
      if (currentImpersonated) {
        const impersonatedWsId = (currentImpersonated.id || currentImpersonated.workspace || '').toLowerCase();
        const stillValid = updatedSessions.some(
          (s: any) => (s.workspace || '').toLowerCase() === impersonatedWsId
        );
        if (!stillValid) {
          get().setImpersonatedWorkspace(null);
        }
      }

      const failedCount = failures.length;
      const successCount = validWorkspaces.length;

      return {
        success: true,
        total: updatedSessions.length,
        failed: failedCount,
        message: `Sincronizados ${successCount} workspaces.${failedCount > 0 ? ` (${failedCount} offline/fallidos)` : ''}`
      };
    } catch (e: any) {
      console.error('[STORE] Falló refresco silencioso de workspaces:', e);
      return { success: false, total: 0, failed: 0, message: e.message || 'Error en la sincronización' };
    }
  },
}));
