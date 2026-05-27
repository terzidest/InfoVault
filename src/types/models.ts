import * as LocalAuthentication from 'expo-local-authentication';

export interface Credential {
  id: string;
  title: string;
  username?: string;
  password?: string;
  website?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CredentialInput = Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>;

export type NoteCategory = string;

export interface Note {
  id: string;
  title: string;
  content?: string;
  category: NoteCategory;
  createdAt: string;
  updatedAt: string;
}

export type NoteInput = Omit<Note, 'id' | 'createdAt' | 'updatedAt'> & {
  category?: NoteCategory;
};

export interface PersonalInfo {
  id: string;
  title: string;
  type: string;
  identifier?: string;
  issueDate?: string;
  expiryDate?: string;
  issuingAuthority?: string;
  description?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PersonalInfoInput = Omit<PersonalInfo, 'id' | 'createdAt' | 'updatedAt'>;

export type ThemeMode = 'light' | 'dark';

export interface Settings {
  theme: ThemeMode;
  autoLockTimeout: number;
  showBiometricPrompt: boolean;
  maskSensitiveData: boolean;
}

export interface AuthTypes {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  hasFaceId: boolean;
  hasFingerprintId: boolean;
  hasIris: boolean;
}

export interface PremiumFeature {
  id: string;
  name: string;
  description: string;
  available: boolean;
}
