import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { scale } from 'react-native-size-matters';
import { useFocusEffect } from '@react-navigation/native';

import useSettingsStore from '../../store/settingsStore';
import useAuthStore from '../../store/authStore';
import useAuth from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import type { ScreenProps } from '../../types/navigation';
import type { Settings as SettingsType } from '../../types/models';

type ToggleableSettingKey = {
  [K in keyof SettingsType]: SettingsType[K] extends boolean ? K : never;
}[keyof SettingsType];

const Settings: React.FC<ScreenProps<'Settings'>> = ({ navigation }) => {
  const { settings, initSettings, updateSettings, resetSettings } = useSettingsStore();
  const { isAuthenticated, updateLastActive, logout } = useAuth();
  const biometricAvailable = useAuthStore((s) => s.biometricAvailable);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const enableBiometricUnlock = useAuthStore((s) => s.enableBiometricUnlock);
  const disableBiometricUnlock = useAuthStore((s) => s.disableBiometricUnlock);

  const timeoutOptions = [
    { label: '1 minute', value: 60000 },
    { label: '5 minutes', value: 300000 },
    { label: '15 minutes', value: 900000 },
    { label: '30 minutes', value: 1800000 },
    { label: '1 hour', value: 3600000 },
  ];

  useEffect(() => {
    if (isAuthenticated) {
      initSettings();
    }
  }, [isAuthenticated, initSettings]);

  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        updateLastActive();
      }
    }, [isAuthenticated, updateLastActive])
  );

  const handleToggleSetting = (key: ToggleableSettingKey) => {
    updateLastActive();
    updateSettings({ [key]: !settings[key] });
  };

  const handleTimeoutChange = (value: number) => {
    updateLastActive();
    updateSettings({ autoLockTimeout: value });
  };

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
          },
        },
      ]
    );
  };

  const handleLock = () => {
    Alert.alert(
      'Lock vault',
      'Lock InfoVault now? You will need to unlock again to access your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock',
          style: 'destructive',
          onPress: () => {
            // Navigation to the lock screen happens centrally (AutoLockGate
            // resets the stack on logout) — never navigate here too, or the
            // stack accumulates a route per lock cycle.
            logout();
          },
        },
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
            <Text style={styles.settingTitle}>Use biometric unlock</Text>
            <Text style={styles.settingDescription}>
              {biometricAvailable
                ? 'Unlock with Face ID or Touch ID instead of typing your master password'
                : 'No biometric enrolled on this device'}
            </Text>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={async (next) => {
              updateLastActive();
              if (next) {
                await enableBiometricUnlock();
              } else {
                await disableBiometricUnlock();
              }
            }}
            disabled={!biometricAvailable}
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
          <View style={styles.pickerSpacing}>
            <Select
              value={settings.autoLockTimeout}
              onValueChange={handleTimeoutChange}
              options={timeoutOptions}
            />
          </View>
        </View>
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
        <Button variant="outline" style={styles.actionButton} onPress={handleResetSettings}>
          Reset Settings
        </Button>

        <Button style={styles.actionButton} onPress={handleLock}>
          Lock
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
  pickerSpacing: {
    marginTop: scale(8),
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
