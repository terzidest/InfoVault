import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import LottieView from 'lottie-react-native';
import { useFocusEffect } from '@react-navigation/native';

import useAuthStore from '../../store/authStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import type { ScreenProps } from '../../types/navigation';

const Authentication: React.FC<ScreenProps<'Authentication'>> = ({ navigation }) => {
  const {
    unlockWithPassword,
    unlockWithBiometrics,
    isAuthenticated,
    isLoading,
    biometricEnabled,
  } = useAuthStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const biometricAttempted = useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      setPassword('');
      setError(null);
      // Auto-trigger biometric once per focus when enabled. Cancelling
      // leaves the screen in place with the password input as fallback.
      if (biometricEnabled && !biometricAttempted.current) {
        biometricAttempted.current = true;
        unlockWithBiometrics();
      }
      return () => {
        biometricAttempted.current = false;
      };
    }, [biometricEnabled, unlockWithBiometrics])
  );

  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('Home');
    }
  }, [isAuthenticated, navigation]);

  const handleUnlock = async () => {
    setError(null);
    const ok = await unlockWithPassword(password);
    if (!ok) {
      setError('Incorrect master password');
    }
  };

  const handleBiometric = async () => {
    setError(null);
    await unlockWithBiometrics();
  };

  return (
    <View className="flex-1 bg-light justify-between p-5 pt-0">
      <View className="flex-1" />

      <View className="items-center">
        <Text className="text-xl font-bold text-primary mb-6">Welcome to InfoVault</Text>
        <View style={{ height: 160, width: 160, marginBottom: 24, justifyContent: 'center', alignItems: 'center' }}>
          <LottieView
            source={require('../../assets/animations/lock.json')}
            autoPlay
            loop
            style={{ width: 160, height: 160 }}
          />
        </View>

        <Text className="text-base text-dark mb-6 text-center">
          {biometricEnabled
            ? 'Unlock with biometrics, or enter your master password'
            : 'Enter your master password to unlock your vault'}
        </Text>

        <View className="w-full max-w-[320px]">
          {biometricEnabled && (
            <Button
              onPress={handleBiometric}
              size="large"
              variant="outline"
              isLoading={isLoading}
              disabled={isLoading}
              className="mb-3"
            >
              Use biometrics
            </Button>
          )}
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="Master password"
            secure
            error={!!error}
            helperText={error ?? undefined}
            onSubmitEditing={handleUnlock}
          />
          <Button
            onPress={handleUnlock}
            size="large"
            isLoading={isLoading}
            disabled={isLoading || !password}
          >
            Unlock
          </Button>
        </View>
      </View>
    </View>
  );
};

export default Authentication;
