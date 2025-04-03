import { create } from 'zustand';
import { 
  saveToSecureStore, 
  getFromSecureStore, 
  deleteFromSecureStore, 
  getAllItemsByType 
} from '../services/secureStorage';
import { generateSecureId } from '../utils/encryption';

/**
 * Personal Information state management using Zustand
 */
const usePersonalInfoStore = create((set, get) => ({
  // State
  personalInfo: [],
  isLoading: false,
  error: null,
  
  // Load all personal information
  loadPersonalInfo: async () => {
    set({ isLoading: true, error: null });
    try {
      const personalInfo = await getAllItemsByType('personalInfo');
      set({ personalInfo, isLoading: false });
      return personalInfo;
    } catch (error) {
      console.error('Error loading personal information:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },
  
  // Add new personal information
  addPersonalInfo: async (info) => {
    set({ isLoading: true, error: null });
    try {
      // Generate unique ID
      const id = generateSecureId();
      
      // Prepare the personal info with metadata
      const newInfo = {
        id,
        ...info,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save to secure storage
      await saveToSecureStore(id, newInfo, 'personalInfo');
      
      // Update state
      const personalInfo = [...get().personalInfo, newInfo];
      set({ personalInfo, isLoading: false });
      
      return newInfo;
    } catch (error) {
      console.error('Error adding personal information:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Update existing personal information
  updatePersonalInfo: async (id, updatedData) => {
    set({ isLoading: true, error: null });
    try {
      // Get the existing personal info
      const existingInfo = await getFromSecureStore(id);
      
      if (!existingInfo) {
        throw new Error('Personal information not found');
      }
      
      // Merge data and update metadata
      const updatedInfo = {
        ...existingInfo,
        ...updatedData,
        updatedAt: new Date().toISOString()
      };
      
      // Save to secure storage
      await saveToSecureStore(id, updatedInfo, 'personalInfo');
      
      // Update state
      const personalInfo = get().personalInfo.map(info => 
        info.id === id ? { ...info, ...updatedInfo } : info
      );
      
      set({ personalInfo, isLoading: false });
      
      return updatedInfo;
    } catch (error) {
      console.error('Error updating personal information:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Delete personal information
  deletePersonalInfo: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Delete from secure storage
      await deleteFromSecureStore(id, 'personalInfo');
      
      // Update state
      const personalInfo = get().personalInfo.filter(info => info.id !== id);
      set({ personalInfo, isLoading: false });
      
      return true;
    } catch (error) {
      console.error('Error deleting personal information:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Get personal info by ID
  getPersonalInfoById: (id) => {
    return get().personalInfo.find(info => info.id === id);
  },
  
  // Clear personal info state (e.g., on logout)
  clearPersonalInfo: () => {
    set({ personalInfo: [], error: null });
  }
}));

export default usePersonalInfoStore;
