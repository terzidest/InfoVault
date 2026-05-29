# Security Model — InfoVault

InfoVault is a local-first manager for sensitive personal information: account credentials, identity documents, and private notes. This document describes what InfoVault protects, what it deliberately does not, and the cryptographic decisions behind it. It is written to be honest about its limits — a security control you misunderstand is worse than one you don't have.

## Design principle

**Local-first, zero-exfiltration.** All data is stored on the device. Nothing is transmitted to a server, there is no account, no sync, no telemetry, and no analytics. The network is not part of the trusted (or attacked) surface because the app does not use it for user data.

## What InfoVault protects against

- **Casual access to an unlocked device.** Sensitive fields are masked by default in the UI and require an explicit reveal, which auto-hides after a short timeout.
- **Loss or theft of a device with the vault locked.** Records are stored as AES-256-GCM ciphertext. Without the key — which is derived from the user's master password and is not stored in plaintext — the stored data is opaque. An attacker with the raw storage contents sees ciphertext, salt, and a verifier, none of which reveal the data or the password.
- **Reading raw storage.** Even with full read access to the app's `SecureStore` entries (e.g. via a backup or forensic dump on a non-hardened device), records cannot be decrypted without the master password.
- **Idle exposure.** An auto-lock timeout clears the in-memory key after inactivity, returning the app to a locked state that requires re-authentication.

## What InfoVault does NOT protect against

Stated plainly so there are no false assumptions:

- **A compromised operating system or rooted/jailbroken device.** If the OS is compromised, the platform keystore guarantees no longer hold and an attacker may observe the app's memory or inputs.
- **Malware running with the ability to read this app's process memory while the vault is unlocked.** Once unlocked, the encryption key is held in memory; anything that can read that memory can read the key. This is an inherent property of any app that decrypts data for display.
- **A weak master password.** Encryption strength is bounded by the password's entropy. A guessable master password can be brute-forced; see the KDF note below for how much friction the derivation adds.
- **Keyloggers or screen capture.** Capturing the master password as it is typed, or screenshotting revealed data, is outside the app's control.
- **Physical coercion** to unlock, and **shoulder-surfing** of revealed values.
- **Clipboard exposure.** Copying a value to the clipboard hands it to the OS clipboard, which other apps may read. Copy is offered as a convenience; minimize its use for the most sensitive fields.

## Cryptographic design

### Encryption
- **Algorithm:** AES-256-GCM (authenticated encryption) via [`@noble/ciphers`](https://github.com/paulmillr/noble-ciphers) — an audited, dependency-free, pure-TypeScript implementation. NIST-recommended defaults (96-bit nonce, 128-bit authentication tag). A pure-JS library was chosen over `expo-crypto`'s native AES because that API requires Expo SDK 55+, while this app targets SDK 52; noble delivers the same algorithm with no native module and no multi-version SDK upgrade.
- **Granularity:** whole-record encryption. The entire record is serialized and encrypted as one unit, so no field-level metadata (titles, dates, types) is left in plaintext. Search operates over records *after* they are decrypted into memory, so encryption does not impair it.
- **Authentication:** the GCM tag detects tampering; a modified ciphertext fails to decrypt rather than returning corrupted data.

### Key derivation
- **Current:** the AES-256 key is derived from the master password and a per-install random salt using **PBKDF2-SHA256 at 100,000 iterations** (via [`@noble/hashes`](https://github.com/paulmillr/noble-hashes)). The salt defeats precomputed (rainbow-table) attacks; the iteration count adds work to each guess.
- **Known limitation:** PBKDF2 is not memory-hard, so it is more vulnerable to GPU/ASIC-accelerated offline cracking than a memory-hard function. The iteration count is also a latency/security tradeoff tuned for acceptable unlock time in pure JS.
- **Upgrade path:** the derivation is isolated in `utils/crypto.ts` behind a single `deriveKey` function. Replacing it with **Argon2id** (memory-hard, current best practice — also available in `@noble/hashes`) hardens the vault against offline brute-force without changing the rest of the system.

### Key handling
- The derived key exists **in memory only** during an unlocked session.
- It is **never** written to storage in plaintext, never logged, never placed in AsyncStorage or any persisted state slice.
- For biometric convenience unlock, a copy of the key may be stored in the platform keystore (`SecureStore`) gated behind the OS biometric prompt — so it is released only on a successful biometric check.
- The master password itself is never stored. Correctness is checked against a **verifier** (a known sentinel value encrypted under the derived key); decrypting the sentinel confirms the password without storing it or a recoverable hash of it.
- On logout and on auto-lock, the in-memory key is cleared.

### Randomness
All security-relevant randomness (salts, identifiers, GCM nonces) comes from `expo-crypto` (`getRandomBytesAsync` / `randomUUID`), a CSPRNG backed by the platform. `Math.random()` is never used for security purposes, and `@noble`'s own `randomBytes` is deliberately avoided because it relies on WebCrypto, which is absent in the React Native (Hermes) runtime.

## Storage

`expo-secure-store` is the persistence layer, backed by the iOS Keychain and Android Keystore. InfoVault layers its own application-level AES-GCM encryption on top of this, so the data is protected both by the platform keystore and by the master-password-derived key — meaning raw access to keystore contents alone does not yield plaintext.

## Reporting

This is a portfolio / personal project. If you find an issue, open an issue in the repository. Please do not include real sensitive data in any report.

---

*Last reviewed: keep this date current when the crypto layer changes. This document and the README's security section must stay in sync with the actual implementation — if the code's behavior changes, update both in the same change.*
