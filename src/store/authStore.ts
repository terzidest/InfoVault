import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';
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
import { wipeAllRecords } from '../services/legacyVault';
import { hasV1Data } from '../services/migrateV1';
import { removeVault, vaultExists, writeVault } from '../services/vaultFile';
import { checkAuthenticationTypes } from '../services/authentication';
import { clearSensitiveClipboard } from '../services/clipboard';
import useRecordsStore from './recordsStore';
import { isLiveKey } from './vaultKey';

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

// Everything SecureStore holds about the vault's key material and setup
// state. Removed when init() decides the device holds no vault any more.
const VAULT_ENTRY_KEYS = [
  HEADER_KEY,
  LEGACY_SALT_KEY,
  LEGACY_VERIFIER_KEY,
  BIOMETRIC_KEY_STORE,
  BIOMETRIC_ENABLED_KEY,
  SETUP_KEY,
] as const;

const clearVaultEntries = async (): Promise<void> => {
  for (const key of VAULT_ENTRY_KEYS) {
    await SecureStore.deleteItemAsync(key);
  }
};

// Undoes a setup that failed after its header was written. Nothing of value
// exists yet (setup starts from a wiped vault), so the clean outcome is a
// device with no vault at all and Setup on the next launch. Best-effort: a
// leftover header with no file is caught by init()'s fresh-install rule.
const rollbackSetup = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(HEADER_KEY);
    await SecureStore.deleteItemAsync(SETUP_KEY);
    await removeVault();
  } catch {
    // init() will finish the job.
  }
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
  // Set when a biometric unlock found the keystore entry gone or unreadable
  // (OS enrollment change invalidates it). The next password unlock re-stores
  // the key copy. In-memory only; it never needs to survive a restart because
  // the same biometric failure will set it again.
  biometricRepairNeeded: boolean;
  // Result of init()'s one registry probe: v1 (pre-2.0) record entries are on
  // the device and will be migrated by the next open(). Refreshed after each
  // open from recordsStore.migrationPending, so a retry still shows as one.
  hasLegacyData: boolean;
  // True while recordsStore.open() runs with v1 entries to convert, so the
  // unlock screen can say the vault is being upgraded rather than just spin.
  isMigrating: boolean;
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

