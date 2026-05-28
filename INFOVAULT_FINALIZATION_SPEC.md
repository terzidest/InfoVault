# InfoVault — Finalization Spec & Checklist

**Goal:** Take InfoVault from a strong-architecture MVP to a polished, shippable portfolio app — with a *real* encryption layer that matches its own README claims.

**Decisions locked in:**
- Encryption layer: real AES-256-GCM via native `expo-crypto` (merged into Expo Jan 2026).
- Key derivation: **iterated SHA-256** (stretched ~5k rounds) via `expo-crypto`, salted. PBKDF2/Argon2 documented as the production upgrade path. *Rationale: no extra dependency, still defensible in interview, signals awareness of the tradeoff rather than ignorance of it.*
- Encryption granularity: **whole record**. Search still works because it runs over already-decrypted in-memory data in the Zustand stores. Leaks no field-level metadata.
- Master password + biometric convenience unlock (real password-manager pattern).

**Effort estimate:** ~4–6 focused days. Phases 0–1 are the portfolio-critical core; 2–3 make it shippable.

---

## Current State Audit (what's actually wrong)

### Critical (credibility / security)
1. **`encryption.ts` does no encryption.** Contains `obfuscateText` (visual masking), `simpleHash` (non-crypto), `generateSecureId` (uses `Math.random`). README claims "Local device encryption." SecureStore *does* encrypt at rest, but the file naming + `Math.random`-in-a-"secure"-function is an interview red flag.
2. **`generateSecureId` uses `Math.random()`** — not cryptographically secure despite the name.
3. **Broken setup flow.** `authStore.init()` returns early if `setupComplete !== 'true'`, but no setup screen exists and `completeSetup()` is never called. Fresh installs can't progress correctly.
4. **Biometric = full plaintext access.** No master-password layer; whoever passes the OS biometric prompt reads everything. README implies stronger.

### Functional gaps (reads as "unfinished")
5. **Edit is stubbed** in all three ViewX screens ("Coming Soon" alert). `updateCredential`/`updateNote`/`updatePersonalInfo` are fully implemented but never wired to UI.
6. **Search is dead.** `CredentialsList` has `const [searchQuery] = useState('')` — no setter, no input field. Filter logic exists but can't run.
7. **Password generator button has no `onPress`** (the refresh icon in AddCredential).

### Minor (polish / hygiene)
8. Dead code: `prepareSensitiveData`, `simpleHash`, unused `formatCardNumber`/`formatPhoneNumber`/`isValidCardNumber` (no card/phone feature exists).
9. README says `App.jsx` — it's `App.tsx`. Node v14 claim is stale.
10. Dark theme toggle is disabled "Coming Soon".
11. No app icon/splash config, no privacy policy, no store metadata.

---

## Phase 0 — Foundation & Honesty Pass (½ day)

Leaves app working; pure cleanup + dependency prep.

- [ ] **Bump Expo SDK** from 52 to the version shipping native AES `expo-crypto` (53+). Run `npx expo install expo-crypto@latest` and follow the upgrade guide; expect a few peer-dep nudges (react-native, react versions). Verify the app still builds/runs *before* touching anything else.
- [ ] **Verify AES API is present:** confirm `AESEncryptionKey`, `aesEncryptAsync`, `aesDecryptAsync` import cleanly from `expo-crypto`.
- [ ] **Split `utils/encryption.ts`:**
  - `utils/crypto.ts` — real crypto (key derivation, encrypt/decrypt, secure ID, password strength can stay here or move to a `password.ts`).
  - `utils/masking.ts` — `obfuscateText` (this is a legit display helper, just mislabeled).
