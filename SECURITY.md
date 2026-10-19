# Security Model — InfoVault

InfoVault is a local-first manager for sensitive personal information: account credentials, identity documents, and private notes. This document describes what InfoVault protects, what it deliberately does not, and the cryptographic decisions behind it. It is written to be honest about its limits — a security control you misunderstand is worse than one you don't have.

## Design principle

**Local-first, zero-exfiltration.** All data is stored on the device. Nothing is transmitted to a server, there is no account, no sync, no telemetry, and no analytics. The network is not part of the trusted (or attacked) surface because the app does not use it for user data.

## What InfoVault protects against

- **Casual access to an unlocked device.** Sensitive fields are masked by default in the UI and require an explicit reveal, which auto-hides after a short timeout.
- **Screenshots, screen recording, and app-switcher snapshots.** While the vault is unlocked, screen capture is blocked (`FLAG_SECURE` on Android; capture/recording protection on iOS), and an opaque overlay covers the UI whenever the app leaves the foreground so OS task-switcher snapshots never contain vault content. Capture by a compromised OS remains out of scope (below).
- **Loss or theft of a device with the vault locked.** Records are stored as AES-256-GCM ciphertext. Without the vault key — which is stored only wrapped under a key derived from the user's master password — the stored data is opaque. An attacker with the raw storage contents sees ciphertext and the vault header (KDF parameters, salt, wrapped key), none of which reveal the data or the password without a successful password guess.
- **Reading raw storage.** Even with full read access to the app's `SecureStore` entries (e.g. via a backup or forensic dump on a non-hardened device), records cannot be decrypted without the master password.
- **Idle exposure.** An auto-lock timeout locks the vault after inactivity — evaluated continuously while the app is foregrounded and again when it returns from the background — clearing the in-memory key and decrypted records and requiring re-authentication.

## What InfoVault does NOT protect against

Stated plainly so there are no false assumptions:

- **A compromised operating system or rooted/jailbroken device.** If the OS is compromised, the platform keystore guarantees no longer hold and an attacker may observe the app's memory or inputs.
- **Malware running with the ability to read this app's process memory while the vault is unlocked.** Once unlocked, the encryption key is held in memory; anything that can read that memory can read the key. This is an inherent property of any app that decrypts data for display.
- **A weak master password.** Encryption strength is bounded by the password's entropy. A guessable master password can be brute-forced; see the KDF note below for how much friction the derivation adds.
- **Keyloggers, or screen capture by a privileged/compromised OS.** In-app capture blocking stops ordinary screenshots and recordings, but capturing the master password as it is typed, or capture performed by the OS itself (or anything running with system privileges), is outside the app's control.
- **Physical coercion** to unlock, and **shoulder-surfing** of revealed values.
- **Clipboard exposure.** Copying a value to the clipboard hands it to the OS clipboard, which other apps may read. The app clears its own copies after 30 seconds, but during that window (and on OSes with clipboard history/sync) exposure is possible. Copy is offered as a convenience; minimize its use for the most sensitive fields.

## Cryptographic design