const useAuthStore = create<AuthState>((set, get) => {
  // Puts `key` in state and loads the records under it. Resolves true when the
  // vault is open and the session may be marked authenticated. On a failed
  // open the key is zeroed and dropped: no half-unlocked session, and the
  // error message carries nothing from the file.
  const openRecords = async (key: Uint8Array): Promise<boolean> => {
    set({ encryptionKey: key, isMigrating: get().hasLegacyData });
    try {
      const opened = await useRecordsStore.getState().open();
      // A migration that threw leaves v1 entries for the next unlock, which
      // is then again an upgrade.
      set({ isMigrating: false, hasLegacyData: useRecordsStore.getState().migrationPending });
      // false: locked while opening; the lock already zeroed and dropped the key.
      return opened;
    } catch (error) {
      console.error('Vault open error', error instanceof Error ? error.name : '');
      key.fill(0);
      useRecordsStore.getState().clear();
      set({
        encryptionKey: null,
        isAuthenticated: false,
        isMigrating: false,
        isLoading: false,
        authError: 'Vault could not be opened',
      });
      return false;
    }
  };

  return {
    isAuthenticated: false,
    isInitialized: false,
    isLoading: false,
    authError: null,
    needsSetup: false,
    encryptionKey: null,
    biometricAvailable: false,
    biometricEnabled: false,
    biometricRepairNeeded: false,
    hasLegacyData: false,
    isMigrating: false,

    init: async () => {
      set({ isLoading: true });
      try {
        let setupComplete = await SecureStore.getItemAsync(SETUP_KEY);
        let enabledFlag = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        const header = await SecureStore.getItemAsync(HEADER_KEY);
        const legacySalt = await SecureStore.getItemAsync(LEGACY_SALT_KEY);

        // Fresh-install rule. iOS keeps Keychain entries across an uninstall but
        // not the document directory, and an interrupted setup can leave a
        // header behind: key material with no vault file and no v1 records to
        // open is a reinstall, not a corrupt vault. Clear it and run setup. A
        // v1 install that has not migrated yet still has its registries, and a
        // commit interrupted mid-move still has `.bak` (vaultExists covers it).
        // One probe per launch; openRecords reuses the answer.
        const hasLegacyData = await hasV1Data();
        const hasKeyMaterial = setupComplete === 'true' || header !== null || legacySalt !== null;
        if (hasKeyMaterial && !vaultExists() && !hasLegacyData) {
          await clearVaultEntries();
          setupComplete = null;
          enabledFlag = null;
        }

        let biometricAvailable = false;
        try {
          const authTypes = await checkAuthenticationTypes();
          biometricAvailable = authTypes.hasHardware && authTypes.isEnrolled;
        } catch {
          biometricAvailable = false;
        }

        set({
          needsSetup: setupComplete !== 'true',
          hasLegacyData,
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
          hasLegacyData: false,
          biometricAvailable: false,
          biometricEnabled: false,
          isInitialized: true,
          isLoading: false,
        });
      }
    },

    setupMasterPassword: async (password) => {
      set({ isLoading: true, authError: null });
      let key: Uint8Array | null = null;
      try {
        key = await generateVaultKey();
        await writeHeader(password, key);
        await deleteLegacyEntries();

        // Fresh vault: nothing sealed under an earlier key may survive — neither
        // v1 entries nor a stale vault.bin (which would fail every later open).
        await wipeAllRecords();
        await removeVault();
        await SecureStore.setItemAsync(SETUP_KEY, 'true');

        lastActivityAt = Date.now();
        // wipeAllRecords just ran: nothing v1 is left to migrate.
        set({ encryptionKey: key, needsSetup: false, hasLegacyData: false });
        await writeVault({ records: [] }, key, isLiveKey);
        if (!(await openRecords(key))) throw new Error('Vault did not open after setup');
        set({ isAuthenticated: true, isLoading: false });
        return true;
      } catch (error) {
        // Roll back to "no vault": nothing valuable exists yet, and a clean
        // Setup on the next launch beats a header nobody can open.
        console.error('Vault setup error', error);
        key?.fill(0);
        useRecordsStore.getState().clear();
        await rollbackSetup();
        set({
          encryptionKey: null,
          isAuthenticated: false,
          needsSetup: true,
          isMigrating: false,
          authError: 'Could not set up your vault',
          isLoading: false,
        });
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
        if (!(await openRecords(key))) {
          set({ isLoading: false });
          return false;
        }
        set({ isAuthenticated: true, isLoading: false, authError: null });

        // Self-heal biometric unlock: an OS enrollment change permanently
        // invalidates the keystore entry, so biometric unlock fails while the
        // setting still claims enabled. Re-store the key copy — but only after
        // a biometric unlock has actually hit that, because on Android an
        // auth-gated write itself shows the biometric prompt (the cipher goes
        // through BiometricPrompt). Doing it on every password unlock put a
        // fingerprint prompt on the Home screen. Best-effort.
        if (get().biometricEnabled && get().biometricRepairNeeded) {
          SecureStore.setItemAsync(BIOMETRIC_KEY_STORE, bytesToHex(key), {
            requireAuthentication: true,
            authenticationPrompt: 'Re-enable biometric unlock for InfoVault',
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          })
            .then(() => set({ biometricRepairNeeded: false }))
            .catch(() => {});
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
          // Entry missing or invalidated (Android reads an invalidated entry
          // back as null): queue a re-store for the next password unlock.
          set({ isLoading: false, biometricRepairNeeded: get().biometricEnabled });
          return false;
        }
        const sessionKey = hexToBytes(keyHex);
        lastActivityAt = Date.now();
        if (!(await openRecords(sessionKey))) {
          set({ isLoading: false });
          return false;
        }
        set({ isAuthenticated: true, isLoading: false, authError: null });
        return true;
      } catch (error) {
        // Stay locked; the password fallback remains available on the screen.
        // A dismissed prompt is not a broken entry ("User canceled …" on both
        // platforms); anything else is treated as the entry being unreadable.
        const cancelled = error instanceof Error && /cancel/i.test(error.message);
        set({ isLoading: false, biometricRepairNeeded: !cancelled && get().biometricEnabled });
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
        set({ biometricEnabled: true, biometricRepairNeeded: false });
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
      set({ biometricEnabled: false, biometricRepairNeeded: false });
    },

    logout: () => {
      // Locking must drop every trace of the unlocked session: zero the key
      // bytes and evict the decrypted records from recordsStore.
      get().encryptionKey?.fill(0);
      set({ isAuthenticated: false, encryptionKey: null, isMigrating: false });
      useRecordsStore.getState().clear();
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
  };
});

export default useAuthStore;
