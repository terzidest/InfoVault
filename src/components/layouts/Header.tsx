import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* One height for every screen; 64px fits the logo at near-full presence. */}
      <View style={styles.bar}>
        <View style={styles.side}>
          {showBackButton && (
            <TouchableOpacity
              onPress={handleBackPress}
              style={styles.iconButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color={colors.secondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.center}>
          {showLogo ? (
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.title} numberOfLines={1}>
              {title || 'InfoVault'}
            </Text>
          )}
        </View>

        <View style={styles.side}>
          {showSettings && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              style={styles.iconButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <Ionicons name="settings-outline" size={22} color={colors.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.accent} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.primary,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 64,
  },
  side: {
    width: 40,
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 160,
    height: 56,
  },
  title: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
    color: colors.secondary,
  },
  accent: {
    height: 4,
    width: '100%',
    backgroundColor: colors.secondary,
  },
});

export default Header;
