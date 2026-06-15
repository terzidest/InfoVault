import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { checkPremiumStatus } from '../services/premium';
import type { Settings } from '../types/models';

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  autoLockTimeout: 300000,
  maskSensitiveData: true,
};

interface SettingsState {
  settings: Settings;
  isPremium: boolean;
  isLoading: boolean;
  error: string | null;
  initSettings: () => Promise<Settings>;
  updateSettings: (newSettings: Partial<Settings>) => Promise<Settings>;
  resetSettings: () => Promise<Settings>;
  updatePremiumStatus: () => Promise<boolean>;
}

const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  isPremium: false,
  isLoading: false,
  error: null,

  initSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const storedSettings = await SecureStore.getItemAsync('appSettings');
      const isPremium = await checkPremiumStatus();

      if (storedSettings) {
        set({
          settings: JSON.parse(storedSettings) as Settings,
          isPremium,
          isLoading: false,
        });
      } else {
        await SecureStore.setItemAsync('appSettings', JSON.stringify(get().settings));
        set({
          isPremium,
          isLoading: false,
        });
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

  updatePremiumStatus: async () => {
    try {
      const isPremium = await checkPremiumStatus();
      set({ isPremium });
      return isPremium;
    } catch (error) {
      console.error('Error checking premium status:', error);
      return get().isPremium;
    }
  },
}));

export default useSettingsStore;
