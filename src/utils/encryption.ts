export const obfuscateText = (text: string | undefined | null, showPartial = false): string => {
  if (!text) return '';

  if (showPartial && text.length > 4) {
    return text.substring(0, 2) + '•'.repeat(text.length - 4) + text.substring(text.length - 2);
  }

  return '•'.repeat(text.length);
};

export const generateSecureId = (): string => {
  const timestamp = new Date().getTime().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomStr}`;
};

export const simpleHash = (text: string | undefined | null): string | number => {
  let hash = 0;
  if (!text) return hash;

  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return hash.toString(16);
};

export const prepareSensitiveData = <T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: Array<keyof T> = []
): T & Record<string, unknown> => {
  const preparedData: Record<string, unknown> = { ...data };

  sensitiveFields.forEach((field) => {
    if (preparedData[field as string]) {
      preparedData[`${String(field)}_sensitive`] = true;
    }
  });

  return preparedData as T & Record<string, unknown>;
};

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
