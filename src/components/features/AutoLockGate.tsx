import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../../store/authStore';
import useSettingsStore from '../../store/settingsStore';

// Refresh lastActive at most this often while the user is touching the app.
const TOUCH_THROTTLE_MS = 10_000;
// How often the idle timeout is evaluated while the app is foregrounded.
const CHECK_INTERVAL_MS = 5_000;

interface Props {
  children: React.ReactNode;
}

// Single app-wide owner of the auto-lock lifecycle: tracks user activity via
// a capture-phase responder (without ever claiming the touch), periodically
// evaluates the idle timeout while foregrounded, and stamps/checks activity
// across background transitions. Mounted exactly once, above the navigator.
const AutoLockGate: React.FC<Props> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const lastTouchRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  // Obscures the UI in the OS app switcher so snapshots never show vault
  // content. Starts obscured if mounted while not active (cold-start edge).
  const [isObscured, setIsObscured] = useState(AppState.currentState !== 'active');

  // Block screenshots and screen recording while the vault is unlocked
  // (FLAG_SECURE on Android; recording/mirroring protection on iOS).
  useEffect(() => {
    if (!isAuthenticated) return;
    ScreenCapture.preventScreenCaptureAsync().catch(() => {
      // Best-effort: never break the app over capture protection.
    });
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, [isAuthenticated]);

  const handleTouchCapture = useCallback((): boolean => {
    const now = Date.now();
    if (now - lastTouchRef.current >= TOUCH_THROTTLE_MS) {
      lastTouchRef.current = now;
      const auth = useAuthStore.getState();
      if (auth.isAuthenticated) auth.updateLastActive();
    }
    return false; // never become the responder; touches pass through untouched
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(() => {
      // Background timers are unreliable and the AppState handler covers the
      // return-to-foreground check; only tick while actually active.
      if (appStateRef.current !== 'active') return;
      const timeout = useSettingsStore.getState().settings.autoLockTimeout;
      useAuthStore.getState().checkTimeout(timeout);
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const prevAppState = appStateRef.current;
      appStateRef.current = nextAppState;
      setIsObscured(nextAppState !== 'active');

      const auth = useAuthStore.getState();
      if (!auth.isAuthenticated) return;

      if (prevAppState === 'active' && nextAppState !== 'active') {
        // Freeze the clock at the moment of leaving the foreground so a brief
        // background trip doesn't count the whole prior session as idle.
        // Never lock on 'inactive' itself — iOS fires it for the app switcher,
        // notification shade, and system sheets.
        auth.updateLastActive();
      } else if (nextAppState === 'active') {
        const timeout = useSettingsStore.getState().settings.autoLockTimeout;
        const timedOut = auth.checkTimeout(timeout);
        if (timedOut === false) auth.updateLastActive();
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <View className="flex-1" onStartShouldSetResponderCapture={handleTouchCapture}>
      {children}
      {isObscured && (
        <View className="absolute inset-0 items-center justify-center bg-primary">
          <Ionicons name="lock-closed" size={48} color="#FFFFFF" />
          <Text className="text-lg font-semibold text-white mt-4">InfoVault</Text>
        </View>
      )}
    </View>
  );
};

export default AutoLockGate;
