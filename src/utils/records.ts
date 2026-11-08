// Pure helpers for the v2 record model: templates, v1 → v2 mapping, display
// subtitles, digit grouping, expiry state, search and sort. No React, no
// storage, no randomness — ids come from an injected generator (callers pass
// generateSecureId from utils/crypto.ts; never Math.random).

import type {
  Credential,
  Field,
  FieldKind,
  Note,
  PersonalInfo,
  SortMode,
  TemplateId,
  VaultRecord,
} from '../types/models';

export interface TemplateFieldSpec {
  label: string;
  kind: FieldKind;
}

export interface TemplateSpec {
  label: string;
  fields: readonly TemplateFieldSpec[];
}

export const TEMPLATES: Record<TemplateId, TemplateSpec> = {
  login: {
    label: 'Login',
    fields: [
      { label: 'Username', kind: 'text' },
      { label: 'Password', kind: 'secret' },
      { label: 'Website', kind: 'url' },
      { label: 'Notes', kind: 'multiline' },
    ],
  },
  idNumber: {
    label: 'ID number',
    fields: [
      { label: 'Number', kind: 'number' },
      { label: 'Issuing authority', kind: 'text' },
      { label: 'Notes', kind: 'multiline' },
    ],
  },
  idDocument: {
    label: 'ID document',
    fields: [
      { label: 'Number', kind: 'number' },
      { label: 'Issue date', kind: 'date' },
      { label: 'Expiry date', kind: 'date' },
      { label: 'Issuing authority', kind: 'text' },
      { label: 'Notes', kind: 'multiline' },
    ],
  },
  sim: {
    label: 'SIM',
    fields: [
      { label: 'Phone number', kind: 'number' },
      { label: 'PIN', kind: 'secret' },
      { label: 'PUK', kind: 'secret' },
      { label: 'Carrier', kind: 'text' },
    ],
  },
  card: {
    label: 'Card',
    fields: [
      { label: 'Number', kind: 'number' },
      { label: 'Expiry', kind: 'date' },
      { label: 'CVV', kind: 'secret' },
      { label: 'PIN', kind: 'secret' },
      { label: 'Bank', kind: 'text' },
      { label: 'Cardholder', kind: 'text' },
    ],
  },
  wifi: {
    label: 'Wi-Fi',
    fields: [
      { label: 'Network name', kind: 'text' },
      { label: 'Password', kind: 'secret' },
    ],
  },
  note: {
    label: 'Note',
    fields: [{ label: 'Content', kind: 'multiline' }],
  },
  custom: {
    label: 'Custom',
    fields: [],
  },
};

export type IdGenerator = () => string;

/** Seeds a template's default fields with empty values. */
export const templateSeeds = (template: TemplateId, newId: IdGenerator): Field[] =>
  TEMPLATES[template].fields.map((spec) => ({
    id: newId(),
    label: spec.label,
    value: '',
    kind: spec.kind,
  }));

// ---------------------------------------------------------------------------
// v1 → v2 mapping
// ---------------------------------------------------------------------------

const hasValue = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== '';

const field = (newId: IdGenerator, label: string, kind: FieldKind, value: string): Field => ({
  id: newId(),
  label,
  value,
  kind,
});

/** Appends a field only when the v1 value is present and non-blank. */
const pushIfSet = (
  fields: Field[],
  newId: IdGenerator,
  label: string,
  kind: FieldKind,
  value: string | undefined
): void => {
  if (hasValue(value)) fields.push(field(newId, label, kind, value));
};

