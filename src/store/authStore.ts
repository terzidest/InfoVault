import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils';
import {
  CURRENT_KDF,
  LEGACY_KDF,
  deriveKey,
  generateSalt,
  generateVaultKey,
  isSameKdf,
  parseVaultHeader,
  serializeVaultHeader,
  unwrapVaultKey,
  verifyKey,
  wrapVaultKey,
} from '../utils/crypto';
import type { VaultHeader } from '../utils/crypto';
import { wipeAllRecords } from '../services/secureStorage';
import { checkAuthenticationTypes } from '../services/authentication';
import { clearSensitiveClipboard } from '../services/clipboard';
import useCredentialsStore from './credentialsStore';
import useNotesStore from './notesStore';
import usePersonalInfoStore from './personalInfoStore';

// Last user-activity timestamp for the idle timeout. Deliberately NOT part
// of the reactive store state: it changes on every touch, nothing renders
// it, and putting it through set() re-rendered every mounted screen
// mid-gesture (dropped taps, janky transitions).
let lastActivityAt = Date.now();

const SETUP_KEY = 'setupComplete';
const HEADER_KEY = 'vaultHeader';
// Legacy (pre-header) vaults: the password-derived key encrypted records
// directly and was checked against a verifier. Migrated on password unlock.
const LEGACY_SALT_KEY = 'vaultSalt';
const LEGACY_VERIFIER_KEY = 'vaultVerifier';
const BIOMETRIC_KEY_STORE = 'vaultBiometricKey';
const BIOMETRIC_ENABLED_KEY = 'vaultBiometricEnabled';

// Seals the vault key under a key derived with CURRENT_KDF and a fresh salt.
// The fresh salt matters for migrated legacy vaults: their vault key IS the
// old derived key, so reusing the old salt would wrap the key under itself.
const writeHeader = async (password: string, vaultKey: Uint8Array): Promise<void> => {
  const salt = await generateSalt();
  const wrappingKey = await deriveKey(password, salt, CURRENT_KDF);
  try {
    const header: VaultHeader = {
      version: 2,
      kdf: CURRENT_KDF,
      salt,
      wrappedKey: await wrapVaultKey(vaultKey, wrappingKey),
    };
    await SecureStore.setItemAsync(HEADER_KEY, serializeVaultHeader(header));
  } finally {
    wrappingKey.fill(0);
  }
};

const deleteLegacyEntries = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(LEGACY_SALT_KEY);
  await SecureStore.deleteItemAsync(LEGACY_VERIFIER_KEY);
};

type OpenVaultResult =
  | { status: 'unlocked'; vaultKey: Uint8Array }
  | { status: 'wrong-password' }
  | { status: 'not-set-up' };

const openVault = async (password: string): Promise<OpenVaultResult> => {
  const rawHeader = await SecureStore.getItemAsync(HEADER_KEY);
  if (rawHeader) {
    const header = parseVaultHeader(rawHeader);
    const wrappingKey = await deriveKey(password, header.salt, header.kdf);
    const vaultKey = unwrapVaultKey(header.wrappedKey, wrappingKey);
    wrappingKey.fill(0);
    if (!vaultKey) return { status: 'wrong-password' };

    // KDF upgrade: re-wrap under the current parameters. Only the 32-byte
    // vault key changes hands — records are untouched. Best-effort: the old
    // header still opens the vault, so a failure just retries next unlock.
    if (!isSameKdf(header.kdf, CURRENT_KDF)) {
      await writeHeader(password, vaultKey).catch(() => {});
    }
    return { status: 'unlocked', vaultKey };
  }

  const salt = await SecureStore.getItemAsync(LEGACY_SALT_KEY);
  const verifier = await SecureStore.getItemAsync(LEGACY_VERIFIER_KEY);
  if (!salt || !verifier) return { status: 'not-set-up' };

  const legacyKey = await deriveKey(password, salt, LEGACY_KDF);
  if (!verifyKey(verifier, legacyKey)) {
    legacyKey.fill(0);
    return { status: 'wrong-password' };
  }

  // Migrate: the legacy key becomes the vault key, so every record and the
  // biometric keystore copy stay valid with no re-encryption. The header is
  // one atomic write and takes precedence once present; until it lands the
  // legacy entries still open the vault, so a failure just retries next
  // unlock.
  try {
    await writeHeader(password, legacyKey);
    await deleteLegacyEntries();
  } catch {
    // Best-effort; see above.
  }
  return { status: 'unlocked', vaultKey: legacyKey };
};

interface AuthState {
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  authError: string | null;
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
      const key = await generateVaultKey();
      await writeHeader(password, key);
      await deleteLegacyEntries();

      // Fresh encrypted vault: clear any pre-existing plaintext test records.
      await wipeAllRecords();
      await SecureStore.setItemAsync(SETUP_KEY, 'true');

      lastActivityAt = Date.now();
      set({
        encryptionKey: key,
        isAuthenticated: true,
        needsSetup: false,
        isLoading: false,
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
      const result = await openVault(password);
      if (result.status === 'not-set-up') {
        set({ authError: 'Vault is not set up', isLoading: false });
        return false;
      }
      if (result.status === 'wrong-password') {
        set({ authError: 'Incorrect master password', isLoading: false });
        return false;
      }
      const key = result.vaultKey;

      lastActivityAt = Date.now();
      set({
        encryptionKey: key,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
      });

      // Self-heal biometric unlock: OS biometric enrollment changes can
      // permanently invalidate the keystore entry (biometric unlock then
      // fails silently while the setting still claims enabled). Re-storing
      // the key on every password unlock repairs it — writes to auth-gated
      // entries don't prompt on either platform. Best-effort.
      if (get().biometricEnabled) {
        SecureStore.setItemAsync(BIOMETRIC_KEY_STORE, bytesToHex(key), {
          requireAuthentication: true,
          authenticationPrompt: 'Enable biometric unlock for InfoVault',
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }).catch(() => {});
      }
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
      lastActivityAt = Date.now();
      set({
        encryptionKey: sessionKey,
        isAuthenticated: true,
        isLoading: false,
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
    // Locking must drop every trace of the unlocked session: zero the key
    // bytes and evict all decrypted records from the domain stores.
    get().encryptionKey?.fill(0);
    set({ isAuthenticated: false, encryptionKey: null });
    useCredentialsStore.getState().clearCredentials();
    useNotesStore.getState().clearNotes();
    usePersonalInfoStore.getState().clearPersonalInfo();
    clearSensitiveClipboard();
  },

  updateLastActive: () => {
    lastActivityAt = Date.now();
  },

  checkTimeout: (timeoutDuration = 300000) => {
    const { isAuthenticated, logout } = get();

    if (!isAuthenticated) return;

    if (Date.now() - lastActivityAt > timeoutDuration) {
      logout();
      return true;
    }

    return false;
  },
}));

export default useAuthStore;
