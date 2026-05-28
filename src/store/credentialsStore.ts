import { create } from 'zustand';
import {
  saveToSecureStore,
  getFromSecureStore,
  deleteFromSecureStore,
  getAllItemsByType,
} from '../services/secureStorage';
import { generateSecureId } from '../utils/crypto';
import type { Credential, CredentialInput } from '../types/models';

interface CredentialsState {
  credentials: Credential[];
  isLoading: boolean;
  error: string | null;
  loadCredentials: () => Promise<Credential[]>;
  addCredential: (credential: CredentialInput) => Promise<Credential>;
  updateCredential: (id: string, updatedData: Partial<Credential>) => Promise<Credential>;
  deleteCredential: (id: string) => Promise<boolean>;
  getCredentialById: (id: string) => Credential | undefined;
  clearCredentials: () => void;
}

const useCredentialsStore = create<CredentialsState>((set, get) => ({
  credentials: [],
  isLoading: false,
  error: null,

  loadCredentials: async () => {
    set({ isLoading: true, error: null });
    try {
      const credentials = await getAllItemsByType<Credential>('credential');
      set({ credentials, isLoading: false });
      return credentials;
    } catch (error) {
      console.error('Error loading credentials:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      return [];
    }
  },

  addCredential: async (credential) => {
    set({ isLoading: true, error: null });
    try {
      const id = generateSecureId();
      const now = new Date().toISOString();

      const newCredential: Credential = {
        id,
        ...credential,
        createdAt: now,
        updatedAt: now,
      };

      await saveToSecureStore(id, newCredential, 'credential');

      const credentials = [...get().credentials, newCredential];
      set({ credentials, isLoading: false });

      return newCredential;
    } catch (error) {
      console.error('Error adding credential:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      throw error;
    }
  },

  updateCredential: async (id, updatedData) => {
    set({ isLoading: true, error: null });
    try {
      const existingCredential = await getFromSecureStore<Credential>(id);

      if (!existingCredential) {
        throw new Error('Credential not found');
      }

      const updatedCredential: Credential = {
        ...existingCredential,
        ...updatedData,
        updatedAt: new Date().toISOString(),
      };

      await saveToSecureStore(id, updatedCredential, 'credential');

      const credentials = get().credentials.map((cred) =>
        cred.id === id ? { ...cred, ...updatedCredential } : cred
      );

      set({ credentials, isLoading: false });

      return updatedCredential;
    } catch (error) {
      console.error('Error updating credential:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      throw error;
    }
  },

  deleteCredential: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await deleteFromSecureStore(id, 'credential');

      const credentials = get().credentials.filter((cred) => cred.id !== id);
      set({ credentials, isLoading: false });

      return true;
    } catch (error) {
      console.error('Error deleting credential:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      throw error;
    }
  },

  getCredentialById: (id) => {
    return get().credentials.find((cred) => cred.id === id);
  },

  clearCredentials: () => {
    set({ credentials: [], error: null });
  },
}));

export default useCredentialsStore;