### Encryption
- **Algorithm:** AES-256-GCM (authenticated encryption) via [`@noble/ciphers`](https://github.com/paulmillr/noble-ciphers) — an audited, dependency-free, pure-TypeScript implementation. NIST-recommended defaults (96-bit nonce, 128-bit authentication tag). A pure-JS library was chosen over `expo-crypto`'s native AES because that API requires Expo SDK 55+, while this app targets SDK 52; noble delivers the same algorithm with no native module and no multi-version SDK upgrade.
- **Granularity:** whole-record encryption. The entire record is serialized and encrypted as one unit, so no field-level metadata (titles, dates, types) is left in plaintext. Search operates over records *after* they are decrypted into memory, so encryption does not impair it.
- **Authentication:** the GCM tag detects tampering; a modified ciphertext fails to decrypt rather than returning corrupted data.

### Key hierarchy
- **Vault key:** a random 256-bit key (from `expo-crypto`) encrypts every record. It never changes when the password or KDF changes.
- **Wrapping key:** derived from the master password and a random salt. It encrypts only the vault key (AES-256-GCM, with associated data that separates it from record encryption).
- **Vault header:** a single `SecureStore` entry holding the format version, the KDF algorithm and parameters, the salt, and the wrapped vault key. It is written in one call, so it is never half-updated. None of it is secret.
- **Password check:** unwrapping the vault key is the password check. A wrong password fails the GCM tag, so no separate verifier is stored.
- **Why this shape:** raising the KDF cost, switching KDF, or (later) changing the master password re-wraps 32 bytes instead of re-encrypting every record. When a vault's stored KDF parameters are older than the app's current ones, the vault key is re-wrapped automatically on the next password unlock.

### Key derivation
- **Current:** **PBKDF2-SHA256 at 100,000 iterations** (via [`@noble/hashes`](https://github.com/paulmillr/noble-hashes)). The salt defeats precomputed (rainbow-table) attacks; the iteration count adds work to each guess.
- **Known limitation:** PBKDF2 is not memory-hard, so it is more vulnerable to GPU/ASIC-accelerated offline cracking than a memory-hard function. 100k iterations is also below OWASP's current PBKDF2-SHA256 recommendation (600k), which is too slow for pure JS on Hermes, the JS engine without a JIT that the app runs on.
- **Upgrade path:** `deriveKey` already supports **Argon2id** (memory-hard, OWASP's first choice; minimum 19 MiB, 2 passes, parallelism 1), and the header format records it. Making it the default is a change to `CURRENT_KDF` in `utils/crypto.ts`. It waits on measuring unlock latency on a low-end device: if pure-JS Argon2id is too slow on Hermes, a native implementation comes first.

### Migration from the pre-header format
Vaults created before the header existed stored a salt and a verifier, and used the PBKDF2-derived key directly for records. On the first successful password unlock after upgrading, that derived key becomes the vault key and is wrapped under a fresh key, derived with a new salt. The old salt and verifier are then deleted. Records and the biometric keystore copy stay valid with no re-encryption. Until the header is written, the old entries still open the vault, so an interrupted migration simply retries. Tradeoff: for these migrated vaults the vault key is password-derived rather than random. That is harmless once the old salt is gone, because the key is only useful to an attacker who can brute-force a 256-bit value. A future change-password flow can rotate to a fresh random key.

### Key handling
- The vault key exists **in memory only** during an unlocked session. The wrapping key is zeroed as soon as the vault key is unwrapped.
- Neither is **ever** written to storage in plaintext, logged, or placed in AsyncStorage or any persisted state slice. The vault key is persisted only in wrapped form.
- For biometric convenience unlock, a copy of the vault key may be stored in the platform keystore (`SecureStore`) gated behind the OS biometric prompt — so it is released only on a successful biometric check.
- The master password itself is never stored, nor is any hash of it. It is checked by unwrapping the vault key (see Key hierarchy).
- On logout and on auto-lock, the in-memory key bytes are zeroed and the reference dropped, and all decrypted records are evicted from in-memory state — locking leaves no plaintext behind.

### Randomness
All security-relevant randomness (salts, identifiers, GCM nonces) comes from `expo-crypto` (`getRandomBytesAsync` / `randomUUID`), a CSPRNG backed by the platform. `Math.random()` is never used for security purposes, and `@noble`'s own `randomBytes` is deliberately avoided because it relies on WebCrypto, which is absent in the React Native (Hermes) runtime.

## Storage

`expo-secure-store` is the persistence layer, backed by the iOS Keychain and Android Keystore. InfoVault layers its own application-level AES-GCM encryption on top of this, so the data is protected both by the platform keystore and by the master-password-derived key — meaning raw access to keystore contents alone does not yield plaintext.

## Reporting

This is a portfolio / personal project. If you find an issue, open an issue in the repository. Please do not include real sensitive data in any report.

---

*Last reviewed: 2026-10-19. Keep this date current when the crypto layer changes. This document and the README's security section must stay in sync with the actual implementation — if the code's behavior changes, update both in the same change.*
