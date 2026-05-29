import { useEffect } from 'react';
import { AppState } from 'react-native';
import useAuthStore from '../store/authStore';
import useSettingsStore from '../store/settingsStore';

const useAuth = () => {
  const {
    isAuthenticated,
    isInitialized,
    logout,
    init,
    updateLastActive,
    checkTimeout,
  } = useAuthStore();

  const { settings } = useSettingsStore();

  useEffect(() => {
    if (!isInitialized) {
      init();
    }
  }, [isInitialized, init]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        const hasTimedOut = checkTimeout(settings.autoLockTimeout);

        if (!hasTimedOut && isAuthenticated) {
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
    logout,
    updateLastActive,
  };
};

export default useAuth;
