import { useEffect } from 'react';
import { AppState } from 'react-native';
import useAuthStore from '../store/authStore';
import useSettingsStore from '../store/settingsStore';

/**
 * Custom hook for authentication management
 */
const useAuth = () => {
  const { 
    isAuthenticated, 
    isInitialized,
    login, 
    logout, 
    init,
    updateLastActive,
    checkTimeout
  } = useAuthStore();
  
  const { settings } = useSettingsStore();
  
  // Initialize authentication
  useEffect(() => {
    if (!isInitialized) {
      init();
    }
  }, [isInitialized, init]);
  
  // Set up AppState listener for timeout
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        // App came back to foreground - check for timeout
        const hasTimedOut = checkTimeout(settings.autoLockTimeout);
        
        if (!hasTimedOut && isAuthenticated) {
          // Update the last active timestamp
          updateLastActive();
        }
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, settings.autoLockTimeout, checkTimeout, updateLastActive]);
  
  return {
    isAuthenticated,
    isInitialized,
    login,
    logout,
    updateLastActive
  };
};

export default useAuth;
