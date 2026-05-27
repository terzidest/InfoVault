import * as SecureStore from 'expo-secure-store';
import type { StorageType } from '../types/storage';

export const saveToSecureStore = async (
  key: string,
  value: unknown,
  type: StorageType
): Promise<boolean> => {
  try {
    const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);

    await SecureStore.setItemAsync(key, valueToStore);

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

export async function getFromSecureStore<T = unknown>(key: string, parseJson?: true): Promise<T | null>;
export async function getFromSecureStore(key: string, parseJson: false): Promise<string | null>;
export async function getFromSecureStore<T = unknown>(
  key: string,
  parseJson: boolean = true
): Promise<T | string | null> {
  try {
    const value = await SecureStore.getItemAsync(key);

    if (!value) return null;

    return parseJson ? (JSON.parse(value) as T) : value;
  } catch (error) {
    console.error('Error reading from SecureStore', error);
    throw error;
  }
}

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
      const item = await getFromSecureStore<T>(key);
      if (item) items.push(item);
    }

    return items;
  } catch (error) {
    console.error('Error getting all items by type', error);
    return [];
  }
};
