// Pure helpers behind the Setup screen's strength meter and checklist. The
// score itself comes from checkPasswordStrength (utils/crypto.ts); this
// file only turns it into segments and words.

export type StrengthTone = 'bad' | 'amberText' | 'accent' | 'ok';

export interface StrengthLevel {
  /** Lit segments out of four. */
  segments: 0 | 1 | 2 | 3 | 4;
  label: 'WEAK' | 'FAIR' | 'GOOD' | 'STRONG';
  /** Token color key for the label and the lit segments. */
  tone: StrengthTone;
}

// Segments light at ≥25 / 50 / 75 / 90 of the 0–100 score.
const THRESHOLDS = [25, 50, 75, 90] as const;

export const strengthLevel = (score: number): StrengthLevel => {
  const lit = THRESHOLDS.filter((t) => score >= t).length as StrengthLevel['segments'];
  switch (lit) {
    case 4:
      return { segments: 4, label: 'STRONG', tone: 'ok' };
    case 3:
      return { segments: 3, label: 'GOOD', tone: 'accent' };
    case 2:
      return { segments: 2, label: 'FAIR', tone: 'amberText' };
    default:
      return { segments: lit, label: 'WEAK', tone: 'bad' };
  }
};

/** Minimum length Setup accepts for a master password. */
export const MIN_MASTER_PASSWORD_LENGTH = 8;

export type PasswordCheckId = 'min' | 'length' | 'case' | 'number' | 'symbol';

export interface PasswordCheck {
  id: PasswordCheckId;
  label: string;
  met: boolean;
}

export const passwordChecks = (password: string): PasswordCheck[] => [
  { id: 'min', label: `${MIN_MASTER_PASSWORD_LENGTH} or more characters`, met: password.length >= MIN_MASTER_PASSWORD_LENGTH },
  { id: 'length', label: '12 or more (recommended)', met: password.length >= 12 },
  { id: 'case', label: 'Upper and lower case', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
  { id: 'number', label: 'A number', met: /[0-9]/.test(password) },
  { id: 'symbol', label: 'A symbol', met: /[^A-Za-z0-9]/.test(password) },
];

/** The "Create vault" button is live once the password is long enough and confirmed. */
export const canCreateVault = (password: string, confirm: string): boolean =>
  password.length >= MIN_MASTER_PASSWORD_LENGTH && confirm === password;
