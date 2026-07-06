import * as SecureStore from 'expo-secure-store';
import type { StorageType } from '../types/storage';
import { encryptRecord, decryptRecord } from '../utils/crypto';
import useAuthStore from '../store/authStore';

const STORAGE_TYPES: StorageType[] = ['credential', 'note', 'personalInfo'];

// The in-memory key lives in authStore; read it at call-time (never at module
// load) so the authStore <-> secureStorage import cycle stays safe.
const requireKey = (): Uint8Array => {
  const key = useAuthStore.getState().encryptionKey;
  if (!key) throw new Error('Vault is locked');
  return key;
};

export const saveToSecureStore = async (
  key: string,
  value: unknown,
  type: StorageType
): Promise<boolean> => {
  try {
    const sessionKey = requireKey();
    const sealed = await encryptRecord(value, sessionKey);
    // logout() zeroes the key bytes in place; if the vault locked while we
    // were sealing, this record was encrypted with a dead key — abort rather
    // than persist an undecryptable record.
    if (useAuthStore.getState().encryptionKey !== sessionKey) {
      throw new Error('Vault is locked');
    }
    await SecureStore.setItemAsync(key, sealed);

    const keys = (await SecureStore.getItemAsync(type + 'Keys')) || '[]';
    const parsedKeys: string[] = JSON.parse(keys);

    if (!parsedKeys.includes(key)) {
      parsedKeys.push(key);
      await SecureStore.setItemAsync(type + 'Keys', JSON.stringify(parsedKeys));
    }

    return true;
  } catch (error) {
    console.error('Error saving to SecureStore', error);
    throw error;
  }
};

export const getFromSecureStore = async <T = unknown>(key: string): Promise<T | null> => {
  const value = await SecureStore.getItemAsync(key);
  if (!value) return null;
  return decryptRecord<T>(value, requireKey());
};

export const deleteFromSecureStore = async (key: string, type: StorageType): Promise<boolean> => {
  try {
    await SecureStore.deleteItemAsync(key);

    const keys = (await SecureStore.getItemAsync(type + 'Keys')) || '[]';
    const parsedKeys: string[] = JSON.parse(keys);
    const updatedKeys = parsedKeys.filter((k) => k !== key);
    await SecureStore.setItemAsync(type + 'Keys', JSON.stringify(updatedKeys));

    return true;
  } catch (error) {
    console.error('Error deleting from SecureStore', error);
    throw error;
  }
};

export const getKeysByType = async (type: StorageType): Promise<string[]> => {
  try {
    const keys = (await SecureStore.getItemAsync(type + 'Keys')) || '[]';
    return JSON.parse(keys);
  } catch (error) {
    console.error('Error getting keys by type', error);
    return [];
  }
};

export const getAllItemsByType = async <T = unknown>(type: StorageType): Promise<T[]> => {
  try {
    const keys = await getKeysByType(type);
    const items: T[] = [];

    for (const key of keys) {
      try {
        const item = await getFromSecureStore<T>(key);
        if (item) items.push(item);
      } catch {
        console.warn('Skipping a record that could not be read');
      }
    }

    return items;
  } catch (error) {
    console.error('Error getting all items by type', error);
    return [];
  }
};

// Deletes every stored record across all types (and their key registries).
// Needs no encryption key — used to reset the vault on first encrypted launch.
export const wipeAllRecords = async (): Promise<void> => {
  for (const type of STORAGE_TYPES) {
    const keys = await getKeysByType(type);
    for (const key of keys) {
      await SecureStore.deleteItemAsync(key);
    }
    await SecureStore.deleteItemAsync(type + 'Keys');
  }
};
