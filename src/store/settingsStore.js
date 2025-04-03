import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { checkPremiumStatus } from '../services/premium';

/**
 * Settings state management using Zustand
 */
const useSettingsStore = create((set, get) => ({
  // State
  settings: {
    theme: 'light',
    autoLockTimeout: 300000, // 5 minutes in milliseconds
    showBiometricPrompt: true,
    maskSensitiveData: true,
  },
  isPremium: false,
  isLoading: false,
  error: null,
  
  // Initialize settings
  initSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      // Load settings from secure storage
      const storedSettings = await SecureStore.getItemAsync('appSettings');
      
      // Check premium status
      const isPremium = await checkPremiumStatus();
      
      if (storedSettings) {
        set({ 
          settings: JSON.parse(storedSettings),
          isPremium,
          isLoading: false 
        });
      } else {
        // Save default settings if none exist
        await SecureStore.setItemAsync('appSettings', JSON.stringify(get().settings));
        set({ 
          isPremium,
          isLoading: false 
        });
      }
      
      return get().settings;
    } catch (error) {
      console.error('Error initializing settings:', error);
      set({ error: error.message, isLoading: false });
      return get().settings;
    }
  },
  
  // Update settings
  updateSettings: async (newSettings) => {
    set({ isLoading: true, error: null });
    try {
      const updatedSettings = {
        ...get().settings,
        ...newSettings
      };
      
      // Save to secure storage
      await SecureStore.setItemAsync('appSettings', JSON.stringify(updatedSettings));
      
      // Update state
      set({ settings: updatedSettings, isLoading: false });
      
      return updatedSettings;
    } catch (error) {
      console.error('Error updating settings:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Reset settings to defaults
  resetSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const defaultSettings = {
        theme: 'light',
        autoLockTimeout: 300000,
        showBiometricPrompt: true,
        maskSensitiveData: true,
      };
      
      // Save to secure storage
      await SecureStore.setItemAsync('appSettings', JSON.stringify(defaultSettings));
      
      // Update state
      set({ settings: defaultSettings, isLoading: false });
      
      return defaultSettings;
    } catch (error) {
      console.error('Error resetting settings:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Update premium status
  updatePremiumStatus: async () => {
    try {
      const isPremium = await checkPremiumStatus();
      set({ isPremium });
      return isPremium;
    } catch (error) {
      console.error('Error checking premium status:', error);
      return get().isPremium;
    }
  }
}));

export default useSettingsStore;
