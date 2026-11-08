import {
  KIND_ORDER,
  MAX_TAG_LENGTH,
  TEMPLATE_ORDER,
  addTag,
  allValuesEmpty,
  countdown,
  expiryBadge,
  hexAlpha,
  isExpiryField,
  isLastEnabledClass,
  kindCycle,
  moveField,
  normalizeTag,
  normalizeUrl,
  rowCopyTarget,
  subtitleIsMono,
  toggleCharClass,
  validateDraft,
} from '../recordUi';
import type { CharClasses } from '../recordUi';
import type { Field, FieldKind, VaultRecord } from '../../../../types/models';

const field = (label: string, kind: FieldKind, value: string, id = label): Field => ({ id, label, kind, value });

const record = (fields: Field[]): VaultRecord => ({
  id: 'r1',
  title: 'Record',
  template: 'custom',
  fields,
  pinned: false,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('expiryBadge', () => {
  it('is null for an unparseable date', () => {
    expect(expiryBadge({ state: 'invalid', daysLeft: null })).toBeNull();
  });

  it('marks expired dates as bad', () => {
    expect(expiryBadge({ state: 'expired', daysLeft: -3 })).toEqual({ label: 'EXPIRED', tone: 'bad' });
  });

  it('counts days in amber when soon', () => {
    expect(expiryBadge({ state: 'soon', daysLeft: 45 })).toEqual({ label: '45 DAYS LEFT', tone: 'amber' });
    expect(expiryBadge({ state: 'soon', daysLeft: 1 })).toEqual({ label: '1 DAY LEFT', tone: 'amber' });
    expect(expiryBadge({ state: 'soon', daysLeft: 0 })).toEqual({ label: 'EXPIRES TODAY', tone: 'amber' });
  });

  it('switches to months at 60 days when valid', () => {
    expect(expiryBadge({ state: 'valid', daysLeft: 59 })).toEqual({ label: '59 DAYS LEFT', tone: 'ok' });
    expect(expiryBadge({ state: 'valid', daysLeft: 60 })).toEqual({ label: '2 MONTHS LEFT', tone: 'ok' });
    expect(expiryBadge({ state: 'valid', daysLeft: 365 })).toEqual({ label: '12 MONTHS LEFT', tone: 'ok' });
    expect(expiryBadge({ state: 'valid', daysLeft: 1000 })).toEqual({ label: '33 MONTHS LEFT', tone: 'ok' });
  });
});

describe('isExpiryField', () => {
  it('only matches expiry-like labels', () => {
    expect(isExpiryField('Expiry date')).toBe(true);
    expect(isExpiryField('Expires')).toBe(true);
    expect(isExpiryField('Valid until')).toBe(true);
    expect(isExpiryField('Issue date')).toBe(false);
    expect(isExpiryField('Birthday')).toBe(false);
  });
});

describe('kindCycle', () => {
  it('walks every kind and wraps around', () => {
    const seen: FieldKind[] = [];
    let kind: FieldKind = 'text';
    for (let i = 0; i < KIND_ORDER.length; i++) {
      seen.push(kind);
      kind = kindCycle(kind);
    }
    expect(seen).toEqual(KIND_ORDER);
    expect(kind).toBe('text');
  });

  it('follows the documented order', () => {
    expect(kindCycle('text')).toBe('secret');
    expect(kindCycle('secret')).toBe('number');
    expect(kindCycle('multiline')).toBe('text');
  });
});

describe('normalizeTag / addTag', () => {
  it('trims, lowercases and collapses whitespace', () => {
    expect(normalizeTag('  Work   Email ')).toBe('work email');
  });

  it('returns null when nothing is left', () => {
    expect(normalizeTag('   ')).toBeNull();
    expect(normalizeTag('')).toBeNull();
  });

  it('caps at MAX_TAG_LENGTH characters', () => {
    const long = 'a'.repeat(MAX_TAG_LENGTH + 10);
    expect(normalizeTag(long)).toHaveLength(MAX_TAG_LENGTH);
    expect(MAX_TAG_LENGTH).toBe(24);
  });

  it('does not leave a trailing space after the cut', () => {
    const raw = 'a'.repeat(MAX_TAG_LENGTH - 1) + ' b';
    expect(normalizeTag(raw)).toBe('a'.repeat(MAX_TAG_LENGTH - 1));
  });

  it('dedupes case-insensitively and leaves the input untouched', () => {
    const tags = ['work'];
    expect(addTag(tags, 'WORK')).toEqual(['work']);
    expect(addTag(tags, 'home')).toEqual(['work', 'home']);
    expect(addTag(tags, '  ')).toEqual(['work']);
    expect(tags).toEqual(['work']);
  });
});

describe('rowCopyTarget', () => {
  it('copies the first non-empty, non-secret field (the subtitle source)', () => {
    const r = record([field('Username', 'text', ' '), field('Password', 'secret', 'pw'), field('Website', 'url', 'x.com')]);
    expect(rowCopyTarget(r)).toEqual({ value: 'x.com', label: 'Copy website', secret: false });
  });

  it('copies the raw number, not the grouped display', () => {
    const r = record([field('Number', 'number', '123456789')]);
    expect(rowCopyTarget(r)?.value).toBe('123456789');
  });

  it('falls back to the first secret and names it', () => {
    const pw = record([field('Username', 'text', ''), field('Password', 'secret', 'pw')]);
    expect(rowCopyTarget(pw)).toEqual({ value: 'pw', label: 'Copy password', secret: true });

    const pin = record([field('PIN', 'secret', ''), field('PUK', 'secret', '1234')]);
    expect(rowCopyTarget(pin)).toEqual({ value: '1234', label: 'Copy value', secret: true });
  });

  it('is null when nothing is set', () => {
    expect(rowCopyTarget(record([]))).toBeNull();
    expect(rowCopyTarget(record([field('Password', 'secret', '')]))).toBeNull();
  });
});

describe('subtitleIsMono', () => {
  it('is true only when the subtitle source is a number', () => {
    expect(subtitleIsMono(record([field('Number', 'number', '12')]))).toBe(true);
    expect(subtitleIsMono(record([field('Username', 'text', 'me'), field('Number', 'number', '12')]))).toBe(false);
    expect(subtitleIsMono(record([field('PIN', 'secret', '12')]))).toBe(false);
    expect(subtitleIsMono(record([]))).toBe(false);
  });
});

describe('countdown', () => {
  it('rounds up to whole seconds and clamps at zero', () => {
    expect(countdown(0, 0, 10_000)).toBe(10);
    expect(countdown(0, 1, 10_000)).toBe(10);
    expect(countdown(0, 1_000, 10_000)).toBe(9);
    expect(countdown(0, 9_001, 10_000)).toBe(1);
    expect(countdown(0, 10_000, 10_000)).toBe(0);
    expect(countdown(0, 50_000, 10_000)).toBe(0);
  });
});

describe('hexAlpha / normalizeUrl', () => {
  it('converts hex tints to rgba and leaves other strings alone', () => {
    expect(hexAlpha('#FFC107', 0.14)).toBe('rgba(255,193,7,0.14)');
    expect(hexAlpha('rgba(1,2,3,0.5)', 0.14)).toBe('rgba(1,2,3,0.5)');
  });

  it('prepends https:// only when there is no scheme', () => {
    expect(normalizeUrl('example.com/login')).toBe('https://example.com/login');
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
    expect(normalizeUrl('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(normalizeUrl('  ')).toBeNull();
  });
});

describe('char classes', () => {
  const all: CharClasses = { upper: true, lower: true, digits: true, symbols: true };

  it('toggles freely while more than one class is on', () => {
    expect(toggleCharClass(all, 'symbols')).toEqual({ ...all, symbols: false });
    expect(toggleCharClass({ ...all, symbols: false }, 'symbols')).toEqual(all);
  });

  it('refuses to turn off the last enabled class', () => {
    const onlyLower: CharClasses = { upper: false, lower: true, digits: false, symbols: false };
    expect(toggleCharClass(onlyLower, 'lower')).toBe(onlyLower);
    expect(isLastEnabledClass(onlyLower, 'lower')).toBe(true);
    expect(isLastEnabledClass(onlyLower, 'upper')).toBe(false);
    expect(isLastEnabledClass(all, 'lower')).toBe(false);
  });
});

describe('TEMPLATE_ORDER', () => {
  it('lists every template once in the design order', () => {
    expect(TEMPLATE_ORDER).toEqual(['login', 'idNumber', 'idDocument', 'sim', 'card', 'wifi', 'note', 'custom']);
  });
});

describe('editor draft helpers', () => {
  it('allValuesEmpty ignores labels and whitespace', () => {
    expect(allValuesEmpty([])).toBe(true);
    expect(allValuesEmpty([field('Username', 'text', '   '), field('Password', 'secret', '')])).toBe(true);
    expect(allValuesEmpty([field('Username', 'text', ''), field('Password', 'secret', 'x')])).toBe(false);
  });

  it('moveField swaps with the neighbour and leaves the ends alone', () => {
    const fields = [field('A', 'text', ''), field('B', 'text', ''), field('C', 'text', '')];
    expect(moveField(fields, 1, -1).map((f) => f.id)).toEqual(['B', 'A', 'C']);
    expect(moveField(fields, 1, 1).map((f) => f.id)).toEqual(['A', 'C', 'B']);
    expect(moveField(fields, 0, -1).map((f) => f.id)).toEqual(['A', 'B', 'C']);
    expect(moveField(fields, 2, 1).map((f) => f.id)).toEqual(['A', 'B', 'C']);
    expect(moveField(fields, 0, 1)).not.toBe(fields); // always a copy
  });

  it('validateDraft requires a title and at least one value, except a field-less Custom record', () => {
    const value = field('Number', 'number', '123456789');
    const empty = field('Number', 'number', '');
    expect(validateDraft({ title: '  ', template: 'idNumber', fields: [value] })).toBe('Give the record a title');
    expect(validateDraft({ title: 'ΑΦΜ', template: 'idNumber', fields: [empty] })).toBe('Fill in at least one field');
    expect(validateDraft({ title: 'Note', template: 'note', fields: [] })).toBe('Add at least one field');
    expect(validateDraft({ title: 'Login', template: 'login', fields: [] })).toBe('Add at least one field');
    expect(validateDraft({ title: 'ΑΦΜ', template: 'idNumber', fields: [value] })).toBeNull();
    expect(validateDraft({ title: 'Placeholder', template: 'custom', fields: [] })).toBeNull();
    expect(validateDraft({ title: 'Placeholder', template: 'custom', fields: [empty] })).toBe('Fill in at least one field');
  });
});
