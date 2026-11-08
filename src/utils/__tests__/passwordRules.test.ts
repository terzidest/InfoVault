import { checkPasswordStrength } from '../crypto';
import { canCreateVault, passwordChecks, strengthLevel } from '../passwordRules';

describe('strengthLevel', () => {
  it('lights segments at 25 / 50 / 75 / 90', () => {
    expect(strengthLevel(0).segments).toBe(0);
    expect(strengthLevel(24).segments).toBe(0);
    expect(strengthLevel(25).segments).toBe(1);
    expect(strengthLevel(50).segments).toBe(2);
    expect(strengthLevel(74).segments).toBe(2);
    expect(strengthLevel(75).segments).toBe(3);
    expect(strengthLevel(90).segments).toBe(4);
    expect(strengthLevel(100).segments).toBe(4);
  });

  it('words and tones follow the segments', () => {
    expect(strengthLevel(10)).toEqual({ segments: 0, label: 'WEAK', tone: 'bad' });
    expect(strengthLevel(30)).toEqual({ segments: 1, label: 'WEAK', tone: 'bad' });
    expect(strengthLevel(55)).toEqual({ segments: 2, label: 'FAIR', tone: 'amberText' });
    expect(strengthLevel(80)).toEqual({ segments: 3, label: 'GOOD', tone: 'accent' });
    expect(strengthLevel(95)).toEqual({ segments: 4, label: 'STRONG', tone: 'ok' });
  });

  it('calls a long mixed password strong and a short lowercase one weak', () => {
    expect(strengthLevel(checkPasswordStrength('Correct-Horse-Battery-9')).label).toBe('STRONG');
    expect(strengthLevel(checkPasswordStrength('kitten')).label).toBe('WEAK');
  });
});

describe('passwordChecks', () => {
  const met = (pw: string) => Object.fromEntries(passwordChecks(pw).map((c) => [c.id, c.met]));

  it('reports each rule independently', () => {
    expect(met('')).toEqual({ length: false, case: false, number: false, symbol: false });
    expect(met('abcdefghijkl')).toEqual({ length: true, case: false, number: false, symbol: false });
    expect(met('aB')).toEqual({ length: false, case: true, number: false, symbol: false });
    expect(met('7')).toEqual({ length: false, case: false, number: true, symbol: false });
    expect(met('!')).toEqual({ length: false, case: false, number: false, symbol: true });
    expect(met('Correct-Horse-Battery-9')).toEqual({ length: true, case: true, number: true, symbol: true });
  });

  it('needs both cases for the case rule', () => {
    expect(met('ABCDEF').case).toBe(false);
    expect(met('abcdef').case).toBe(false);
  });
});

describe('canCreateVault', () => {
  it('requires eight characters and a matching confirmation', () => {
    expect(canCreateVault('short', 'short')).toBe(false);
    expect(canCreateVault('longenough', 'longenouh')).toBe(false);
    expect(canCreateVault('longenough', '')).toBe(false);
    expect(canCreateVault('longenough', 'longenough')).toBe(true);
    expect(canCreateVault('12345678', '12345678')).toBe(true);
  });
});
