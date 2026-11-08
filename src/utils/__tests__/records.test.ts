import {
  EXPIRY_SOON_DAYS,
  MAX_RECORD_BYTES,
  TEMPLATES,
  expiryState,
  fromV1Credential,
  fromV1Note,
  fromV1PersonalInfo,
  groupDigits,
  normalizeForSearch,
  searchRecords,
  serializedSize,
  sortRecords,
  subtitleFor,
  templateSeeds,
  touchRecord,
} from '../records';
import type { Credential, Field, FieldKind, Note, PersonalInfo, TemplateId, VaultRecord } from '../../types/models';

// Deterministic id generator so tests can assert exactly which ids were handed out.
const makeIdGen = (prefix = 'id') => {
  let n = 0;
  return () => `${prefix}-${++n}`;
};

const makeRecord = (overrides: Partial<VaultRecord> = {}): VaultRecord => ({
  id: 'r1',
  title: 'Record',
  template: 'custom',
  fields: [],
  pinned: false,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

// Reference UTF-8 byte count without Node's Buffer (not in the RN TS lib).
const utf8Bytes = (text: string): number => encodeURIComponent(text).replace(/%[0-9A-F]{2}/g, 'x').length;

const f = (label: string, kind: FieldKind, value: string, id = label): Field => ({ id, label, kind, value });

describe('TEMPLATES and templateSeeds', () => {
  const expected: Record<TemplateId, [string, FieldKind][]> = {
    login: [
      ['Username', 'text'],
      ['Password', 'secret'],
      ['Website', 'url'],
      ['Notes', 'multiline'],
    ],
    idNumber: [
      ['Number', 'number'],
      ['Issuing authority', 'text'],
      ['Notes', 'multiline'],
    ],
    idDocument: [
      ['Number', 'number'],
      ['Issue date', 'date'],
      ['Expiry date', 'date'],
      ['Issuing authority', 'text'],
      ['Notes', 'multiline'],
    ],
    sim: [
      ['Phone number', 'number'],
      ['PIN', 'secret'],
      ['PUK', 'secret'],
      ['Carrier', 'text'],
    ],
    card: [
      ['Number', 'number'],
      ['Expiry', 'date'],
      ['CVV', 'secret'],
      ['PIN', 'secret'],
      ['Bank', 'text'],
      ['Cardholder', 'text'],
    ],
    wifi: [
      ['Network name', 'text'],
      ['Password', 'secret'],
    ],
    note: [['Content', 'multiline']],
    custom: [],
  };

  it.each(Object.keys(expected) as TemplateId[])('%s seeds the spec fields with empty values', (template) => {
    const newId = jest.fn(makeIdGen());
    const seeds = templateSeeds(template, newId);
    const specFields = expected[template];

    expect(seeds.map((s) => [s.label, s.kind])).toEqual(specFields);
    expect(seeds.every((s) => s.value === '')).toBe(true);
    expect(newId).toHaveBeenCalledTimes(specFields.length);
    expect(seeds.map((s) => s.id)).toEqual(specFields.map((_, i) => `id-${i + 1}`));
    expect(TEMPLATES[template].fields.map((s) => [s.label, s.kind])).toEqual(specFields);
  });

  it('covers all eight templates with a label', () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(
      ['card', 'custom', 'idDocument', 'idNumber', 'login', 'note', 'sim', 'wifi']
    );
    for (const spec of Object.values(TEMPLATES)) expect(spec.label).not.toBe('');
  });

  it('returns fresh field objects on every call', () => {
    const a = templateSeeds('login', makeIdGen('a'));
    const b = templateSeeds('login', makeIdGen('b'));
    expect(a[0]).not.toBe(b[0]);
    expect(a[0]?.id).toBe('a-1');
    expect(b[0]?.id).toBe('b-1');
  });
});

describe('v1 → v2 mapping', () => {
  const stamps = { createdAt: '2025-03-01T10:00:00.000Z', updatedAt: '2025-04-01T10:00:00.000Z' };

  describe('fromV1Credential', () => {
    it('maps every v1 field to a login record and preserves identity', () => {
      const c: Credential = {
        id: 'c1',
        title: 'GitHub',
        username: 'alice',
        password: 'hunter2',
        website: 'https://github.com',
        notes: 'work account',
        ...stamps,
      };
      const record = fromV1Credential(c, makeIdGen());

      expect(record).toMatchObject({ id: 'c1', title: 'GitHub', template: 'login', pinned: false, tags: [], ...stamps });
      expect(record.fields).toEqual([
        { id: 'id-1', label: 'Username', kind: 'text', value: 'alice' },
        { id: 'id-2', label: 'Password', kind: 'secret', value: 'hunter2' },
        { id: 'id-3', label: 'Website', kind: 'url', value: 'https://github.com' },
        { id: 'id-4', label: 'Notes', kind: 'multiline', value: 'work account' },
      ]);
    });

    it('omits empty or missing optional fields', () => {
      const c: Credential = { id: 'c2', title: 'Bare', username: '', password: 'p', ...stamps };
      const record = fromV1Credential(c, makeIdGen());
      expect(record.fields.map((x) => x.label)).toEqual(['Password']);
    });
  });

  describe('fromV1PersonalInfo', () => {
    const base: PersonalInfo = { id: 'p1', title: 'ΑΦΜ', type: 'Tax Number', ...stamps };

    it('becomes idNumber when only the identifier is set for Tax Number / Social Security', () => {
      const tax = fromV1PersonalInfo({ ...base, identifier: '123456789' }, makeIdGen());
      expect(tax.template).toBe('idNumber');
      expect(tax.fields).toEqual([{ id: 'id-1', label: 'Number', kind: 'number', value: '123456789' }]);

      const ssn = fromV1PersonalInfo({ ...base, type: 'Social Security', identifier: '01019012345' }, makeIdGen());
      expect(ssn.template).toBe('idNumber');
    });

    it('still allows notes on an idNumber record', () => {
      const r = fromV1PersonalInfo({ ...base, identifier: '123456789', notes: 'issued 2010' }, makeIdGen());
      expect(r.template).toBe('idNumber');
      expect(r.fields.map((x) => x.label)).toEqual(['Number', 'Notes']);
    });

    it('becomes idDocument when a date or authority is present, even for Tax Number', () => {
      expect(fromV1PersonalInfo({ ...base, identifier: '1', issueDate: '2020-01-01' }, makeIdGen()).template).toBe('idDocument');
      expect(fromV1PersonalInfo({ ...base, identifier: '1', expiryDate: '2030-01-01' }, makeIdGen()).template).toBe('idDocument');
      expect(fromV1PersonalInfo({ ...base, identifier: '1', issuingAuthority: 'ΑΑΔΕ' }, makeIdGen()).template).toBe('idDocument');
    });

    it('becomes idDocument for other types and when the identifier is missing', () => {
      expect(fromV1PersonalInfo({ ...base, type: 'Passport', identifier: 'AB1234567' }, makeIdGen()).template).toBe('idDocument');
      expect(fromV1PersonalInfo({ ...base }, makeIdGen()).template).toBe('idDocument');
    });

    it('maps all document fields in template order and preserves identity', () => {
      const p: PersonalInfo = {
        id: 'p2',
        title: 'Passport',
        type: 'Passport',
        identifier: 'AB1234567',
        issueDate: '2020-05-01',
        expiryDate: '2030-05-01',
        issuingAuthority: 'Hellenic Police',
        notes: 'renew early',
        ...stamps,
      };
      const record = fromV1PersonalInfo(p, makeIdGen());
      expect(record).toMatchObject({ id: 'p2', title: 'Passport', template: 'idDocument', pinned: false, tags: [], ...stamps });
      expect(record.fields).toEqual([
        { id: 'id-1', label: 'Number', kind: 'number', value: 'AB1234567' },
        { id: 'id-2', label: 'Issue date', kind: 'date', value: '2020-05-01' },
        { id: 'id-3', label: 'Expiry date', kind: 'date', value: '2030-05-01' },
        { id: 'id-4', label: 'Issuing authority', kind: 'text', value: 'Hellenic Police' },
        { id: 'id-5', label: 'Notes', kind: 'multiline', value: 'renew early' },
      ]);
    });
  });

  describe('fromV1Note', () => {
    it('maps content and turns the category into a lowercase tag', () => {
      const n: Note = { id: 'n1', title: 'Ideas', content: 'Build a thing', category: 'Work', ...stamps };
      const record = fromV1Note(n, makeIdGen());
      expect(record).toMatchObject({ id: 'n1', title: 'Ideas', template: 'note', pinned: false, tags: ['work'], ...stamps });
      expect(record.fields).toEqual([{ id: 'id-1', label: 'Content', kind: 'multiline', value: 'Build a thing' }]);
    });

    it("drops the 'Other' and empty categories and omits empty content", () => {
      expect(fromV1Note({ id: 'n2', title: 'x', category: 'Other', ...stamps }, makeIdGen())).toMatchObject({ tags: [], fields: [] });
      expect(fromV1Note({ id: 'n3', title: 'x', category: '', content: '', ...stamps }, makeIdGen()).tags).toEqual([]);
      expect(fromV1Note({ id: 'n4', title: 'x', category: '  Personal ', ...stamps }, makeIdGen()).tags).toEqual(['personal']);
    });
  });
});

describe('groupDigits', () => {
  it('groups 9 digits in threes', () => {
    expect(groupDigits('123456789')).toBe('123 456 789');
  });

  it('groups 11 digits as 2-2-2-5 (ΑΜΚΑ)', () => {
    expect(groupDigits('01019012345')).toBe('01 01 90 12345');
  });

  it('groups 16 digits in fours', () => {
    expect(groupDigits('4111111111111111')).toBe('4111 1111 1111 1111');
  });

  it('keeps the + and country code for phone numbers, then groups of 3', () => {
    expect(groupDigits('+306912345678')).toBe('+30 691 234 5678');
    expect(groupDigits('+30 6912345678')).toBe('+30 691 234 5678');
    expect(groupDigits('+12125551234')).toBe('+1 212 555 1234');
    expect(groupDigits('+44 20 7946 0958')).toBe('+44 207 946 0958');
  });

  it('falls back to groups of 3 from the left for other lengths', () => {
    expect(groupDigits('123456')).toBe('123 456');
    expect(groupDigits('12345678')).toBe('123 456 78');
    expect(groupDigits('123')).toBe('123');
  });

  it('re-groups already spaced digits', () => {
    expect(groupDigits('123 45 6789')).toBe('123 456 789');
  });

  it('returns non-numeric input unchanged', () => {
    expect(groupDigits('AB1234567')).toBe('AB1234567');
    expect(groupDigits('hello')).toBe('hello');
    expect(groupDigits('')).toBe('');
    expect(groupDigits('+30-691')).toBe('+30-691');
  });
});

describe('subtitleFor', () => {
  it('uses the first non-empty non-secret field', () => {
    const record = makeRecord({
      fields: [f('Password', 'secret', 'p'), f('Username', 'text', ''), f('Website', 'url', 'example.com')],
    });
    expect(subtitleFor(record)).toBe('example.com');
  });

  it('groups number fields', () => {
    const record = makeRecord({ fields: [f('Number', 'number', '123456789')] });
    expect(subtitleFor(record)).toBe('123 456 789');
  });

  it('never reveals a secret and falls back to a field count', () => {
    expect(subtitleFor(makeRecord({ fields: [f('PIN', 'secret', '1234'), f('PUK', 'secret', '5678')] }))).toBe('2 fields');
    expect(subtitleFor(makeRecord({ fields: [f('PIN', 'secret', '1234')] }))).toBe('1 field');
    expect(subtitleFor(makeRecord())).toBe('0 fields');
  });
});

describe('expiryState', () => {
  const now = new Date(2026, 5, 15, 12, 0, 0); // 15 June 2026, local noon

  it('is valid when more than 90 days away', () => {
    expect(expiryState('2027-06-15', now)).toEqual({ state: 'valid', daysLeft: 365 });
    expect(expiryState('2026-09-14', now).state).toBe('valid'); // 91 days
  });

  it('is soon within 90 days, inclusive, including today', () => {
    expect(expiryState('2026-09-13', now)).toEqual({ state: 'soon', daysLeft: EXPIRY_SOON_DAYS });
    expect(expiryState('2026-06-16', now)).toEqual({ state: 'soon', daysLeft: 1 });
    expect(expiryState('2026-06-15', now)).toEqual({ state: 'soon', daysLeft: 0 });
  });

  it('is expired with a negative day count', () => {
    expect(expiryState('2026-06-14', now)).toEqual({ state: 'expired', daysLeft: -1 });
    expect(expiryState('2020-01-01', now).state).toBe('expired');
  });

  it('accepts full ISO timestamps', () => {
    expect(expiryState(new Date(2026, 6, 1, 8).toISOString(), now)).toEqual({ state: 'soon', daysLeft: 16 });
  });

  it('is invalid for garbage or empty input', () => {
    expect(expiryState('not a date', now)).toEqual({ state: 'invalid', daysLeft: null });
    expect(expiryState('', now)).toEqual({ state: 'invalid', daysLeft: null });
  });

  it('defaults now to the current time', () => {
    expect(expiryState('1999-01-01').state).toBe('expired');
  });
});

describe('searchRecords', () => {
  const records: VaultRecord[] = [
    makeRecord({ id: 'a', title: 'ΑΦΜ', template: 'idNumber', fields: [f('Αριθμός', 'number', '123456789')], tags: ['φορολογία'] }),
    makeRecord({ id: 'b', title: 'GitHub', template: 'login', fields: [f('Username', 'text', 'alice'), f('Password', 'secret', 'sup3rs3cret')], tags: ['employer'] }),
    makeRecord({ id: 'c', title: 'Café Wi-Fi', template: 'wifi', fields: [f('Network name', 'text', 'Résidence'), f('Password', 'secret', 'latte')] }),
  ];
  const ids = (q: string) => searchRecords(records, q).map((r) => r.id);

  it('returns everything for an empty or whitespace query, as a new array', () => {
    const all = searchRecords(records, '');
    expect(all.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(all).not.toBe(records);
    expect(ids('   ')).toEqual(['a', 'b', 'c']);
  });

  it('matches title, tag, field label and non-secret field value', () => {
    expect(ids('github')).toEqual(['b']);
    expect(ids('employer')).toEqual(['b']);
    expect(ids('network')).toEqual(['c']);
    expect(ids('alice')).toEqual(['b']);
    expect(ids('123456789')).toEqual(['a']);
  });

  it('is case- and accent-insensitive, including Greek', () => {
    expect(ids('αφμ')).toEqual(['a']);
    expect(ids('ΑΦΜ')).toEqual(['a']);
    expect(ids('αριθμος')).toEqual(['a']); // query without tonos matches 'Αριθμός'
    expect(ids('φορολογια')).toEqual(['a']);
    expect(ids('cafe')).toEqual(['c']);
    expect(ids('residence')).toEqual(['c']);
    expect(ids('CAFÉ')).toEqual(['c']);
  });

  it('never matches a secret value', () => {
    expect(ids('sup3rs3cret')).toEqual([]);
    expect(ids('latte')).toEqual([]);
    expect(ids('s3cret')).toEqual([]);
    // but the secret field's label is still searchable
    expect(ids('password')).toEqual(['b', 'c']);
  });

  it('normalizeForSearch strips combining marks and lowercases', () => {
    expect(normalizeForSearch('Άλφα')).toBe('αλφα');
    expect(normalizeForSearch('Crème Brûlée')).toBe('creme brulee');
  });
});

describe('sortRecords', () => {
  const records: VaultRecord[] = [
    makeRecord({ id: 'b', title: 'banana', updatedAt: '2026-02-01T00:00:00.000Z' }),
    makeRecord({ id: 'p1', title: 'zeta', pinned: true, updatedAt: '2026-01-01T00:00:00.000Z' }),
    makeRecord({ id: 'a', title: 'Apple', updatedAt: '2026-03-01T00:00:00.000Z' }),
    makeRecord({ id: 'p2', title: 'Alpha', pinned: true, updatedAt: '2026-01-15T00:00:00.000Z' }),
    makeRecord({ id: 'c', title: 'cherry', updatedAt: '2026-02-15T00:00:00.000Z' }),
  ];
  const ids = (rs: VaultRecord[]) => rs.map((r) => r.id);

  it('lastUsed: pinned first, then updatedAt descending', () => {
    expect(ids(sortRecords(records, 'lastUsed'))).toEqual(['p2', 'p1', 'a', 'c', 'b']);
  });

  it('az: pinned first, then case-insensitive title order', () => {
    expect(ids(sortRecords(records, 'az'))).toEqual(['p2', 'p1', 'a', 'b', 'c']);
  });

  it('az ignores accents at base sensitivity', () => {
    const rs = [makeRecord({ id: '1', title: 'éclair' }), makeRecord({ id: '2', title: 'Eagle' }), makeRecord({ id: '3', title: 'ébène' })];
    expect(ids(sortRecords(rs, 'az'))).toEqual(['2', '3', '1']);
  });

  it('is stable for equal keys', () => {
    const same = [
      makeRecord({ id: 'x', title: 'same', updatedAt: '2026-01-01T00:00:00.000Z' }),
      makeRecord({ id: 'y', title: 'Same', updatedAt: '2026-01-01T00:00:00.000Z' }),
      makeRecord({ id: 'z', title: 'SAME', updatedAt: '2026-01-01T00:00:00.000Z' }),
    ];
    expect(ids(sortRecords(same, 'az'))).toEqual(['x', 'y', 'z']);
    expect(ids(sortRecords(same, 'lastUsed'))).toEqual(['x', 'y', 'z']);
  });

  it('does not mutate the input', () => {
    const before = ids(records);
    const sorted = sortRecords(records, 'az');
    expect(ids(records)).toEqual(before);
    expect(sorted).not.toBe(records);
  });
});

describe('touchRecord', () => {
  it('returns a copy with only updatedAt changed', () => {
    const record = makeRecord();
    const touched = touchRecord(record, '2026-12-31T23:59:59.000Z');
    expect(touched).not.toBe(record);
    expect(touched).toEqual({ ...record, updatedAt: '2026-12-31T23:59:59.000Z' });
    expect(record.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('serializedSize', () => {
  it('equals the UTF-8 byte length of the JSON', () => {
    const record = makeRecord();
    expect(serializedSize(record)).toBe(utf8Bytes(JSON.stringify(record)));
  });

  it('counts multi-byte characters by bytes, not code units', () => {
    const ascii = makeRecord({ title: 'aaaa' });
    const greek = makeRecord({ title: 'αααα' }); // 2 bytes each
    const emoji = makeRecord({ title: '😀😀' }); // 4 bytes each, 2 UTF-16 units each
    expect(serializedSize(greek) - serializedSize(ascii)).toBe(4);
    expect(serializedSize(emoji) - serializedSize(ascii)).toBe(4);
    expect(serializedSize(emoji)).toBe(utf8Bytes(JSON.stringify(emoji)));
  });

  it('exposes a 64 KiB cap', () => {
    expect(MAX_RECORD_BYTES).toBe(65536);
    const big = makeRecord({ fields: [f('Content', 'multiline', 'x'.repeat(MAX_RECORD_BYTES))] });
    expect(serializedSize(big)).toBeGreaterThan(MAX_RECORD_BYTES);
    expect(serializedSize(makeRecord())).toBeLessThan(MAX_RECORD_BYTES);
  });
});
