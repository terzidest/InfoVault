import * as SecureStore from 'expo-secure-store';
import { tokens } from '../tokens';
import type { Tokens } from '../tokens';
import { resolveScheme } from '../ThemeProvider';
import useSettingsStore, { migrateStoredSettings, SETTINGS_VERSION } from '../../store/settingsStore';

const secureStoreMock = SecureStore as unknown as {
  __store: Map<string, string>;
  __reset: () => void;
};

// ---------------------------------------------------------------------------
// Pure color helpers (WCAG 2.x relative luminance + alpha compositing)
// ---------------------------------------------------------------------------

type Rgba = { r: number; g: number; b: number; a: number };

const parseColor = (value: string): Rgba => {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value);
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  throw new Error(`Unparseable color: ${value}`);
};

// Source-over compositing of a (possibly translucent) foreground onto an
// opaque background.
const composite = (fg: Rgba, bg: Rgba): Rgba => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }: Rgba): number => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

const contrast = (fg: string, bg: string): number => {
  const b = parseColor(bg);
  if (b.a !== 1) throw new Error('background must be opaque');
  const f = composite(parseColor(fg), b);
  const l1 = luminance(f);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

const opaque = (c: Rgba): string => `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;

const keyPaths = (value: unknown, prefix = ''): string[] => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
};

// ---------------------------------------------------------------------------

describe('tokens', () => {
  it('both schemes define the same key set', () => {
    expect(keyPaths(tokens.dark)).toEqual(keyPaths(tokens.light));
  });

  it('color helpers are sane', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(opaque(composite(parseColor('rgba(255,255,255,0.5)'), parseColor('#000000')))).toBe('rgb(128,128,128)');
  });

  describe.each<[string, Tokens]>([
    ['dark', tokens.dark],
    ['light', tokens.light],
  ])('%s scheme contrast (WCAG AA 4.5:1)', (_name, t) => {
    const { background, surface, text, muted } = t.colors;
    const surfaceOnBackground = opaque(composite(parseColor(surface), parseColor(background)));

    it('text on background', () => {
      expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
    });
    it('text on surface over background', () => {
      expect(contrast(text, surfaceOnBackground)).toBeGreaterThanOrEqual(4.5);
    });
    it('muted on background', () => {
      expect(contrast(muted, background)).toBeGreaterThanOrEqual(4.5);
    });
    // The design's light amberText (#9A6A00) measured 3.77:1 here; the token
    // was darkened to #7F5700 to pass. Revealed secrets and warnings use it.
    it('amberText on background', () => {
      expect(contrast(t.colors.amberText, background)).toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe('resolveScheme', () => {
  it('follows the OS when mode is system', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
  });
  it('falls back to light when the OS reports nothing', () => {
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('system', undefined)).toBe('light');
  });
  it('a pinned mode wins over the OS', () => {
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
  });
});

describe('settingsStore theme migration', () => {
  beforeEach(() => {
    secureStoreMock.__reset();
    useSettingsStore.setState({
      settings: { version: SETTINGS_VERSION, theme: 'system', autoLockTimeout: 300000, maskSensitiveData: true, sortMode: 'lastUsed' },
      isLoading: false,
      error: null,
    });
  });

  it("reads a stored v1 'light' (the never-chosen default) as 'system' and stamps the blob once", async () => {
    secureStoreMock.__store.set(
      'appSettings',
      JSON.stringify({ theme: 'light', autoLockTimeout: 60000, maskSensitiveData: false })
    );
    const settings = await useSettingsStore.getState().initSettings();
    expect(settings.theme).toBe('system');
    expect(settings.autoLockTimeout).toBe(60000);
    expect(settings.maskSensitiveData).toBe(false);

    const persisted = JSON.parse(secureStoreMock.__store.get('appSettings') ?? '{}') as Record<string, unknown>;
    expect(persisted.version).toBe(SETTINGS_VERSION);
    expect(persisted.theme).toBe('system');
  });

  it("keeps a stored v1 'dark'", async () => {
    secureStoreMock.__store.set('appSettings', JSON.stringify({ theme: 'dark' }));
    const settings = await useSettingsStore.getState().initSettings();
    expect(settings.theme).toBe('dark');
  });

  it("keeps a v2 user-chosen 'light'", async () => {
    secureStoreMock.__store.set('appSettings', JSON.stringify({ version: SETTINGS_VERSION, theme: 'light' }));
    const settings = await useSettingsStore.getState().initSettings();
    expect(settings.theme).toBe('light');
  });

  it('migrateStoredSettings is pure and fills defaults', () => {
    expect(migrateStoredSettings({})).toEqual({
      version: SETTINGS_VERSION,
      theme: 'system',
      autoLockTimeout: 300000,
      maskSensitiveData: true,
      sortMode: 'lastUsed',
    });
    expect(migrateStoredSettings({ theme: 'light' }).theme).toBe('system');
    expect(migrateStoredSettings({ version: SETTINGS_VERSION, theme: 'light' }).theme).toBe('light');
  });

  it('writes defaults when nothing is stored', async () => {
    const settings = await useSettingsStore.getState().initSettings();
    expect(settings.theme).toBe('system');
    expect(secureStoreMock.__store.get('appSettings')).toBeDefined();
  });
});
