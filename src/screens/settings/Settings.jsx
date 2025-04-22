import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, TouchableOpacity } from 'react-native';
import { scale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

import useSettingsStore from '../../store/settingsStore';
import useAuth from '../../hooks/useAuth';
import Button from '../../components/ui/Button';

/**
 * Settings screen
 */
const Settings = ({ navigation }) => {
  const { settings, isPremium, initSettings, updateSettings, resetSettings, updatePremiumStatus } = useSettingsStore();
  const { isAuthenticated, updateLastActive, logout } = useAuth();
  
  // Timeout options (in milliseconds)
  const timeoutOptions = [
    { label: '1 minute', value: 60000 },
    { label: '5 minutes', value: 300000 },
    { label: '15 minutes', value: 900000 },
    { label: '30 minutes', value: 1800000 },
    { label: '1 hour', value: 3600000 },
  ];
  
  // Check authentication and load settings
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.replace('Authentication');
      return;
    }
    
    initSettings();
    updatePremiumStatus();
  }, [isAuthenticated, navigation]);
  
  // Update last active timestamp when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        updateLastActive();
      }
    }, [isAuthenticated])
  );
  
  // Handle setting changes
  const handleToggleSetting = (key) => {
    updateLastActive();
    updateSettings({ [key]: !settings[key] });
  };
  
  // Handle timeout change
  const handleTimeoutChange = (value) => {
    updateLastActive();
    updateSettings({ autoLockTimeout: value });
  };
  
  // Handle reset settings
  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to their default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            await resetSettings();
            Alert.alert('Settings Reset', 'All settings have been reset to their default values.');
          }
        }
      ]
    );
  };
  
  // Handle logout
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout? You will need to authenticate again to access your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => {
            logout();
            navigation.replace('Authentication');
          }
        }
      ]
    );
  };
  
  // Handle premium information
  const handlePremiumInfo = () => {
    Alert.alert(
      'Premium Features',
      'Upgrade to InfoVault Premium to access cloud backup, multi-device sync, custom categories, and more!',
      [
        { text: 'Maybe Later', style: 'cancel' },
        { 
          text: 'Learn More',
          onPress: () => {
            // This would typically open a premium screen or website
            Alert.alert('Coming Soon', 'Premium features will be available in a future update.');
          }
        }
      ]
    );
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Mask Sensitive Data</Text>
            <Text style={styles.settingDescription}>
              Hide sensitive information until explicitly revealed
            </Text>
          </View>
          <Switch
            value={settings.maskSensitiveData}
            onValueChange={() => handleToggleSetting('maskSensitiveData')}
            trackColor={{ false: '#CCCCCC', true: '#4CAF50' }}
            thumbColor="#FFFFFF"
          />
        </View>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Show Biometric Prompt</Text>
            <Text style={styles.settingDescription}>
              Automatically prompt for biometric authentication on launch
            </Text>
          </View>
          <Switch
            value={settings.showBiometricPrompt}
            onValueChange={() => handleToggleSetting('showBiometricPrompt')}
            trackColor={{ false: '#CCCCCC', true: '#4CAF50' }}
            thumbColor="#FFFFFF"
          />
        </View>
        
        <View style={styles.pickerSettingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Auto-Lock Timeout</Text>
            <Text style={styles.settingDescription}>
              Automatically lock after a period of inactivity
            </Text>
          </View>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={settings.autoLockTimeout}
              onValueChange={handleTimeoutChange}
              style={styles.picker}
              mode="dropdown"
            >
              {timeoutOptions.map((option, index) => (
                <Picker.Item key={index} label={option.label} value={option.value} />
              ))}
            </Picker>
          </View>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Dark Theme</Text>
            <Text style={styles.settingDescription}>
              Use dark colors throughout the app (Coming Soon)
            </Text>
          </View>
          <Switch
            value={settings.theme === 'dark'}
            onValueChange={() => {
              Alert.alert('Coming Soon', 'Dark theme will be available in a future update.');
            }}
            trackColor={{ false: '#CCCCCC', true: '#4CAF50' }}
            thumbColor="#FFFFFF"
            disabled={true}
          />
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Premium</Text>
        
        <TouchableOpacity style={styles.premiumBanner} onPress={handlePremiumInfo}>
          <View style={styles.premiumInfo}>
            <Text style={styles.premiumTitle}>
              {isPremium ? 'InfoVault Premium' : 'Upgrade to Premium'}
            </Text>
            <Text style={styles.premiumDescription}>
              {isPremium 
                ? 'You have access to all premium features'
                : 'Get cloud backup, sync, and more premium features'}
            </Text>
          </View>
          <Ionicons 
            name={isPremium ? 'checkmark-circle' : 'arrow-forward-circle'} 
            size={scale(24)} 
            color={isPremium ? '#4CAF50' : '#006E90'} 
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        
        <View style={styles.aboutItem}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>1.0.0 (MVP)</Text>
        </View>
        
        <View style={styles.aboutItem}>
          <Text style={styles.aboutLabel}>Developer</Text>
          <Text style={styles.aboutValue}>InfoVault Team</Text>
        </View>
      </View>
      
      <View style={styles.actionButtonsContainer}>
        <Button
          variant="outline"
          style={styles.actionButton}
          onPress={handleResetSettings}
        >
          Reset Settings
        </Button>
        
        <Button
          variant="danger"
          style={styles.actionButton}
          onPress={handleLogout}
        >
          Logout
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  section: {
    padding: scale(16),
    paddingBottom: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  sectionTitle: {
    fontSize: scale(16),
    fontWeight: '600',
    color: '#006E90',
    marginBottom: scale(12),
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(10),
  },
  pickerSettingItem: {
    paddingVertical: scale(10),
  },
  settingInfo: {
    flex: 1,
    paddingRight: scale(12),
  },
  settingTitle: {
    fontSize: scale(15),
    fontWeight: '500',
    color: '#333333',
    marginBottom: scale(2),
  },
  settingDescription: {
    fontSize: scale(12),
    color: '#666666',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: scale(8),
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
    marginTop: scale(8),
  },
  picker: {
    height: scale(44),
    width: '100%',
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: scale(8),
    padding: scale(16),
    marginVertical: scale(8),
  },
  premiumInfo: {
    flex: 1,
    paddingRight: scale(12),
  },
  premiumTitle: {
    fontSize: scale(16),
    fontWeight: '600',
    color: '#006E90',
    marginBottom: scale(4),
  },
  premiumDescription: {
    fontSize: scale(13),
    color: '#666666',
  },
  aboutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(10),
  },
  aboutLabel: {
    fontSize: scale(14),
    color: '#666666',
  },
  aboutValue: {
    fontSize: scale(14),
    color: '#333333',
    fontWeight: '500',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: scale(16),
  },
  actionButton: {
    flex: 1,
    marginHorizontal: scale(4),
  },
});

export default Settings;