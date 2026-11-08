import useAuthStore from './authStore';

// The in-memory vault key lives in authStore; read it at call-time (never at
// module load) so the authStore <-> services import cycle stays safe and a
// lock is seen immediately. logout() zeroes the key bytes in place and drops
// the reference, so callers compare by reference to detect a lock that
// happened during an await.
export const requireKey = (): Uint8Array => {
  const key = useAuthStore.getState().encryptionKey;
  if (!key) throw new Error('Vault is locked');
  return key;
};
