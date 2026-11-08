import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { Settings } from '../types/models';

export const SETTINGS_VERSION = 2;

const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  theme: 'system',
  autoLockTimeout: 300000,
  maskSensitiveData: true,
  sortMode: 'lastUsed',
};

// One-shot migration of a persisted blob to the current schema.
//
// v1 wrote `theme: 'light'` as its default and never exposed a theme picker,
// so a stored 'light' in a version-less (v1) blob can only be that default —
// nobody chose it. v2 defaults to 'system' (follow the OS), so that value is
// read as 'system'. The migrated blob is stamped `version: 2` and written
// back, so the mapping runs exactly once: a 'light' the user picks later in
// the v2 settings UI is stored with the version stamp and left alone.
// Newer keys are filled from defaults so an older blob never yields
// undefined settings.
export const migrateStoredSettings = (stored: Partial<Settings>): Settings => {
  const isLegacy = stored.version === undefined;
  const merged: Settings = { ...DEFAULT_SETTINGS, ...stored, version: SETTINGS_VERSION };
  if (isLegacy && merged.theme === 'light') {
    merged.theme = 'system';
  }
  return merged;
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
        const stored = JSON.parse(storedSettings) as Partial<Settings>;
        const migrated = migrateStoredSettings(stored);
        if (stored.version !== migrated.version) {
          await SecureStore.setItemAsync('appSettings', JSON.stringify(migrated));
        }
        set({ settings: migrated, isLoading: false });
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
