import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './global.css';

import AppNavigator from './src/navigation/appNavigator';
import AutoLockGate from './src/components/features/AutoLockGate';
import useAuthStore from './src/store/authStore';

const App: React.FC = () => {
  const { init, isInitialized } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) {
      init();
    }
  }, [isInitialized, init]);

  if (!isInitialized) {
    return (
      <View className="flex-1 items-center justify-center bg-light">
        <StatusBar
          backgroundColor="#006E90"
          barStyle="light-content"
          translucent={true}
        />
        <ActivityIndicator size="large" color="#006E90" />
        <Text className="text-lg font-medium text-primary mt-4">Loading InfoVault...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar
        backgroundColor="#006E90"
        barStyle="light-content"
        translucent={true}
      />
      <AutoLockGate>
        <AppNavigator />
      </AutoLockGate>
    </SafeAreaProvider>
  );
};

export default App;
