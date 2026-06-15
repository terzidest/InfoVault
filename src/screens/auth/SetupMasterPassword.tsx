import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { scale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';

import useAuthStore from '../../store/authStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { checkPasswordStrength } from '../../utils/crypto';
import { validateFields, ValidationRules } from '../../utils/validation';
import type { ScreenProps } from '../../types/navigation';

interface FormData {
  password: string;
  confirm: string;
}

type FormErrors = Partial<Record<keyof FormData, string>>;

const SetupMasterPassword: React.FC<ScreenProps<'SetupMasterPassword'>> = ({ navigation }) => {
  const { setupMasterPassword, enableBiometricUnlock, biometricAvailable, isLoading } = useAuthStore();
  const [formData, setFormData] = useState<FormData>({ password: '', confirm: '' });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const strength = checkPasswordStrength(formData.password);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const getStrengthColor = (): string => {
    if (strength < 30) return '#F44336';
    if (strength < 60) return '#FFC107';
    return '#4CAF50';
  };

  const handleSubmit = async () => {
    const rules: ValidationRules<FormData> = {
      password: { required: true, minLength: 8 },
      confirm: {
        required: true,
        validate: (value, data) => (value !== data.password ? 'Passwords do not match' : ''),
      },
    };

    const { isValid, errors } = validateFields(formData, rules);
    if (!isValid) {
      setFormErrors(errors);
      return;
    }

    const ok = await setupMasterPassword(formData.password);
    if (!ok) {
      Alert.alert('Setup Failed', 'Could not set up your vault. Please try again.');
      return;
    }

    if (biometricAvailable) {
      Alert.alert(
        'Enable Face ID / Touch ID?',
        'You can unlock InfoVault with biometrics instead of typing your master password every time.',
        [
          { text: 'Not now', style: 'cancel', onPress: () => navigation.replace('Home') },
          {
            text: 'Enable',
            onPress: async () => {
              await enableBiometricUnlock();
              navigation.replace('Home');
            },
          },
        ]
      );
    } else {
      navigation.replace('Home');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create your master password</Text>
      <Text style={styles.subtitle}>
        This password encrypts everything in your vault. You&apos;ll enter it each time you unlock.
      </Text>

      <View style={styles.warning}>
        <Ionicons name="warning-outline" size={scale(18)} color="#B26A00" style={styles.warningIcon} />
        <Text style={styles.warningText}>
          There is no recovery. If you forget this password, your data is permanently lost.
        </Text>
      </View>

      <Input
        label="Master Password"
        value={formData.password}
        onChangeText={(value) => handleChange('password', value)}
        placeholder="At least 8 characters"
        secure
        sensitive
        error={!!formErrors.password}
        helperText={formErrors.password}
      />

      {formData.password.length > 0 && (
        <View style={styles.strengthRow}>
          <Text style={styles.strengthLabel}>Strength:</Text>
          <View style={styles.strengthBarBg}>
            <View
              style={[styles.strengthBar, { width: `${strength}%`, backgroundColor: getStrengthColor() }]}
            />
          </View>
        </View>
      )}

      <Input
        label="Confirm Master Password"
        value={formData.confirm}
        onChangeText={(value) => handleChange('confirm', value)}
        placeholder="Re-enter your password"
        secure
        sensitive
        error={!!formErrors.confirm}
        helperText={formErrors.confirm}
      />

      <Button
        onPress={handleSubmit}
        isLoading={isLoading}
        disabled={isLoading || !formData.password || !formData.confirm}
        size="large"
        style={styles.button}
      >
        Create Vault
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: scale(20),
    paddingTop: scale(48),
  },
  title: {
    fontSize: scale(22),
    fontWeight: '700',
    color: '#006E90',
    marginBottom: scale(8),
  },
  subtitle: {
    fontSize: scale(14),
    color: '#666666',
    marginBottom: scale(16),
    lineHeight: scale(20),
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF6E5',
    borderRadius: scale(8),
    padding: scale(12),
    marginBottom: scale(20),
  },
  warningIcon: {
    marginRight: scale(8),
    marginTop: scale(1),
  },
  warningText: {
    flex: 1,
    fontSize: scale(13),
    color: '#8A5A00',
    lineHeight: scale(18),
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(-8),
    marginBottom: scale(16),
    marginLeft: scale(2),
  },
  strengthLabel: {
    fontSize: scale(12),
    color: '#666666',
    marginRight: scale(8),
  },
  strengthBarBg: {
    flex: 1,
    height: scale(4),
    backgroundColor: '#EEEEEE',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  strengthBar: {
    height: '100%',
  },
  button: {
    marginTop: scale(8),
  },
});

export default SetupMasterPassword;
