import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils';
import { generateSalt, deriveKey, makeVerifier, verifyKey } from '../utils/crypto';
import { wipeAllRecords } from '../services/secureStorage';
import { checkAuthenticationTypes } from '../services/authentication';

const SETUP_KEY = 'setupComplete';
const SALT_KEY = 'vaultSalt';
const VERIFIER_KEY = 'vaultVerifier';
const BIOMETRIC_KEY_STORE = 'vaultBiometricKey';
const BIOMETRIC_ENABLED_KEY = 'vaultBiometricEnabled';

interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  authError: string | null;
  lastActive: Date;
  needsSetup: boolean;
  // In-memory only. Never persisted in plaintext, never logged. Cleared on lock.
  encryptionKey: Uint8Array | null;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  init: () => Promise<void>;
  setupMasterPassword: (password: string) => Promise<boolean>;
  unlockWithPassword: (password: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  enableBiometricUnlock: () => Promise<boolean>;
  disableBiometricUnlock: () => Promise<void>;
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
  biometricAvailable: false,
  biometricEnabled: false,

  init: async () => {
    set({ isLoading: true });
    try {
      const setupComplete = await SecureStore.getItemAsync(SETUP_KEY);
      const enabledFlag = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);

      let biometricAvailable = false;
      try {
        const authTypes = await checkAuthenticationTypes();
        biometricAvailable = authTypes.hasHardware && authTypes.isEnrolled;
      } catch {
        biometricAvailable = false;
      }

      set({
        needsSetup: setupComplete !== 'true',
        biometricAvailable,
        // Treat biometric as enabled only when both the user opted in AND the
        // device still has enrolled biometrics; otherwise UI/flow falls back
        // to the master-password path.
        biometricEnabled: enabledFlag === 'true' && biometricAvailable,
        isInitialized: true,
        isLoading: false,
      });
    } catch (error) {
      // On a read error, default to the unlock path rather than setup, so a
      // transient failure can never trigger the wipe-on-setup.
      console.error('Auth init error', error);
      set({
        needsSetup: false,
        biometricAvailable: false,
        biometricEnabled: false,
        isInitialized: true,
        isLoading: false,
      });
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

  unlockWithBiometrics: async () => {
    set({ isLoading: true, authError: null });
    try {
      const keyHex = await SecureStore.getItemAsync(BIOMETRIC_KEY_STORE, {
        requireAuthentication: true,
        authenticationPrompt: 'Unlock InfoVault',
      });
      if (!keyHex) {
        set({ isLoading: false });
        return false;
      }
      const sessionKey = hexToBytes(keyHex);
      set({
        encryptionKey: sessionKey,
        isAuthenticated: true,
        isLoading: false,
        lastActive: new Date(),
        authError: null,
      });
      return true;
    } catch {
      // User cancelled the OS prompt, or biometric retrieval failed.
      // Stay locked; the password fallback remains available on the screen.
      set({ isLoading: false });
      return false;
    }
  },

  enableBiometricUnlock: async () => {
    const sessionKey = get().encryptionKey;
    if (!sessionKey) {
      set({ authError: 'Vault must be unlocked to enable biometric unlock' });
      return false;
    }
    try {
      const keyHex = bytesToHex(sessionKey);
      await SecureStore.setItemAsync(BIOMETRIC_KEY_STORE, keyHex, {
        requireAuthentication: true,
        authenticationPrompt: 'Enable biometric unlock for InfoVault',
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
      set({ biometricEnabled: true });
      return true;
    } catch (error) {
      console.error('Biometric enable error', error);
      return false;
    }
  },

  disableBiometricUnlock: async () => {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_KEY_STORE);
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    } catch (error) {
      console.error('Biometric disable error', error);
    }
    set({ biometricEnabled: false });
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
