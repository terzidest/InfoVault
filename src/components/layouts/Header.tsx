import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../../types/navigation';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  showSettings?: boolean;
  showLogo?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  title,
  showBackButton = false,
  onBackPress,
  showSettings = false,
  showLogo = false,
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
      <View className="flex-row items-center justify-between px-4 h-14">
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
            <Image
              source={require('../../assets/images/logo.png')}
              className="w-24 h-12"
              resizeMode="contain"
            />
          ) : (
            <Text className="text-lg font-semibold text-secondary" numberOfLines={1}>
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
