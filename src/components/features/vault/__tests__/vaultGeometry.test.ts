import {
  BOLT,
  BOLT_ANGLES,
  BOLT_TRAVEL,
  CENTER,
  HUB_DOT_ANGLES,
  RIVET_ANGLES,
  SPOKE_ANGLES,
  TICK_ANGLES,
  angles,
  polar,
} from '../vaultGeometry';

describe('polar', () => {
  it('puts 0° straight above the centre', () => {
    expect(polar(100, 0)).toEqual({ x: CENTER, y: CENTER - 100 });
  });

  it('goes clockwise: 90° is to the right, 180° below, 270° to the left', () => {
    expect(polar(50, 90)).toEqual({ x: CENTER + 50, y: CENTER });
    expect(polar(50, 180)).toEqual({ x: CENTER, y: CENTER + 50 });
    expect(polar(50, 270)).toEqual({ x: CENTER - 50, y: CENTER });
  });

  it('keeps every point at the requested radius', () => {
    for (const deg of [15, 36, 123, 200, 359]) {
      const { x, y } = polar(88, deg);
      expect(Math.hypot(x - CENTER, y - CENTER)).toBeCloseTo(88, 2);
    }
  });

  it('rounds to three decimals so SVG attribute strings stay short', () => {
    const { x, y } = polar(19.5, 36);
    expect(x).toBe(Math.round(x * 1000) / 1000);
    expect(y).toBe(Math.round(y * 1000) / 1000);
  });
});

describe('angles', () => {
  it('spaces evenly from the offset and wraps into [0, 360)', () => {
    expect(angles(4)).toEqual([0, 90, 180, 270]);
    expect(angles(4, 45)).toEqual([45, 135, 225, 315]);
    expect(angles(2, 270)).toEqual([270, 90]);
  });

  it('returns no angles for zero count', () => {
    expect(angles(0)).toEqual([]);
  });
});

describe('design angle lists', () => {
  it('ticks: 12 every 30°', () => {
    expect(TICK_ANGLES).toHaveLength(12);
    expect(TICK_ANGLES[1]).toBe(30);
  });

  it('bolts: 8 every 45°, first at the top', () => {
    expect(BOLT_ANGLES).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
  });

  it('rivets: 12 every 30°, offset 15° so they sit between the ticks', () => {
    expect(RIVET_ANGLES).toHaveLength(12);
    expect(RIVET_ANGLES[0]).toBe(15);
    for (const a of RIVET_ANGLES) expect(TICK_ANGLES).not.toContain(a);
  });

  it('spokes: 5 every 72°; hub dots offset by half a spoke', () => {
    expect(SPOKE_ANGLES).toEqual([0, 72, 144, 216, 288]);
    expect(HUB_DOT_ANGLES).toEqual([36, 108, 180, 252, 324]);
  });
});

describe('bolt', () => {
  it('is centred on the vertical axis and spans radius 98→116 at rest', () => {
    expect(BOLT.x + BOLT.width / 2).toBe(CENTER);
    expect(CENTER - (BOLT.y + BOLT.height)).toBe(98);
    expect(CENTER - BOLT.y).toBe(116);
  });

  it('retracts fully inside the door disc (r100) when unlocked', () => {
    const outerEdge = CENTER - (BOLT.y + BOLT_TRAVEL);
    expect(outerEdge).toBeLessThanOrEqual(102);
    expect(outerEdge).toBeGreaterThan(98);
  });
});
