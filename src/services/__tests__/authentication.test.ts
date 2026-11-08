import { biometricActionLabel, describeBiometricMethod } from '../authentication';
import type { AuthTypes } from '../../types/models';

const device = (over: Partial<AuthTypes>): AuthTypes => ({
  hasHardware: true,
  isEnrolled: true,
  supportedTypes: [],
  hasFaceId: false,
  hasFingerprintId: false,
  hasIris: false,
  ...over,
});

describe('describeBiometricMethod', () => {
  it('is none while the capability is unknown', () => {
    expect(describeBiometricMethod(null).method).toBe('none');
  });

  it('is none without hardware or without enrolment, whatever the sensors', () => {
    expect(describeBiometricMethod(device({ hasHardware: false, hasFingerprintId: true })).method).toBe('none');
    expect(describeBiometricMethod(device({ isEnrolled: false, hasFaceId: true })).method).toBe('none');
  });

  it('names fingerprint when it is the only sensor', () => {
    expect(describeBiometricMethod(device({ hasFingerprintId: true }))).toEqual({
      method: 'fingerprint',
      label: 'Fingerprint',
      icon: 'finger-print-outline',
    });
  });

  it('names face only when it is the sole sensor', () => {
    expect(describeBiometricMethod(device({ hasFaceId: true }))).toEqual({
      method: 'face',
      label: 'Face ID',
      icon: 'scan-outline',
    });
  });

  it('says biometrics when both sensors exist, or when only iris does', () => {
    expect(describeBiometricMethod(device({ hasFaceId: true, hasFingerprintId: true })).method).toBe('biometrics');
    expect(describeBiometricMethod(device({ hasIris: true })).method).toBe('biometrics');
  });
});

describe('biometricActionLabel', () => {
  it('phrases the unlock button per method and is empty for none', () => {
    expect(biometricActionLabel('fingerprint')).toBe('Unlock with fingerprint');
    expect(biometricActionLabel('face')).toBe('Unlock with Face ID');
    expect(biometricActionLabel('biometrics')).toBe('Unlock with biometrics');
    expect(biometricActionLabel('none')).toBe('');
  });
});
