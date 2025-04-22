import React, { useEffect } from 'react';
// import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import "./global.css";

// Navigator
import AppNavigator from './src/navigation/appNavigator';

// Stores
import useAuthStore from './src/store/authStore';

const App = () => {
  // Initialize auth store
  const { init, isInitialized } = useAuthStore();
  
  useEffect(() => {
    if (!isInitialized) {
      init();
    }
  }, [isInitialized, init]);
  
  // Show loading screen while initializing
  if (!isInitialized) {
    return (
      <View className="flex-1 items-center justify-center bg-light">
        <ActivityIndicator size="large" color="#006E90" />
        <Text className="text-lg font-medium text-primary mt-4">Loading InfoVault...</Text>
      </View>
    );
  }
  
  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
};

export default App;