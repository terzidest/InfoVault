import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import AppNavigator from './src/navigation/appNavigator';
import AutoLockGate from './src/components/features/AutoLockGate';
import useAuthStore from './src/store/authStore';
import useSettingsStore from './src/store/settingsStore';
import { ThemeProvider, fonts } from './src/theme';

// Keep the native splash up until fonts and auth init are ready, so the
// first frame is never unstyled or a loading placeholder.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Best-effort: already hidden or unsupported — nothing to recover.
});

const App: React.FC = () => {
  // Selectors: a whole-store subscription here re-renders the entire app
  // (navigator included) on every auth set(), e.g. isLoading during unlock.
  const init = useAuthStore((s) => s.init);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const initSettings = useSettingsStore((s) => s.initSettings);
  // fontError is non-null when a bundled font fails to register; we still
  // render (system font fallback) rather than block the app on typography.
  const [fontsLoaded, fontError] = useFonts(fonts);
  const fontsReady = fontsLoaded || fontError !== null;

  useEffect(() => {
    // Settings (theme) are needed before the first themed frame; screens
    // still call initSettings themselves, which is idempotent.
    initSettings();
  }, [initSettings]);

  useEffect(() => {
    if (!isInitialized) {
      init();
    }
  }, [isInitialized, init]);

  const ready = isInitialized && fontsReady;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    // The native splash is still visible; render nothing behind it.
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar barStyle="light-content" />
        <AutoLockGate>
          <AppNavigator />
        </AutoLockGate>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export default App;
