// Reports device capability only; unlock itself never goes through this
// module (authStore gates the key behind SecureStore's requireAuthentication).
const AuthenticationType = { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 };

let device = { hasHardware: true, isEnrolled: true, types: [AuthenticationType.FINGERPRINT] };

module.exports = {
  // Lets `import * as X` hand every importer this same object (no interop copy),
  // so spies set in a test reach the code under test.
  __esModule: true,
  AuthenticationType,
  hasHardwareAsync: async () => device.hasHardware,
  isEnrolledAsync: async () => device.isEnrolled,
  supportedAuthenticationTypesAsync: async () => device.types,

  __setDevice(next) {
    device = { ...device, ...next };
  },
  __reset() {
    device = { hasHardware: true, isEnrolled: true, types: [AuthenticationType.FINGERPRINT] };
  },
};
