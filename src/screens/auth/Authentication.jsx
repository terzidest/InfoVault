import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';
import Button from '../../components/ui/Button';

/**
 * Authentication screen for biometric/PIN login
 */
const Authentication = ({ navigation }) => {
  const { login, isAuthenticated } = useAuth();
  const { authTypes } = useAuthStore();
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [error, setError] = useState(null);
  
  // Reset error when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      setError(null);
      setLoginAttempted(false);
    }, [])
  );
  
  // Navigate to Home when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('Home');
    }
  }, [isAuthenticated, navigation]);
  
  // Handle authentication
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
  
  // Get appropriate auth type text and icon
  const getAuthDetails = () => {
    if (!authTypes) {
      return {
        text: 'Authenticate',
        icon: 'lock-closed-outline'
      };
    }
    
    if (authTypes.hasFaceId) {
      return {
        text: 'Face ID',
        icon: 'scan-outline'
      };
    }
    
    if (authTypes.hasFingerprintId) {
      return {
        text: 'Fingerprint',
        icon: 'finger-print-outline'
      };
    }
    
    return {
      text: 'Authenticate',
      icon: 'lock-closed-outline'
    };
  };
  
  const { text, icon } = getAuthDetails();
  
  return (
    <View className="flex-1 bg-light justify-between p-5">
      <View className="items-center mt-10">
        <Image
          source={require('../../assets/images/logo.png')}
          className="w-20 h-20 mb-4"
          resizeMode="contain"
        />
        <Text className="text-3xl font-bold text-primary mb-2">InfoVault</Text>
        <Text className="text-sm text-gray-600 text-center max-w-[80%]">
          Your secure personal information manager
        </Text>
      </View>
      
      <View className="items-center mb-10">
        <View className="h-30 w-30 mb-6 justify-center items-center">
          {!loginAttempted ? (
            <LottieView
              source={require('../../assets/animations/lock.json')}
              autoPlay
              loop
              className="w-30 h-30"
            />
          ) : (
            <View className="w-20 h-20 rounded-full bg-gray-100 justify-center items-center border-2 border-secondary">
              <Ionicons name={icon} size={48} color="#006E90" />
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
        
        <Button
          onPress={handleAuthenticate}
          size="large"
          className="w-full max-w-[280px]"
        >
          {text}
        </Button>
      </View>
    </View>
  );
};

export default Authentication;
