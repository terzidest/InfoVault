import * as SecureStore from 'expo-secure-store';
import type { StorageType } from '../types/storage';
import { encryptRecord, decryptRecord } from '../utils/crypto';
import useAuthStore from '../store/authStore';
import { requireKey } from '../store/vaultKey';
import { registryKey } from './legacyVault';

// v1 per-record SecureStore CRUD. Only the three v1 domain stores still use
// it; they go at the screen cutover and this file with them. The layout's
// names and the wipe live in legacyVault.ts, which migration/setup use.

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

    const keys = (await SecureStore.getItemAsync(registryKey(type))) || '[]';
    const parsedKeys: string[] = JSON.parse(keys);

    if (!parsedKeys.includes(key)) {
      parsedKeys.push(key);
      await SecureStore.setItemAsync(registryKey(type), JSON.stringify(parsedKeys));
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

    const keys = (await SecureStore.getItemAsync(registryKey(type))) || '[]';
    const parsedKeys: string[] = JSON.parse(keys);
    const updatedKeys = parsedKeys.filter((k) => k !== key);
    await SecureStore.setItemAsync(registryKey(type), JSON.stringify(updatedKeys));

    return true;
  } catch (error) {
    console.error('Error deleting from SecureStore', error);
    throw error;
  }
};

export const getKeysByType = async (type: StorageType): Promise<string[]> => {
  try {
    const keys = (await SecureStore.getItemAsync(registryKey(type))) || '[]';
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
