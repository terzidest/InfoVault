# Security Model — InfoVault

InfoVault is a local-first manager for sensitive personal information: logins, identification numbers and documents, SIM and card details, Wi‑Fi passwords, private notes. This document describes what InfoVault protects, what it deliberately does not, and the cryptographic decisions behind it. It is written to be honest about its limits — a security control you misunderstand is worse than one you don't have.

## Design principle

**Local-first, zero-exfiltration.** All data is stored on the device. Nothing is transmitted to a server, there is no account, no sync, no telemetry, and no analytics. The network is not part of the trusted (or attacked) surface because the app does not use it for user data.

## What InfoVault protects against

- **Casual access to an unlocked device.** Sensitive fields are masked by default in the UI and require an explicit reveal, which auto-hides after a short timeout.
- **Screenshots, screen recording, and app-switcher snapshots.** While the vault is unlocked, screen capture is blocked (`FLAG_SECURE` on Android; capture/recording protection on iOS), and an opaque overlay covers the UI whenever the app leaves the foreground so OS task-switcher snapshots never contain vault content. Capture by a compromised OS remains out of scope (below).
- **Loss or theft of a device with the vault locked.** The record set is stored as one AES-256-GCM ciphertext. Without the vault key — which is stored only wrapped under a key derived from the user's master password — the stored data is opaque. An attacker with the raw storage contents sees ciphertext and the vault header (KDF parameters, salt, wrapped key), none of which reveal the data or the password without a successful password guess.
- **Reading raw storage.** Even with full read access to the app's files and `SecureStore` entries (e.g. via a backup or forensic dump on a non-hardened device), records cannot be decrypted without the master password.
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
- **Granularity:** whole-vault encryption. Every record is serialized into one JSON payload and sealed as a single blob, so no metadata (titles, labels, templates, tags, timestamps, even the record count) is left in plaintext. Search operates over records *after* they are decrypted into memory, so encryption does not impair it; secret-kind values are excluded from search so a hit cannot confirm one.
- **Authentication:** the GCM tag detects tampering; a modified ciphertext fails to decrypt rather than returning corrupted data.

### Key hierarchy
- **Vault key:** a random 256-bit key (from `expo-crypto`) encrypts every record. It never changes when the password or KDF changes.
- **Wrapping key:** derived from the master password and a random salt. It encrypts only the vault key (AES-256-GCM, with associated data that separates it from record encryption).
- **Vault header:** a single `SecureStore` entry holding the format version, the KDF algorithm and parameters, the salt, and the wrapped vault key. It is written in one call, so it is never half-updated. None of it is secret. The sealed file itself carries no key material.
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
- On logout and on auto-lock, the in-memory key bytes are zeroed and the reference dropped, and all decrypted records are evicted from in-memory state — locking leaves no plaintext behind. A session is marked unlocked only after the vault file has been opened under the key; if the file cannot be opened the key is zeroed again and the app stays locked with a neutral error.

### Randomness
All security-relevant randomness (salts, identifiers, GCM nonces) comes from `expo-crypto` (`getRandomBytesAsync` / `randomUUID`), a CSPRNG backed by the platform. `Math.random()` is never used for security purposes, and `@noble`'s own `randomBytes` is deliberately avoided because it relies on WebCrypto, which is absent in the React Native (Hermes) runtime.

## Storage

Two places, split by what each is for. Records never touch SecureStore, and SecureStore never holds record data.

| Where | What | Protection |
| --- | --- | --- |
| `SecureStore` entry `vaultHeader` | KDF algorithm and parameters, salt, the wrapped vault key | Platform keystore (iOS Keychain / Android Keystore); not secret, readable before unlock |
| `SecureStore` entry `vaultBiometricKey` (optional) | A copy of the vault key, released only after the OS biometric prompt | Auth-gated keystore entry |
| `vault.bin` in the app's document directory | Every record, serialized as one JSON payload and sealed as a single AES-256-GCM blob under the vault key | Application-level AES-256-GCM; copying the file off the device yields ciphertext only |

The vault file is a small binary container (`utils/vaultFormat.ts`): a magic number and format version, a short plaintext JSON header, a fresh 96-bit nonce per write, and the ciphertext with its GCM tag. The header is passed to GCM as associated data, so it is authenticated even though it is not encrypted — editing it fails decryption. Writes (`services/vaultFile.ts`) are serialized and lock-checked (a vault that locked while sealing is never written): every change seals the full record set, writes it to a temporary file, moves the current `vault.bin` aside as `vault.bin.bak`, moves the new file into place and then drops the backup. An interruption at any point leaves a complete, decodable file on disk, and the next read or write restores the last *acknowledged* vault: `vault.bin`, or `vault.bin.bak` when the primary is missing or undecodable and the backup decodes. The temporary file is never treated as the vault, since the change it holds was reported to its caller as failed. Each record is capped at 64 KB before it is sealed, so a single oversized record cannot make the file unwritable. The same container, with a header carrying the KDF parameters, salt and wrapped key, is the planned export format.

**Fresh install vs. corrupt vault.** iOS keeps Keychain entries across an uninstall but not the document directory. At startup, key material in SecureStore (the header, or a pre-header salt, or the setup flag) with no vault file (not even a `.bak`) and no v1 record entries is treated as a reinstall or an interrupted setup: the header, legacy entries, biometric copy and setup flag are cleared and setup runs. A storage read error during that check never routes to setup. Setup itself removes any stale vault file before writing the new, empty one, so a file sealed under a key nobody holds can never block later unlocks.

**Device backups.** On iOS, `vault.bin` lives in the app's Documents directory and may be included in iCloud and Finder backups. That is deliberate: the file is ciphertext under a key that is never backed up in plaintext (the header holds it only wrapped under the password-derived key; the biometric copy is a device-only keystore entry that does not transfer), so a backup exposes nothing — and it is what lets a device restore bring the vault back together with the Keychain header. On Android the app opts out of backups entirely (`allowBackup=false`), so the vault file never leaves the device.

### Migration from v1 (pre-2.0)

v1 used SecureStore as the record store: one entry per record, each sealed with AES-256-GCM under the vault key, plus a JSON id registry per type (`credentialKeys`, `noteKeys`, `personalInfoKeys`). That layout cost a ~2 KB cap per value and non-atomic record-plus-registry writes, and the keystore's own encryption added nothing on top of the application cipher. `services/legacyVault.ts` is the only code that still spells those names.

v1 records are migrated on the first unlock after the update (`services/migrateV1.ts`), and on every unlock after that until nothing v1 is left: each entry is decrypted with the vault key, its fields normalized, mapped to a v2 record (Credential → Login, PersonalInfo → ID document or ID number, Note → Note with its category as a tag), checked against the record schema and written to `vault.bin`; only after that write succeeds are the v1 entries deleted. An entry that cannot be decrypted or converted is left in place (its registry keeps listing it) and a registry that cannot be parsed is left untouched with everything it names, so both are retried on later unlocks. Cleanup after a successful write is best-effort; anything it misses is migrated again, except that a record the user has since deleted in v2 is recognised (the vault remembers every migrated v1 id) and is not resurrected. An unexpected failure before the write (a storage read failing) aborts the pass with nothing deleted, and the app still opens the existing vault. A biometric-first unlock migrates the records too, since the biometric copy is the vault key; the header migration described above still waits for a password unlock.

## Reporting

This is a portfolio / personal project. If you find an issue, open an issue in the repository. Please do not include real sensitive data in any report.

---

*Last reviewed: 2026-11-08. Keep this date current when the crypto layer changes. This document and the README's security section must stay in sync with the actual implementation — if the code's behavior changes, update both in the same change.*
