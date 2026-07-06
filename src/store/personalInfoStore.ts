import { create } from 'zustand';
import {
  saveToSecureStore,
  getFromSecureStore,
  deleteFromSecureStore,
  getAllItemsByType,
} from '../services/secureStorage';
import { generateSecureId } from '../utils/crypto';
import { createOpTracker } from './opTracker';
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

const ops = createOpTracker();

const usePersonalInfoStore = create<PersonalInfoState>((set, get) => ({
  personalInfo: [],
  isLoading: false,
  error: null,

  loadPersonalInfo: async () => {
    ops.begin(set);
    try {
      const personalInfo = await getAllItemsByType<PersonalInfo>('personalInfo');
      set({ personalInfo });
      return personalInfo;
    } catch (error) {
      console.error('Error loading personal information:', error);
      set({ error: error instanceof Error ? error.message : String(error) });
      return [];
    } finally {
      ops.end(set);
    }
  },

  addPersonalInfo: async (info) => {
    ops.begin(set);
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
      set({ personalInfo });

      return newInfo;
    } catch (error) {
      console.error('Error adding personal information:', error);
      set({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      ops.end(set);
    }
  },

  updatePersonalInfo: async (id, updatedData) => {
    ops.begin(set);
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

      set({ personalInfo });

      return updatedInfo;
    } catch (error) {
      console.error('Error updating personal information:', error);
      set({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      ops.end(set);
    }
  },

  deletePersonalInfo: async (id) => {
    ops.begin(set);
    try {
      await deleteFromSecureStore(id, 'personalInfo');

      const personalInfo = get().personalInfo.filter((info) => info.id !== id);
      set({ personalInfo });

      return true;
    } catch (error) {
      console.error('Error deleting personal information:', error);
      set({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      ops.end(set);
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
