import { create } from 'zustand';
import {
  saveToSecureStore,
  getFromSecureStore,
  deleteFromSecureStore,
  getAllItemsByType,
} from '../services/secureStorage';
import { generateSecureId } from '../utils/crypto';
import type { PersonalInfo, PersonalInfoInput } from '../types/models';

interface PersonalInfoState {
  personalInfo: PersonalInfo[];
  isLoading: boolean;
  error: string | null;
  loadPersonalInfo: () => Promise<PersonalInfo[]>;
  addPersonalInfo: (info: PersonalInfoInput) => Promise<PersonalInfo>;
  updatePersonalInfo: (id: string, updatedData: Partial<PersonalInfo>) => Promise<PersonalInfo>;
  deletePersonalInfo: (id: string) => Promise<boolean>;
  getPersonalInfoById: (id: string) => PersonalInfo | undefined;
  clearPersonalInfo: () => void;
}

const usePersonalInfoStore = create<PersonalInfoState>((set, get) => ({
  personalInfo: [],
  isLoading: false,
  error: null,

  loadPersonalInfo: async () => {
    set({ isLoading: true, error: null });
    try {
      const personalInfo = await getAllItemsByType<PersonalInfo>('personalInfo');
      set({ personalInfo, isLoading: false });
      return personalInfo;
    } catch (error) {
      console.error('Error loading personal information:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      return [];
    }
  },

  addPersonalInfo: async (info) => {
    set({ isLoading: true, error: null });
    try {
      const id = generateSecureId();
      const now = new Date().toISOString();

      const newInfo: PersonalInfo = {
        id,
        ...info,
        createdAt: now,
        updatedAt: now,
      };

      await saveToSecureStore(id, newInfo, 'personalInfo');

      const personalInfo = [...get().personalInfo, newInfo];
      set({ personalInfo, isLoading: false });

      return newInfo;
    } catch (error) {
      console.error('Error adding personal information:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      throw error;
    }
  },

  updatePersonalInfo: async (id, updatedData) => {
    set({ isLoading: true, error: null });
    try {
      const existingInfo = await getFromSecureStore<PersonalInfo>(id);

      if (!existingInfo) {
        throw new Error('Personal information not found');
      }

      const updatedInfo: PersonalInfo = {
        ...existingInfo,
        ...updatedData,
        updatedAt: new Date().toISOString(),
      };

      await saveToSecureStore(id, updatedInfo, 'personalInfo');

      const personalInfo = get().personalInfo.map((info) =>
        info.id === id ? { ...info, ...updatedInfo } : info
      );

      set({ personalInfo, isLoading: false });

      return updatedInfo;
    } catch (error) {
      console.error('Error updating personal information:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      throw error;
    }
  },

  deletePersonalInfo: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await deleteFromSecureStore(id, 'personalInfo');

      const personalInfo = get().personalInfo.filter((info) => info.id !== id);
      set({ personalInfo, isLoading: false });

      return true;
    } catch (error) {
      console.error('Error deleting personal information:', error);
      set({ error: error instanceof Error ? error.message : String(error), isLoading: false });
      throw error;
    }
  },

  getPersonalInfoById: (id) => {
    return get().personalInfo.find((info) => info.id === id);
  },

  clearPersonalInfo: () => {
    set({ personalInfo: [], error: null });
  },
}));

export default usePersonalInfoStore;
