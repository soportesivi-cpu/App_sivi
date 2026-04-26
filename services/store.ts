import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

type AppState = {
  isHydrated: boolean;
  activeDomain: string | null;
  jwtToken: string | null;
  userData: any | null;
  isDarkMode: boolean;
  hydrate: () => Promise<void>;
  setSession: (domain: string, token: string, user: any, workspace: any) => Promise<void>;
  clearSession: () => Promise<void>;
  toggleTheme: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  isHydrated: false,
  activeDomain: null,
  jwtToken: null,
  userData: null,
  isDarkMode: true,

  hydrate: async () => {
    try {
      const domain = await SecureStore.getItemAsync('active_domain');
      const token = await SecureStore.getItemAsync('jwt_token');
      const user = await SecureStore.getItemAsync('user_data');
      
      let parsedUser = null;
      if (user) {
        try { parsedUser = JSON.parse(user); } catch (e) {}
      }

      const themePref = await SecureStore.getItemAsync('theme_preference');
      const isDark = themePref ? themePref === 'dark' : true;

      set({
        isHydrated: true,
        activeDomain: domain,
        jwtToken: token,
        userData: parsedUser,
        isDarkMode: isDark,
      });
    } catch (error) {
      set({ isHydrated: true });
    }
  },

  setSession: async (domain, token, user, workspace) => {
    await SecureStore.setItemAsync('active_domain', domain);
    await SecureStore.setItemAsync('jwt_token', token);
    await SecureStore.setItemAsync('user_data', JSON.stringify(user));
    await SecureStore.setItemAsync('active_workspace', JSON.stringify(workspace));
    set({ activeDomain: domain, jwtToken: token, userData: user });
  },

  clearSession: async () => {
    await SecureStore.deleteItemAsync('active_domain');
    await SecureStore.deleteItemAsync('jwt_token');
    await SecureStore.deleteItemAsync('user_data');
    await SecureStore.deleteItemAsync('active_workspace');
    set({ activeDomain: null, jwtToken: null, userData: null });
    router.replace('/(auth)/login');
  },

  toggleTheme: () => {
    set((state) => {
      const newMode = !state.isDarkMode;
      SecureStore.setItemAsync('theme_preference', newMode ? 'dark' : 'light');
      return { isDarkMode: newMode };
    });
  },
}));
