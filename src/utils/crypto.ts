import * as Crypto from 'expo-crypto';

export const generateSecureId = (): string => Crypto.randomUUID();

export const checkPasswordStrength = (password: string | undefined | null): number => {
  if (!password) return 0;

  let score = 0;

  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;

  if (/[A-Z]/.test(password)) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;

  const uniqueChars = new Set(password).size;
  score += Math.min(10, uniqueChars / 2);

  return Math.min(100, score);
};
