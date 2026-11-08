// Pure geometry for the VaultDoor SVG: everything is laid out in a 260x260
// viewBox around CENTER. Angles are degrees clockwise from 12 o'clock, so
// `polar(r, 0)` is straight up — the same frame react-native-svg's
// `rotation` prop uses when a group is rotated about the centre.

export const VIEWBOX = 260;
export const CENTER = VIEWBOX / 2;

export interface Point {
  x: number;
  y: number;
}

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

const round = (n: number): number => Math.round(n * 1000) / 1000;

/** Point at radius `r` and angle `deg` (clockwise from the top) around the centre. */
export const polar = (r: number, deg: number): Point => ({
  x: round(CENTER + r * Math.sin(toRadians(deg))),
  y: round(CENTER - r * Math.cos(toRadians(deg))),
});

/** `count` evenly spaced angles starting at `offset`, in [0, 360). */
export const angles = (count: number, offset = 0): number[] =>
  Array.from({ length: count }, (_, i) => (offset + (360 / count) * i) % 360);

export const TICK_ANGLES = angles(12);
export const BOLT_ANGLES = angles(8);
export const RIVET_ANGLES = angles(12, 15);
export const SPOKE_ANGLES = angles(5);
export const HUB_DOT_ANGLES = angles(5, 36);

export const RING_RADIUS = 122;
export const TICK_INNER = 108;
export const TICK_OUTER = 114;
export const DOOR_RADIUS = 100;
export const RIVET_RADIUS = 88;
export const HUB_DOT_RADIUS = 19.5;

/** Bolt rectangle, drawn at 12 o'clock and rotated per BOLT_ANGLES. */
export const BOLT = { width: 12, height: 18, rx: 3, x: CENTER - 6, y: 14 } as const;
/** How far (viewBox units) a bolt retracts toward the centre on unlock. */
export const BOLT_TRAVEL = 14;

/** Degrees the wheel turns during the unlock sequence. */
export const WHEEL_TURNS_DEG = 540;

/** Dial-ring dash pattern: 1.6 on, 10.966 off (≈ 40 dashes around r80). */
export const DIAL_DASH = '1.6 10.966';
