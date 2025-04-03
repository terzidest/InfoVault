import { create } from 'zustand';
import { 
  saveToSecureStore, 
  getFromSecureStore, 
  deleteFromSecureStore, 
  getAllItemsByType 
} from '../services/secureStorage';
import { generateSecureId } from '../utils/encryption';

/**
 * Credentials state management using Zustand
 */
const useCredentialsStore = create((set, get) => ({
  // State
  credentials: [],
  isLoading: false,
  error: null,
  
  // Load all credentials
  loadCredentials: async () => {
    set({ isLoading: true, error: null });
    try {
      const credentials = await getAllItemsByType('credential');
      set({ credentials, isLoading: false });
      return credentials;
    } catch (error) {
      console.error('Error loading credentials:', error);
      set({ error: error.message, isLoading: false });
      return [];
    }
  },
  
  // Add new credential
  addCredential: async (credential) => {
    set({ isLoading: true, error: null });
    try {
      // Generate unique ID
      const id = generateSecureId();
      
      // Prepare the credential with metadata
      const newCredential = {
        id,
        ...credential,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save to secure storage
      await saveToSecureStore(id, newCredential, 'credential');
      
      // Update state
      const credentials = [...get().credentials, newCredential];
      set({ credentials, isLoading: false });
      
      return newCredential;
    } catch (error) {
      console.error('Error adding credential:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Update existing credential
  updateCredential: async (id, updatedData) => {
    set({ isLoading: true, error: null });
    try {
      // Get the existing credential
      const existingCredential = await getFromSecureStore(id);
      
      if (!existingCredential) {
        throw new Error('Credential not found');
      }
      
      // Merge data and update metadata
      const updatedCredential = {
        ...existingCredential,
        ...updatedData,
        updatedAt: new Date().toISOString()
      };
      
      // Save to secure storage
      await saveToSecureStore(id, updatedCredential, 'credential');
      
      // Update state
      const credentials = get().credentials.map(cred => 
        cred.id === id ? { ...cred, ...updatedCredential } : cred
      );
      
      set({ credentials, isLoading: false });
      
      return updatedCredential;
    } catch (error) {
      console.error('Error updating credential:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Delete credential
  deleteCredential: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Delete from secure storage
      await deleteFromSecureStore(id, 'credential');
      
      // Update state
      const credentials = get().credentials.filter(cred => cred.id !== id);
      set({ credentials, isLoading: false });
      
      return true;
    } catch (error) {
      console.error('Error deleting credential:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // Get credential by ID
  getCredentialById: (id) => {
    return get().credentials.find(cred => cred.id === id);
  },
  
  // Clear credentials state (e.g., on logout)
  clearCredentials: () => {
    set({ credentials: [], error: null });
  }
}));

export default useCredentialsStore;
