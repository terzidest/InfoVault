import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/appNavigator';
import AutoLockGate from './src/components/features/AutoLockGate';
import useAuthStore from './src/store/authStore';
import { colors } from './src/theme/colors';

const App: React.FC = () => {
  // Selectors: a whole-store subscription here re-renders the entire app
  // (navigator included) on every auth set(), e.g. isLoading during unlock.
  const init = useAuthStore((s) => s.init);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    if (!isInitialized) {
      init();
    }
  }, [isInitialized, init]);

  if (!isInitialized) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#006E90" />
        <Text style={styles.loadingText}>Loading InfoVault...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <AutoLockGate>
        <AppNavigator />
      </AutoLockGate>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light,
  },
  loadingText: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500',
    color: colors.primary,
    marginTop: 16,
  },
});

export default App;
