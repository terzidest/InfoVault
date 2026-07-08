import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { Settings } from '../types/models';

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  autoLockTimeout: 300000,
  maskSensitiveData: true,
};

interface SettingsState {
  settings: Settings;
  isLoading: boolean;
  error: string | null;
  initSettings: () => Promise<Settings>;
  updateSettings: (newSettings: Partial<Settings>) => Promise<Settings>;
  resetSettings: () => Promise<Settings>;
}

const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  isLoading: false,
  error: null,

  initSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const storedSettings = await SecureStore.getItemAsync('appSettings');

      if (storedSettings) {
        // Merge over defaults so a settings blob written by an older app
        // version (missing newer keys) can never produce undefined settings.
        set({
          settings: { ...DEFAULT_SETTINGS, ...(JSON.parse(storedSettings) as Partial<Settings>) },
          isLoading: false,
        });
      } else {
        await SecureStore.setItemAsync('appSettings', JSON.stringify(get().settings));
        set({ isLoading: false });
      }

      return get().settings;
    } catch (error) {
      console.error('Error initializing settings:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      return get().settings;
    }
  },

  updateSettings: async (newSettings) => {
    set({ isLoading: true, error: null });
    try {
      const updatedSettings: Settings = {
        ...get().settings,
        ...newSettings,
      };

      await SecureStore.setItemAsync('appSettings', JSON.stringify(updatedSettings));

      set({ settings: updatedSettings, isLoading: false });

      return updatedSettings;
    } catch (error) {
      console.error('Error updating settings:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      throw error;
    }
  },

  resetSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const defaultSettings: Settings = { ...DEFAULT_SETTINGS };

      await SecureStore.setItemAsync('appSettings', JSON.stringify(defaultSettings));

      set({ settings: defaultSettings, isLoading: false });

      return defaultSettings;
    } catch (error) {
      console.error('Error resetting settings:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      throw error;
    }
  },
}));

export default useSettingsStore;
