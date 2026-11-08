import { Platform } from 'react-native';
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

// Apple's trademark on iOS; Android has no single brand for face unlock.
const FACE_LABEL = Platform.OS === 'ios' ? 'Face ID' : 'Face unlock';

/** Noun for each method, as shown in status copy. Empty for `none`. */
export const biometricLabel = (method: BiometricMethod): string => {
  switch (method) {
    case 'fingerprint':
      return 'Fingerprint';
    case 'face':
      return FACE_LABEL;
    case 'biometrics':
      return 'Biometrics';
    case 'none':
      return '';
  }
};

const METHOD_ICON: Record<BiometricMethod, keyof typeof Ionicons.glyphMap> = {
  fingerprint: 'finger-print-outline',
  face: 'scan-outline',
  biometrics: 'finger-print-outline',
  none: 'finger-print-outline',
};

// Pure: which biometric the unlock UI should name. Precedence is
// fingerprint > face > biometrics > none: a fingerprint is named whenever
// the phone has one (Samsung reports fingerprint AND face, and the keystore
// gate is the fingerprint), face when it is the only sensor, and the
// generic word only for sensors with no copy of their own (iris). `none`
// when nothing is enrolled or the capability is still unknown.
export const describeBiometricMethod = (auth: AuthTypes | null): BiometricMethodInfo => {
  const method: BiometricMethod =
    !auth || !auth.hasHardware || !auth.isEnrolled
      ? 'none'
      : auth.hasFingerprintId
        ? 'fingerprint'
        : auth.hasFaceId
          ? 'face'
          : 'biometrics';
  return { method, label: biometricLabel(method), icon: METHOD_ICON[method] };
};

/** "Unlock with fingerprint" etc.; empty for `none`. */
export const biometricActionLabel = (method: BiometricMethod): string => {
  switch (method) {
    case 'fingerprint':
      return 'Unlock with fingerprint';
    case 'face':
      return `Unlock with ${FACE_LABEL}`;
    case 'biometrics':
      return 'Unlock with biometrics';
    case 'none':
      return '';
  }
};

export interface UnlockStatusInput {
  isAuthenticated: boolean;
  isMigrating: boolean;
  isLoading: boolean;
  method: BiometricMethod;
  biometricEnabled: boolean;
}

// Pure: the Unlock screen's one-line status. Precedence: unlocked >
// upgrading (migration) > unlocking > which biometric is ready > password.
export const unlockStatusText = ({
  isAuthenticated,
  isMigrating,
  isLoading,
  method,
  biometricEnabled,
}: UnlockStatusInput): string => {
  if (isAuthenticated) return 'Unlocked';
  if (isMigrating) return 'Upgrading your vault…';
  if (isLoading) return 'Unlocking…';
  if (biometricEnabled && method !== 'none') return `Locked · ${biometricLabel(method)} ready`;
  return 'Locked · Password only';
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
