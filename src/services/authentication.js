import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Authenticate the user using biometrics or PIN
 * @returns {Promise<boolean>} Authentication result
 */
export const authenticate = async () => {
  try {
    // Check if hardware supports biometric
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      console.warn('Biometric hardware not available');
      // Proceed to fallback
    }

    // Check if biometrics are enrolled
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled && hasHardware) {
      console.warn('No biometric credentials enrolled');
      // Proceed to fallback
    }

    // Authenticate
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

/**
 * Check available authentication types
 * @returns {Promise<Object>} Available authentication types
 */
export const checkAuthenticationTypes = async () => {
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
