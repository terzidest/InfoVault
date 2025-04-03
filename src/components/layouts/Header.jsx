import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Header component for screen navigation
 * 
 * @param {string} title - Screen title
 * @param {boolean} showBackButton - Show back button
 * @param {function} onBackPress - Custom back button handler
 * @param {node} rightContent - Custom right content
 */
const Header = ({ 
  title, 
  showBackButton = true, 
  onBackPress, 
  rightContent,
  ...props 
}) => {
  const navigation = useNavigation();
  
  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };
  
  return (
    <SafeAreaView className="bg-light">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View 
        className="h-16 flex-row items-center justify-between bg-light px-4 border-b border-gray-100 shadow-sm" 
        {...props}
      >
        <View className="w-10 items-start">
          {showBackButton && (
            <TouchableOpacity 
              onPress={handleBackPress} 
              className="w-10 h-10 rounded-full items-center justify-center active:bg-gray-100"
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color="#006E90" />
            </TouchableOpacity>
          )}
        </View>
        
        <View className="flex-1 items-center">
          <Text className="text-lg font-semibold text-dark" numberOfLines={1}>
            {title || 'InfoVault'}
          </Text>
          <View className="h-1 w-10 bg-secondary rounded-full mt-1 opacity-80" />
        </View>
        
        <View className="w-10 items-end">
          {rightContent}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default Header;
