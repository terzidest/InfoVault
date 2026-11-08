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
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PersonalInfoInput = Omit<PersonalInfo, 'id' | 'createdAt' | 'updatedAt'>;

// 'system' follows the OS appearance; the other two pin the scheme.
export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  // Schema version of the persisted blob. v1 blobs have none (see
  // settingsStore.migrateStoredSettings).
  version: number;
  theme: ThemeMode;
  autoLockTimeout: number;
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
