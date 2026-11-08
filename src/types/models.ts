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

export type ThemeMode = 'light' | 'dark';

export interface Settings {
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

// ---------------------------------------------------------------------------
// v2 unified record model (INFOVAULT_V2_SPEC.md §1). The v1 types above stay
// until the storage cutover; the migration maps them with utils/records.ts.
// Named VaultRecord rather than Record to avoid shadowing TS's Record<K, V>.
// ---------------------------------------------------------------------------

export type FieldKind = 'text' | 'secret' | 'number' | 'date' | 'url' | 'multiline';

export type TemplateId = 'login' | 'idNumber' | 'idDocument' | 'sim' | 'card' | 'wifi' | 'note' | 'custom';

export interface Field {
  id: string;
  label: string;
  value: string;
  kind: FieldKind;
}

export interface VaultRecord {
  id: string;
  title: string;
  template: TemplateId;
  fields: Field[];
  pinned: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type VaultRecordInput = Omit<VaultRecord, 'id' | 'createdAt' | 'updatedAt'>;

export type SortMode = 'lastUsed' | 'az';
