import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';
import Button from '../../components/ui/Button';
import type { ScreenProps } from '../../types/navigation';

interface AuthDetails {
  text: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

const Authentication: React.FC<ScreenProps<'Authentication'>> = ({ navigation }) => {
  const { login, isAuthenticated } = useAuth();
  const { authTypes } = useAuthStore();
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      setError(null);
      setLoginAttempted(false);
    }, [])
  );

  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('Home');
    }
  }, [isAuthenticated, navigation]);

  const handleAuthenticate = async () => {
    setLoginAttempted(true);
    setError(null);

    try {
      const success = await login();

      if (!success) {
        setError('Authentication failed. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Authentication error:', err);
    }
  };

  const getAuthDetails = (): AuthDetails => {
    if (!authTypes) {
      return {
        text: 'Authenticate',
        icon: 'lock-closed-outline',
      };
    }

    if (authTypes.hasFaceId) {
      return {
        text: 'Face ID',
        icon: 'scan-outline',
      };
    }

    if (authTypes.hasFingerprintId) {
      return {
        text: 'Fingerprint',
        icon: 'finger-print-outline',
      };
    }

    return {
      text: 'Authenticate',
      icon: 'lock-closed-outline',
    };
  };

  const { text, icon } = getAuthDetails();

  return (
    <View className="flex-1 bg-light justify-between p-5 pt-0">
      <View className="flex-1" />

      <View className="items-center">
        <Text className="text-xl font-bold text-primary mb-6">Welcome to InfoVault</Text>
        <View style={{ height: 160, width: 160, marginBottom: 24, justifyContent: 'center', alignItems: 'center' }}>
          {!loginAttempted ? (
            <LottieView
              source={require('../../assets/animations/lock.json')}
              autoPlay
              loop
              style={{ width: 160, height: 160 }}
            />
          ) : (
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: '#f8f9fa',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 2,
                borderColor: '#FFC107',
              }}
            >
              <Ionicons name={icon} size={60} color="#006E90" />
            </View>
          )}
        </View>

        <Text className="text-base text-dark mb-6 text-center">
          Please authenticate to access your vault
        </Text>

        {error && (
          <Text className="text-danger text-sm mb-4 text-center">
            {error}
          </Text>
        )}

        <Button onPress={handleAuthenticate} size="large" className="w-full max-w-[280px]">
          {text}
        </Button>
      </View>
    </View>
  );
};

export default Authentication;
