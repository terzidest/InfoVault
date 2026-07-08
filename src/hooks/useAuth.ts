import { useEffect } from 'react';
import useAuthStore from '../store/authStore';

// Auth state accessor + one-time init. The auto-lock lifecycle (AppState,
// idle interval, activity tracking) lives in AutoLockGate, mounted once in
// App.tsx — this hook is mounted per-screen and must not register listeners.
const useAuth = () => {
  // Field-level selectors: this hook is mounted by nearly every screen, and a
  // whole-store subscription would re-render all of them on any auth set()
  // (isLoading flips during unlock, biometric toggles, ...).
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const logout = useAuthStore((s) => s.logout);
  const init = useAuthStore((s) => s.init);
  const updateLastActive = useAuthStore((s) => s.updateLastActive);

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
