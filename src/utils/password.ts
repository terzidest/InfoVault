import * as Crypto from 'expo-crypto';

// Password generation. Randomness comes exclusively from expo-crypto (a CSPRNG)
// — never Math.random, never @noble's randomBytes (WebCrypto, absent in Hermes).

export interface PasswordOptions {
  upper?: boolean;
  lower?: boolean;
  digits?: boolean;
  symbols?: boolean;
}

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?';

/**
 * A stream of cryptographically random, unbiased integers in [0, max).
 * Uses rejection sampling over single random bytes so there is no modulo bias,
 * refilling the byte buffer from expo-crypto as needed.
 */
class UnbiasedRandom {
  private buffer: Uint8Array = new Uint8Array(0);
  private offset = 0;

  constructor(private readonly batchSize: number) {}

  private async nextByte(): Promise<number> {
    if (this.offset >= this.buffer.length) {
      this.buffer = await Crypto.getRandomBytesAsync(Math.max(this.batchSize, 1));
      this.offset = 0;
    }
    const byte = this.buffer[this.offset];
    this.offset += 1;
    return byte ?? 0;
  }

  async nextInt(max: number): Promise<number> {
    if (max <= 0) return 0;
    const limit = 256 - (256 % max); // largest multiple of max that fits in a byte
    // Reject bytes in the biased tail [limit, 256) and draw again.
    let byte = await this.nextByte();
    while (byte >= limit) {
      byte = await this.nextByte();
    }
    return byte % max;
  }
}

/**
 * Generate a random password.
 * Guarantees at least one character from each enabled class, then fills the rest
 * from the combined charset and shuffles so the guaranteed characters are not
 * clustered at the front.
 */
export const generatePassword = async (
  length = 16,
  options: PasswordOptions = {}
): Promise<string> => {
  const { upper = true, lower = true, digits = true, symbols = true } = options;

  const pools: string[] = [];
  if (upper) pools.push(UPPER);
  if (lower) pools.push(LOWER);
  if (digits) pools.push(DIGITS);
  if (symbols) pools.push(SYMBOLS);
  if (pools.length === 0) pools.push(LOWER); // never return an empty password

  const charset = pools.join('');
  const targetLength = Math.max(length, pools.length); // room for one of each class

  const rng = new UnbiasedRandom(targetLength * 2);
  const chars: string[] = [];

  // One character from each enabled pool first (coverage guarantee).
  for (const pool of pools) {
    chars.push(pool.charAt(await rng.nextInt(pool.length)));
  }

  // Fill the remainder from the whole charset.
  while (chars.length < targetLength) {
    chars.push(charset.charAt(await rng.nextInt(charset.length)));
  }

  // Fisher–Yates shuffle so the guaranteed chars are not always at the start.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = await rng.nextInt(i + 1);
    const tmp = chars[i] as string;
    chars[i] = chars[j] as string;
    chars[j] = tmp;
  }

  return chars.join('');
};
