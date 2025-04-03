import { create } from 'zustand';
import { authenticate, checkAuthenticationTypes } from '../services/authentication';
import * as SecureStore from 'expo-secure-store';

/**
 * Authentication state management using Zustand
 */
const useAuthStore = create((set, get) => ({
  // State
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,
  authError: null,
  lastActive: new Date(),
  authTypes: null,
  
  // Initialize authentication state
  init: async () => {
    set({ isLoading: true });
    try {
      // Check if app has been set up
      const setupComplete = await SecureStore.getItemAsync('setupComplete');
      
      // If setup is not complete, we don't need to authenticate yet
      if (setupComplete !== 'true') {
        set({ 
          isAuthenticated: false, 
          isInitialized: true,
          isLoading: false
        });
        return false;
      }
      
      // Check available authentication types
      const authTypes = await checkAuthenticationTypes();
      
      set({ 
        isInitialized: true,
        isLoading: false,
        authTypes
      });
      
      return true;
    } catch (error) {
      console.error('Error initializing auth store:', error);
      set({ 
        isInitialized: true,
        isLoading: false,
        authError: error.message
      });
      return false;
    }
  },
  
  // Complete setup
  completeSetup: async () => {
    try {
      await SecureStore.setItemAsync('setupComplete', 'true');
      return true;
    } catch (error) {
      console.error('Error completing setup:', error);
      return false;
    }
  },
  
  // Login with biometrics/PIN
  login: async () => {
    set({ isLoading: true, authError: null });
    try {
      const success = await authenticate();
      set({ 
        isAuthenticated: success, 
        isLoading: false,
        lastActive: new Date()
      });
      return success;
    } catch (error) {
      set({ 
        authError: error.message, 
        isLoading: false 
      });
      return false;
    }
  },
  
  // Logout
  logout: () => {
    set({ isAuthenticated: false });
  },
  
  // Update last active timestamp
  updateLastActive: () => {
    set({ lastActive: new Date() });
  },
  
  // Check for timeout
  checkTimeout: (timeoutDuration = 300000) => { // 5 minutes by default
    const { lastActive, isAuthenticated, logout } = get();
    
    if (!isAuthenticated) return;
    
    const now = new Date();
    const timeDiff = now - lastActive;
    
    if (timeDiff > timeoutDuration) {
      logout();
      return true;
    }
    
    return false;
  }
}));

export default useAuthStore;
