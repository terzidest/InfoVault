import * as LocalAuthentication from 'expo-local-authentication';
import type { AuthTypes } from '../types/models';

export const authenticate = async (): Promise<boolean> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      console.warn('Biometric hardware not available');
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled && hasHardware) {
      console.warn('No biometric credentials enrolled');
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access your vault',
      fallbackLabel: 'Use PIN/Password',
      disableDeviceFallback: false,
    });

    return result.success;
  } catch (error) {
    console.error('Authentication error:', error);
    return false;
  }
};

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