export const fromV1Credential = (c: Credential, newId: IdGenerator): VaultRecord => {
  const fields: Field[] = [];
  pushIfSet(fields, newId, 'Username', 'text', c.username);
  pushIfSet(fields, newId, 'Password', 'secret', c.password);
  pushIfSet(fields, newId, 'Website', 'url', c.website);
  pushIfSet(fields, newId, 'Notes', 'multiline', c.notes);
  return {
    id: c.id,
    title: c.title,
    template: 'login',
    fields,
    pinned: false,
    tags: [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
};

const ID_NUMBER_TYPES: ReadonlySet<string> = new Set(['Tax Number', 'Social Security']);

/**
 * ID number when the v1 entry is a bare number (Tax Number / Social Security
 * with no dates and no authority); anything else is an ID document.
 */
const personalInfoTemplate = (p: PersonalInfo): TemplateId =>
  ID_NUMBER_TYPES.has(p.type) &&
  hasValue(p.identifier) &&
  !hasValue(p.issueDate) &&
  !hasValue(p.expiryDate) &&
  !hasValue(p.issuingAuthority)
    ? 'idNumber'
    : 'idDocument';

export const fromV1PersonalInfo = (p: PersonalInfo, newId: IdGenerator): VaultRecord => {
  const fields: Field[] = [];
  pushIfSet(fields, newId, 'Number', 'number', p.identifier);
  pushIfSet(fields, newId, 'Issue date', 'date', p.issueDate);
  pushIfSet(fields, newId, 'Expiry date', 'date', p.expiryDate);
  pushIfSet(fields, newId, 'Issuing authority', 'text', p.issuingAuthority);
  pushIfSet(fields, newId, 'Notes', 'multiline', p.notes);
  return {
    id: p.id,
    title: p.title,
    template: personalInfoTemplate(p),
    fields,
    pinned: false,
    tags: [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
};

export const fromV1Note = (n: Note, newId: IdGenerator): VaultRecord => {
  const fields: Field[] = [];
  pushIfSet(fields, newId, 'Content', 'multiline', n.content);
  const category = (n.category ?? '').trim().toLowerCase();
  const tags = category !== '' && category !== 'other' ? [category] : [];
  return {
    id: n.id,
    title: n.title,
    template: 'note',
    fields,
    pinned: false,
    tags,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
};

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const chunk = (digits: string, size: number): string[] => {
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += size) groups.push(digits.slice(i, i + size));
  return groups;
};

/**
 * Groups of `size` from the left; a lone trailing digit is merged into the
 * previous group ("691 234 5678" reads better aloud than "691 234 567 8").
 */
const groupsOf = (digits: string, size: number): string[] => {
  const groups = chunk(digits, size);
  const last = groups[groups.length - 1];
  const previous = groups[groups.length - 2];
  if (last !== undefined && previous !== undefined && last.length === 1) {
    groups.splice(groups.length - 2, 2, previous + last);
  }
  return groups;
};

// Only +1 (NANP) and +7 (Russia/Kazakhstan) are single-digit country codes;
// everything else is treated as two digits (three-digit codes lose one digit
// to the first group, which is still readable).
const countryCodeLength = (digits: string): number =>
  digits.startsWith('1') || digits.startsWith('7') ? 1 : 2;

/**
 * Formats a run of digits for reading aloud. Anything that is not digits
 * (plus optional whitespace and a leading "+") is returned unchanged, so
 * alphanumeric document numbers like "AB1234567" keep their shape.
 */
export const groupDigits = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed === '') return value;

  if (trimmed.startsWith('+')) {
    const body = trimmed.slice(1);
    if (!/^[\d\s]+$/.test(body)) return value;
    const match = /^(\d+)\s+/.exec(body);
    const digits = body.replace(/\s+/g, '');
    // Honour an explicit separator after the prefix; otherwise guess the length.
    const ccLength = match?.[1] !== undefined ? match[1].length : countryCodeLength(digits);
    const cc = digits.slice(0, ccLength);
    const rest = digits.slice(ccLength);
    return rest === '' ? `+${cc}` : `+${cc} ${groupsOf(rest, 3).join(' ')}`;
  }

  if (!/^[\d\s]+$/.test(trimmed)) return value;
  const digits = trimmed.replace(/\s+/g, '');

  switch (digits.length) {
    case 9:
      return groupsOf(digits, 3).join(' ');
    case 11:
      // Greek ΑΜΚΑ: DD MM YY + 5-digit serial.
      return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6)}`;
    case 16:
      return groupsOf(digits, 4).join(' ');
    default:
      return groupsOf(digits, 3).join(' ');
  }
};

const displayValue = (f: Field): string => (f.kind === 'number' ? groupDigits(f.value) : f.value);

/** First non-empty, non-secret field value; otherwise a field count. */
export const subtitleFor = (record: VaultRecord): string => {
  const first = record.fields.find((f) => f.kind !== 'secret' && f.value.trim() !== '');
  if (first) return displayValue(first);
  const n = record.fields.length;
  return `${n} ${n === 1 ? 'field' : 'fields'}`;
};

export type ExpiryState = 'valid' | 'soon' | 'expired' | 'invalid';

export interface ExpiryInfo {
  state: ExpiryState;
  daysLeft: number | null;
}

export const EXPIRY_SOON_DAYS = 90;

const MS_PER_DAY = 86_400_000;

// Date-only strings are calendar dates: parse them as local midnight so the
// day boundary matches the user's clock, not UTC's.
const parseDate = (iso: string): Date | null => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfLocalDay = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Expiry state by calendar day: expiring today is still `soon`, not expired;
 * `soon` covers the next EXPIRY_SOON_DAYS days inclusive.
 */
export const expiryState = (iso: string, now: Date = new Date()): ExpiryInfo => {
  const expiry = parseDate(iso);
  if (!expiry) return { state: 'invalid', daysLeft: null };

  const daysLeft = Math.round((startOfLocalDay(expiry) - startOfLocalDay(now)) / MS_PER_DAY);
  if (daysLeft < 0) return { state: 'expired', daysLeft };
  if (daysLeft <= EXPIRY_SOON_DAYS) return { state: 'soon', daysLeft };
  return { state: 'valid', daysLeft };
};

// ---------------------------------------------------------------------------
// Search and sort
// ---------------------------------------------------------------------------

/** Lowercase, NFD-decomposed, combining marks stripped: 'Άλφα' → 'αλφα'. */
export const normalizeForSearch = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Secret values are never searchable — a hit would leak that the value exists. */
const searchableText = (record: VaultRecord): string[] => {
  const parts = [record.title, ...record.tags];
  for (const f of record.fields) {
    parts.push(f.label);
    if (f.kind !== 'secret') parts.push(f.value);
  }
  return parts;
};

export const searchRecords = (records: readonly VaultRecord[], query: string): VaultRecord[] => {
  const needle = normalizeForSearch(query.trim());
  if (needle === '') return [...records];
  return records.filter((record) =>
    searchableText(record).some((text) => normalizeForSearch(text).includes(needle))
  );
};

const timestamp = (iso: string): number => {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
};

export const sortRecords = (records: readonly VaultRecord[], mode: SortMode): VaultRecord[] =>
  [...records].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (mode === 'az') return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    return timestamp(b.updatedAt) - timestamp(a.updatedAt);
  });

export const touchRecord = (record: VaultRecord, nowIso: string): VaultRecord => ({
  ...record,
  updatedAt: nowIso,
});

// ---------------------------------------------------------------------------
// Size cap for the editor
// ---------------------------------------------------------------------------

export const MAX_RECORD_BYTES = 64 * 1024;

/** UTF-8 byte length without TextEncoder (not guaranteed on every Hermes build). */
const utf8ByteLength = (text: string): number => {
  let bytes = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
};

export const serializedSize = (record: VaultRecord): number => utf8ByteLength(JSON.stringify(record));
