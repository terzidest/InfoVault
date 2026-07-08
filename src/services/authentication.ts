import * as LocalAuthentication from 'expo-local-authentication';
import type { AuthTypes } from '../types/models';

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
