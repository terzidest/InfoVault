import { useEffect } from 'react';
import useAuthStore from '../store/authStore';

// Auth state accessor + one-time init. The auto-lock lifecycle (AppState,
// idle interval, activity tracking) lives in AutoLockGate, mounted once in
// App.tsx — this hook is mounted per-screen and must not register listeners.
const useAuth = () => {
  const {
    isAuthenticated,
    isInitialized,
    logout,
    init,
    updateLastActive,
  } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) {
      init();
    }
  }, [isInitialized, init]);

  return {
    isAuthenticated,
    isInitialized,
    logout,
    updateLastActive,
  };
};

export default useAuth;
