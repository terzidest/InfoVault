// Pure helpers behind the record UI components: badge text for expiry
// states, the field-kind cycle used by the editor, tag normalisation, the
// row copy target, the reveal countdown and small colour/url utilities.
// No React, no storage — everything here is unit-tested in __tests__.
import type { Ionicons } from '@expo/vector-icons';
import type { Field, FieldKind, TemplateId, VaultRecord } from '../../../types/models';
import type { ExpiryInfo } from '../../../utils/records';

export type IoniconName = keyof typeof Ionicons.glyphMap;

/** Display order for template pickers (matches the design canvas). */
export const TEMPLATE_ORDER: readonly TemplateId[] = [
  'login',
  'idNumber',
  'idDocument',
  'sim',
  'card',
  'wifi',
  'note',
  'custom',
];

/** Ionicons glyph per template. */
export const TEMPLATE_ICONS: Record<TemplateId, IoniconName> = {
  login: 'key-outline',
  idNumber: 'pricetag-outline',
  idDocument: 'card-outline',
  sim: 'hardware-chip-outline',
  card: 'wallet-outline',
  wifi: 'wifi-outline',
  note: 'document-text-outline',
  custom: 'options-outline',
};

// ---------------------------------------------------------------------------
// Expiry badge
// ---------------------------------------------------------------------------

export type BadgeTone = 'ok' | 'amber' | 'bad';

export interface ExpiryBadge {
  label: string;
  tone: BadgeTone;
}

/** Days at or above which the valid badge switches from days to months. */
export const MONTHS_THRESHOLD_DAYS = 60;

const DAYS_PER_MONTH = 30.44;

const plural = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? '' : 'S'}`;

/**
 * Badge for a date field's expiry state; `null` for an unparseable date
 * (render the raw text instead). Labels are uppercase: they sit in a `Kind`.
 */
export const expiryBadge = (info: ExpiryInfo): ExpiryBadge | null => {
  const days = info.daysLeft ?? 0;
  switch (info.state) {
    case 'expired':
      return { label: 'EXPIRED', tone: 'bad' };
    case 'soon':
      return { label: days === 0 ? 'EXPIRES TODAY' : `${plural(days, 'DAY')} LEFT`, tone: 'amber' };
    case 'valid':
      return {
        label:
          days >= MONTHS_THRESHOLD_DAYS
            ? `${plural(Math.round(days / DAYS_PER_MONTH), 'MONTH')} LEFT`
            : `${plural(days, 'DAY')} LEFT`,
        tone: 'ok',
      };
    case 'invalid':
      return null;
  }
};

// ---------------------------------------------------------------------------
// Field kinds
// ---------------------------------------------------------------------------

/** Tap order for the editor's kind pill. */
export const KIND_ORDER: readonly FieldKind[] = ['text', 'secret', 'number', 'date', 'url', 'multiline'];

export const kindCycle = (kind: FieldKind): FieldKind => {
  const i = KIND_ORDER.indexOf(kind);
  return KIND_ORDER[(i + 1) % KIND_ORDER.length] ?? 'text';
};

/** Kinds rendered in the mono face (identifiers and secrets). */
export const isMonoKind = (kind: FieldKind): boolean => kind === 'number' || kind === 'secret';

// ---------------------------------------------------------------------------
// Editor draft
// ---------------------------------------------------------------------------

/** True when no field holds anything yet (a template switch may replace them). */
export const allValuesEmpty = (fields: readonly Field[]): boolean => fields.every((f) => f.value.trim() === '');

/** Swaps the field at `index` with its neighbour; out of range → unchanged copy. */
export const moveField = (fields: readonly Field[], index: number, direction: -1 | 1): Field[] => {
  const next = [...fields];
  const target = index + direction;
  const a = next[index];
  const b = next[target];
  if (a === undefined || b === undefined) return next;
  next[index] = b;
  next[target] = a;
  return next;
};

export interface RecordDraft {
  title: string;
  template: TemplateId;
  fields: readonly Field[];
}

/**
 * What stops a draft from being saved, or null. A title is always required;
 * a record must hold at least one value. The one exception is a Custom
 * record with no fields at all (a title-only placeholder is a legitimate
 * thing to keep); any other template with every field removed needs one back.
 */
export const validateDraft = (draft: RecordDraft): string | null => {
  if (draft.title.trim() === '') return 'Give the record a title';
  if (draft.fields.length === 0) return draft.template === 'custom' ? null : 'Add at least one field';
  if (allValuesEmpty(draft.fields)) return 'Fill in at least one field';
  return null;
};

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const MAX_TAG_LENGTH = 24;

/** Trimmed, lowercased, capped at MAX_TAG_LENGTH; `null` when nothing is left. */
export const normalizeTag = (raw: string): string | null => {
  const tag = raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH).trim();
  return tag === '' ? null : tag;
};

/** Appends a normalised tag unless it is empty or already present. */
export const addTag = (tags: readonly string[], raw: string): string[] => {
  const tag = normalizeTag(raw);
  if (tag === null || tags.includes(tag)) return [...tags];
  return [...tags, tag];
};

// ---------------------------------------------------------------------------
// Row copy target
// ---------------------------------------------------------------------------

export interface CopyTarget {
  value: string;
  /** Accessibility label for the copy button, e.g. "Copy username". */
  label: string;
  /** The value is a secret field (callers must use the clearing clipboard). */
  secret: boolean;
}

const isSet = (f: Field): boolean => f.value.trim() !== '';

/** First non-empty, non-secret field — the one `subtitleFor` shows. */
export const subtitleField = (record: VaultRecord): Field | undefined =>
  record.fields.find((f) => f.kind !== 'secret' && isSet(f));

/** Whether the row subtitle should use the mono face (a `number` field). */
export const subtitleIsMono = (record: VaultRecord): boolean => subtitleField(record)?.kind === 'number';

/**
 * What the row's trailing copy button copies: the subtitle's source value,
 * else the first non-empty secret ("Copy password" / "Copy value"), else
 * nothing (no button).
 */
export const rowCopyTarget = (record: VaultRecord): CopyTarget | null => {
  const visible = subtitleField(record);
  if (visible) return { value: visible.value, label: `Copy ${visible.label.toLowerCase()}`, secret: false };
  const secret = record.fields.find((f) => f.kind === 'secret' && isSet(f));
  if (secret) {
    return {
      value: secret.value,
      label: /password/i.test(secret.label) ? 'Copy password' : 'Copy value',
      secret: true,
    };
  }
  return null;
};

// ---------------------------------------------------------------------------
// Reveal countdown
// ---------------------------------------------------------------------------

/** Whole seconds left of a `ms` window opened at `startedAt`, never below 0. */
export const countdown = (startedAt: number, now: number, ms: number): number =>
  Math.max(0, Math.ceil((ms - (now - startedAt)) / 1000));

// ---------------------------------------------------------------------------
// Colour and url utilities
// ---------------------------------------------------------------------------

/** `#rrggbb` + alpha → `rgba()`; non-hex input is returned unchanged. */
export const hexAlpha = (hex: string, alpha: number): string => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  return `rgba(${parseInt(m[1] ?? '0', 16)},${parseInt(m[2] ?? '0', 16)},${parseInt(m[3] ?? '0', 16)},${alpha})`;
};

