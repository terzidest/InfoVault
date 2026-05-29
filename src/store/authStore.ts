import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { generateSalt, deriveKey, makeVerifier, verifyKey } from '../utils/crypto';
import { wipeAllRecords } from '../services/secureStorage';

const SETUP_KEY = 'setupComplete';
const SALT_KEY = 'vaultSalt';
const VERIFIER_KEY = 'vaultVerifier';

interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  authError: string | null;
  lastActive: Date;
  needsSetup: boolean;
  // In-memory only. Never persisted in plaintext, never logged. Cleared on lock.
  encryptionKey: Uint8Array | null;
  init: () => Promise<void>;
  setupMasterPassword: (password: string) => Promise<boolean>;
  unlockWithPassword: (password: string) => Promise<boolean>;
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
  needsSetup: false,
  encryptionKey: null,

  init: async () => {
    set({ isLoading: true });
    try {
      const setupComplete = await SecureStore.getItemAsync(SETUP_KEY);
      set({
        needsSetup: setupComplete !== 'true',
        isInitialized: true,
        isLoading: false,
      });
    } catch (error) {
      // On a read error, default to the unlock path rather than setup, so a
      // transient failure can never trigger the wipe-on-setup.
      console.error('Auth init error', error);
      set({ needsSetup: false, isInitialized: true, isLoading: false });
    }
  },

  setupMasterPassword: async (password) => {
    set({ isLoading: true, authError: null });
    try {
      const salt = await generateSalt();
      const key = await deriveKey(password, salt);
      const verifier = await makeVerifier(key);

      await SecureStore.setItemAsync(SALT_KEY, salt);
      await SecureStore.setItemAsync(VERIFIER_KEY, verifier);

      // Fresh encrypted vault: clear any pre-existing plaintext test records.
      await wipeAllRecords();
      await SecureStore.setItemAsync(SETUP_KEY, 'true');

      set({
        encryptionKey: key,
        isAuthenticated: true,
        needsSetup: false,
        isLoading: false,
        lastActive: new Date(),
      });
      return true;
    } catch (error) {
      console.error('Vault setup error', error);
      set({ authError: 'Could not set up your vault', isLoading: false });
      return false;
    }
  },

  unlockWithPassword: async (password) => {
    set({ isLoading: true, authError: null });
    try {
      const salt = await SecureStore.getItemAsync(SALT_KEY);
      const verifier = await SecureStore.getItemAsync(VERIFIER_KEY);
      if (!salt || !verifier) {
        set({ authError: 'Vault is not set up', isLoading: false });
        return false;
      }

      const key = await deriveKey(password, salt);
      if (!verifyKey(verifier, key)) {
        set({ authError: 'Incorrect master password', isLoading: false });
        return false;
      }

      set({
        encryptionKey: key,
        isAuthenticated: true,
        isLoading: false,
        lastActive: new Date(),
        authError: null,
      });
      return true;
    } catch (error) {
      console.error('Unlock error', error);
      set({ authError: 'Unable to unlock the vault', isLoading: false });
      return false;
    }
  },

  logout: () => {
    set({ isAuthenticated: false, encryptionKey: null });
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
