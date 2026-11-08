import { biometricActionLabel, biometricLabel, describeBiometricMethod, unlockStatusText } from '../authentication';
import type { AuthTypes } from '../../types/models';

// jest-expo/android preset: Platform.OS is 'android', so face copy is
// "Face unlock" here ("Face ID" on iOS).

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
    expect(describeBiometricMethod(null)).toEqual({ method: 'none', label: '', icon: 'finger-print-outline' });
  });

  it('is none without hardware or without enrolment, whatever the sensors', () => {
    expect(describeBiometricMethod(device({ hasHardware: false, hasFingerprintId: true })).method).toBe('none');
    expect(describeBiometricMethod(device({ isEnrolled: false, hasFaceId: true })).method).toBe('none');
  });

  it('names fingerprint whenever the phone has one, even alongside face', () => {
    expect(describeBiometricMethod(device({ hasFingerprintId: true }))).toEqual({
      method: 'fingerprint',
      label: 'Fingerprint',
      icon: 'finger-print-outline',
    });
    expect(describeBiometricMethod(device({ hasFingerprintId: true, hasFaceId: true })).method).toBe('fingerprint');
    expect(describeBiometricMethod(device({ hasFingerprintId: true, hasIris: true })).method).toBe('fingerprint');
  });

  it('names face when there is no fingerprint sensor', () => {
    expect(describeBiometricMethod(device({ hasFaceId: true }))).toEqual({
      method: 'face',
      label: 'Face unlock',
      icon: 'scan-outline',
    });
    expect(describeBiometricMethod(device({ hasFaceId: true, hasIris: true })).method).toBe('face');
  });

  it('falls back to the generic word for sensors with no copy of their own (iris)', () => {
    expect(describeBiometricMethod(device({ hasIris: true }))).toEqual({
      method: 'biometrics',
      label: 'Biometrics',
      icon: 'finger-print-outline',
    });
    // Enrolled, hardware present, but the type list is empty: still generic.
    expect(describeBiometricMethod(device({})).method).toBe('biometrics');
  });
});

describe('labels', () => {
  it('phrases the unlock button per method and is empty for none', () => {
    expect(biometricActionLabel('fingerprint')).toBe('Unlock with fingerprint');
    expect(biometricActionLabel('face')).toBe('Unlock with Face unlock');
    expect(biometricActionLabel('biometrics')).toBe('Unlock with biometrics');
    expect(biometricActionLabel('none')).toBe('');
  });

  it('nouns match the method', () => {
    expect(biometricLabel('fingerprint')).toBe('Fingerprint');
    expect(biometricLabel('face')).toBe('Face unlock');
    expect(biometricLabel('biometrics')).toBe('Biometrics');
    expect(biometricLabel('none')).toBe('');
  });
});

describe('unlockStatusText', () => {
  const base = { isAuthenticated: false, isMigrating: false, isLoading: false, method: 'none', biometricEnabled: false } as const;

  it('names the enabled biometric, or password only', () => {
    expect(unlockStatusText({ ...base, method: 'fingerprint', biometricEnabled: true })).toBe('Locked · Fingerprint ready');
    expect(unlockStatusText({ ...base, method: 'face', biometricEnabled: true })).toBe('Locked · Face unlock ready');
    expect(unlockStatusText({ ...base, method: 'biometrics', biometricEnabled: true })).toBe('Locked · Biometrics ready');
    expect(unlockStatusText({ ...base, method: 'none', biometricEnabled: true })).toBe('Locked · Password only');
    expect(unlockStatusText({ ...base, method: 'fingerprint', biometricEnabled: false })).toBe('Locked · Password only');
  });

  it('precedence: unlocked > upgrading > unlocking > biometric', () => {
    const all = { ...base, method: 'fingerprint', biometricEnabled: true, isLoading: true, isMigrating: true } as const;
    expect(unlockStatusText({ ...all, isAuthenticated: true })).toBe('Unlocked');
    expect(unlockStatusText(all)).toBe('Upgrading your vault…');
    expect(unlockStatusText({ ...all, isMigrating: false })).toBe('Unlocking…');
    expect(unlockStatusText({ ...all, isMigrating: false, isLoading: false })).toBe('Locked · Fingerprint ready');
  });
});