- [ ] **Fix `generateSecureId`** → `Crypto.randomUUID()`.
- [ ] **Delete dead code:** `prepareSensitiveData`, `simpleHash`, unused formatters/validators (or keep validators if you plan a card feature — decide now).
- [ ] **README honesty pass:** `App.jsx`→`App.tsx`, realistic Node version, and rewrite Security section to describe the Phase-1 model (don't claim it yet — mark as in-progress, or do this checkbox last).

---

## Phase 1 — Real Encryption Layer (1–2 days) ★ THE CENTERPIECE

### 1a. Crypto utilities (`utils/crypto.ts`)
- [ ] `generateSalt()` → random bytes via `Crypto.getRandomBytesAsync(16)`, store as base64.
- [ ] `deriveKey(masterPassword, salt)` → iterated SHA-256 (~5000 rounds) producing a stable key; import into `AESEncryptionKey`. **Document inline:** "Production upgrade: replace with PBKDF2/Argon2."
- [ ] `encryptRecord(obj, key)` → JSON.stringify → base64 → `aesEncryptAsync` → return SealedData (portable format).
- [ ] `decryptRecord(sealed, key)` → `aesDecryptAsync` → parse JSON.
- [ ] `makeVerifier(key)` → encrypt a known sentinel string; store ciphertext. On unlock, decrypt sentinel to confirm the master password was correct (don't store the password or raw key hash).

### 1b. Auth / setup flow
- [ ] **New `SetupMasterPassword` screen** (add to navigator, route fresh installs here). User sets master password + confirm; generate salt, derive key, store salt + verifier in SecureStore, set `setupComplete = 'true'`, call existing `completeSetup()`.
- [ ] **Rework `Authentication` screen / `authStore`:**
  - Returning user: offer biometric unlock (if enabled) OR master-password entry.
  - Master-password entry → derive key → check verifier → on success, hold key **in memory only** in `authStore` (`encryptionKey` field, never persisted in plaintext).
  - Biometric convenience: optionally store the derived key in SecureStore *behind* the biometric prompt, retrieve on biometric success.
- [ ] **Fix `init()` routing:** no setup → SetupMasterPassword; setup done → Authentication.
- [ ] **`logout()`** must clear the in-memory `encryptionKey`.
- [ ] **Auto-lock** (already exists via `checkTimeout`) must also drop the in-memory key, forcing re-unlock.

### 1c. Wire encryption into storage
- [ ] **`services/secureStorage.ts`:** `saveToSecureStore` encrypts the value with the in-memory key before writing; `getFromSecureStore`/`getAllItemsByType` decrypt on read. Key passed in or read from `authStore`.
- [ ] Confirm all three stores (credentials/notes/personalInfo) round-trip correctly.
- [ ] **Migration consideration:** if any test data exists in plaintext, either wipe on upgrade or write a one-time migration. For a fresh portfolio app, wipe-on-first-encrypted-launch is fine.

### 1d. Verify
- [ ] Create record → kill app → relaunch → unlock → record decrypts.
- [ ] Wrong master password → verifier fails → access denied.
- [ ] Inspect SecureStore contents (debug) → confirm ciphertext, not plaintext.

---

## Phase 2 — Finish Half-Built Features (1 day)

### Edit (all four selected features start here — lowest risk, methods already exist)
- [ ] Make `AddCredential` / `AddNote` / `AddPersonalInfo` **dual-mode**: accept optional `{ id }` route param. If present, prefill form from store and call `updateX` on save; else `addX`. Update `RootStackParamList` types accordingly.
- [ ] Replace "Coming Soon" `handleEdit` in `ViewCredential`/`ViewNote`/`ViewPersonalInfo` with `navigation.navigate('AddX', { id })`.
- [ ] Update screen titles dynamically ("Edit Credential" vs "Add Credential").

### Search
- [ ] Add `setSearchQuery` setter + a search `Input` header to `CredentialsList` (filter logic already present).
- [ ] Replicate for `NotesList` and `PersonalInfoList` (add filter logic for those — currently only Credentials has it).

### Password generator
- [ ] `generatePassword(length, { upper, lower, digits, symbols })` util in `utils/password.ts`.
- [ ] Wire the orphaned refresh button in `AddCredential` → generate → set into form → recompute strength. Optionally a small options popover.

### Polish
- [ ] Verify consistent empty states across all three lists.
- [ ] **Dark theme** (stretch — biggest item): NativeWind theming touches every screen. Either implement fully (theme context + `dark:` variants + token swap) or *remove* the disabled toggle rather than leave a dead "Coming Soon". A dead toggle reads worse than no toggle.

---

## Phase 3 — Ship Prep (1 day)

- [ ] **App icon + splash:** use existing logo / generate from it. Configure in `app.json`.
- [ ] **`app.json` config:** bundle IDs (iOS `bundleIdentifier`, Android `package`), version, **Face ID usage description** (`NSFaceIDUsageDescription` — Apple *rejects* without it for biometric apps), Android permissions.
- [ ] **EAS Build setup:** `eas.json`, build profiles, run a dev/preview build on a real device.
- [ ] **Privacy policy** — *mandatory* for a credential manager on both stores. Even a static page. Describe: local-only storage, no data leaves device, no analytics (if true).
- [ ] **`SECURITY.md`** — threat model writeup (PORTFOLIO GOLD): what InfoVault protects against (device theft with locked vault), what it doesn't (compromised OS, malware with key in memory), the KDF choice + upgrade path, why whole-record encryption. This single file signals senior-level thinking.
- [ ] **Store listing:** title, short/long description, 4–6 screenshots, category (Productivity/Utilities).
- [ ] **README final pass:** real screenshots, accurate security section, "Built with" badges, link to SECURITY.md.

---

## Portfolio Narrative (how to talk about it)

The story that makes this strong in an interview:
1. **"I built a local-first password manager, then realized my README over-claimed on security."** (Self-aware, honest.)
2. **"So I added a real AES-256-GCM layer with a master-password-derived key, key held only in memory, biometric convenience unlock."** (Shows you understand the actual pattern.)
3. **"I scoped the KDF pragmatically — iterated SHA-256 — and documented PBKDF2 as the hardening path."** (Deliberate tradeoff, not ignorance.)
4. **"Whole-record encryption; search runs over decrypted in-memory state."** (Architecture reasoning.)
5. Point to `SECURITY.md` for the threat model.

This reframes a hobby project as *engineering judgment under constraints* — which is exactly the mid-to-senior signal.

---

## Suggested Build Order (if doing it incrementally)
Phase 0 → 1a → 1b → 1c → 1d (you now have an impressive, secure, demoable app) → Phase 2 Edit → Search → Generator → Phase 3 ship prep → Dark theme last (or cut it).

Each arrow is a safe stopping point with a working app.
