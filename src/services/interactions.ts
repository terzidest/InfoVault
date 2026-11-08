// `InteractionManager` was removed from react-native core in 0.88. Screens
// use this to defer store reloads (SecureStore reads + decryption) until the
// JS thread is idle, so the navigation transition stays smooth. Matches the
// `{ cancel }` handle shape the old API returned.

export interface DeferredTask {
  cancel: () => void;
}

export const runAfterInteractions = (task: () => void): DeferredTask => {
  const handle = requestIdleCallback(() => task());
  return { cancel: () => cancelIdleCallback(handle) };
};
