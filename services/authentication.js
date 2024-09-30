import * as LocalAuthentication from 'expo-local-authentication';

export const authenticate = async () => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      throw new Error('Biometric authentication hardware not available');
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      throw new Error('No biometric credentials enrolled');
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate',
      fallbackLabel: 'Use PIN/Password',
    });

    return result.success;
  } catch (error) {
    console.error('Authentication error:', error);
    return false;
  }
};

