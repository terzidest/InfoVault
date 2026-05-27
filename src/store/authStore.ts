import { create } from 'zustand';
import { authenticate, checkAuthenticationTypes } from '../services/authentication';
import * as SecureStore from 'expo-secure-store';
import type { AuthTypes } from '../types/models';

interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  authError: string | null;
  lastActive: Date;
  authTypes: AuthTypes | null;
  init: () => Promise<boolean>;
  completeSetup: () => Promise<boolean>;
  login: () => Promise<boolean>;
  logout: () => void;
  updateLastActive: () => void;
  checkTimeout: (timeoutDuration?: number) => boolean | undefined;
}

const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,
  authError: null,
  lastActive: new Date(),
  authTypes: null,

  init: async () => {
    set({ isLoading: true });
    try {
      const setupComplete = await SecureStore.getItemAsync('setupComplete');

      if (setupComplete !== 'true') {
        set({
          isAuthenticated: false,
          isInitialized: true,
          isLoading: false,
        });
        return false;
      }

      const authTypes = await checkAuthenticationTypes();

      set({
        isInitialized: true,
        isLoading: false,
        authTypes,
      });

      return true;
    } catch (error) {
      console.error('Error initializing auth store:', error);
      set({
        isInitialized: true,
        isLoading: false,
        authError: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  },

  completeSetup: async () => {
    try {
      await SecureStore.setItemAsync('setupComplete', 'true');
      return true;
    } catch (error) {
      console.error('Error completing setup:', error);
      return false;
    }
  },

  login: async () => {
    set({ isLoading: true, authError: null });
    try {
      const success = await authenticate();
      set({
        isAuthenticated: success,
        isLoading: false,
        lastActive: new Date(),
      });
      return success;
    } catch (error) {
      set({
        authError: error instanceof Error ? error.message : String(error),
        isLoading: false,
      });
      return false;
    }
  },

  logout: () => {
    set({ isAuthenticated: false });
  },

  updateLastActive: () => {
    set({ lastActive: new Date() });
  },

  checkTimeout: (timeoutDuration = 300000) => {
    const { lastActive, isAuthenticated, logout } = get();

    if (!isAuthenticated) return;

    const now = new Date();
    const timeDiff = now.getTime() - lastActive.getTime();

    if (timeDiff > timeoutDuration) {
      logout();
      return true;
    }

    return false;
  },
}));

export default useAuthStore;