/** Prepends `https://` when the value has no scheme; `null` when blank. */
export const normalizeUrl = (raw: string): string | null => {
  const value = raw.trim();
  if (value === '') return null;
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
};

/**
 * Only fields that are about expiry get the countdown badge: an issue date
 * in the past is not "EXPIRED".
 */
export const isExpiryField = (label: string): boolean => /expir|valid until|until/i.test(label);

// ---------------------------------------------------------------------------
// Generator sheet
// ---------------------------------------------------------------------------

/** Password lengths offered by the generator sheet. */
export const GENERATOR_LENGTHS = ['12', '16', '24'] as const;
export type GeneratorLength = (typeof GENERATOR_LENGTHS)[number];

export type CharClass = 'upper' | 'lower' | 'digits' | 'symbols';
export type CharClasses = Record<CharClass, boolean>;

export const CHAR_CLASS_LABELS: Record<CharClass, string> = {
  upper: 'Uppercase',
  lower: 'Lowercase',
  digits: 'Digits',
  symbols: 'Symbols',
};

export const CHAR_CLASS_ORDER: readonly CharClass[] = ['upper', 'lower', 'digits', 'symbols'];

/** Flips one class; refuses to turn off the last enabled one. */
export const toggleCharClass = (classes: CharClasses, key: CharClass): CharClasses => {
  const enabled = CHAR_CLASS_ORDER.filter((k) => classes[k]);
  if (classes[key] && enabled.length === 1) return classes;
  return { ...classes, [key]: !classes[key] };
};

/** Whether this is the only class still on (its switch must stay locked). */
export const isLastEnabledClass = (classes: CharClasses, key: CharClass): boolean =>
  classes[key] && CHAR_CLASS_ORDER.filter((k) => classes[k]).length === 1;
