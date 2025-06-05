import React from 'react';
import { View, Text, TouchableOpacity, Image} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Header component for screen navigation
 * 
 * @param {string} title - Screen title
 * @param {boolean} showBackButton - Show back button
 * @param {function} onBackPress - Custom back button handler
 * @param {boolean} showSettings - Show settings button
 * @param {boolean} showLogo - Show logo instead of title
 */
const Header = ({ 
  title, 
  showBackButton = false, 
  onBackPress, 
  showSettings = false,
  showLogo = false,
  ...props 
}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };
  
  return (
    <View className="w-full bg-primary" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 py-2 h-20">
        <View className="w-10 items-center">
          {showBackButton && (
            <TouchableOpacity 
              onPress={handleBackPress} 
              className="w-10 h-10 rounded-full items-center justify-center"
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color="#FFC107" />
            </TouchableOpacity>
          )}
        </View>
        
        <View className="flex-1 items-center justify-center">
          {showLogo ? (
            <View className="mt-0">
              <Image
                source={require('../../assets/images/logo.png')}
                className="w-25 h-20"
                resizeMode="contain"
              />
            </View>
          ) : (
            <Text className="text-2xl font-semibold text-secondary" numberOfLines={1}>
              {title || 'InfoVault'}
            </Text>
          )}
        </View>
        
        <View className="w-10 items-center">
          {showSettings && (
            <TouchableOpacity 
              onPress={() => navigation.navigate('Settings')} 
              className="w-10 h-10 rounded-full items-center justify-center"
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={22} color="#FFC107" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View className="h-1 w-full bg-secondary" />
    </View>
  );
};

export default Header;