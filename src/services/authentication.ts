import * as LocalAuthentication from 'expo-local-authentication';
import type { Ionicons } from '@expo/vector-icons';
import type { AuthTypes } from '../types/models';

export type BiometricMethod = 'fingerprint' | 'face' | 'biometrics' | 'none';

export interface BiometricMethodInfo {
  method: BiometricMethod;
  /** Short noun for status copy ("Fingerprint ready"), empty for `none`. */
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// Pure: which biometric the unlock UI should name. Fingerprint wins whenever
// it is present; face only when it is the sole sensor; `none` when the phone
// has no enrolled biometrics (or the capability is still unknown).
export const describeBiometricMethod = (auth: AuthTypes | null): BiometricMethodInfo => {
  if (!auth || !auth.hasHardware || !auth.isEnrolled) {
    return { method: 'none', label: '', icon: 'finger-print-outline' };
  }
  if (auth.hasFingerprintId && auth.hasFaceId) {
    return { method: 'biometrics', label: 'Biometrics', icon: 'finger-print-outline' };
  }
  if (auth.hasFaceId) return { method: 'face', label: 'Face ID', icon: 'scan-outline' };
  if (auth.hasFingerprintId) return { method: 'fingerprint', label: 'Fingerprint', icon: 'finger-print-outline' };
  return { method: 'biometrics', label: 'Biometrics', icon: 'finger-print-outline' };
};

/** "Unlock with fingerprint" etc.; empty for `none`. */
export const biometricActionLabel = (method: BiometricMethod): string => {
  switch (method) {
    case 'fingerprint':
      return 'Unlock with fingerprint';
    case 'face':
      return 'Unlock with Face ID';
    case 'biometrics':
      return 'Unlock with biometrics';
    case 'none':
      return '';
  }
};

// Biometric *unlock* does not go through this module — authStore gates the
// key behind SecureStore's requireAuthentication instead. This service only
// reports device capability for the settings/unlock UI.
export const checkAuthenticationTypes = async (): Promise<AuthTypes> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

    return {
      hasHardware,
      isEnrolled,
      supportedTypes,
      hasFaceId: supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
      hasFingerprintId: supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT),
      hasIris: supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS),
    };
  } catch (error) {
    console.error('Error checking authentication types:', error);
    return {
      hasHardware: false,
      isEnrolled: false,
      supportedTypes: [],
      hasFaceId: false,
      hasFingerprintId: false,
      hasIris: false,
    };
  }
};
