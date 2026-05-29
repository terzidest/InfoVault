# CLAUDE.md — InfoVault

Local-first secure personal information manager (passwords, IDs, notes). React Native + Expo. Data never leaves the device.

> Finalization roadmap lives in `INFOVAULT_FINALIZATION_SPEC.md`. Threat model lives in `SECURITY.md`. Read those before large changes to auth or storage.

## Commands

```bash
npm start          # expo start
npm run android    # expo start --android
npm run ios        # expo start --ios
npm run typecheck  # tsc --noEmit  — RUN THIS before considering any change done
```

There is no test suite yet. Verify changes by running the app and exercising the affected flow. Always run `npm run typecheck` after editing — this is a strict-TS codebase and type errors are the primary regression signal.

## Security invariants (NEVER violate these)

This is a credential manager. The following are hard rules, not preferences:

- **NEVER persist the encryption key, master password, or any derived key in plaintext.** The key lives in memory only, inside `authStore`. It may be stored in SecureStore *only* behind a biometric gate, never in AsyncStorage, never in a Zustand-persisted slice, never logged.
- **NEVER `console.log` secrets** — passwords, identifiers, keys, decrypted record contents, the master password. No exceptions, including "temporary" debugging.
- **NEVER write sensitive data to storage unencrypted.** All records go through `encryptRecord` (whole-record AES-256-GCM, `@noble/ciphers`) before `SecureStore.setItemAsync`. Reads go through `decryptRecord`. (The salt and verifier are not secret and are stored directly by `authStore`, outside the encrypting service, so they're readable before unlock.)
- **NEVER weaken the crypto** to make something easier — e.g. don't drop the GCM tag, reuse a nonce, skip the salt, or replace the key derivation with something faster without explicitly flagging it.
- **NEVER use `Math.random()` for anything security-relevant.** Use `expo-crypto` (`Crypto.randomUUID()`, `Crypto.getRandomBytesAsync`). Do NOT use `@noble`'s `randomBytes` — it relies on WebCrypto, which is absent in Hermes.
- On `logout()` and on auto-lock timeout, the in-memory key MUST be cleared, forcing re-unlock.
- The KDF is PBKDF2-SHA256 (100k iterations) via `@noble/hashes`; Argon2id is the documented upgrade path. Don't silently swap it either direction — if changing, update `SECURITY.md` too.

If a requested change would conflict with any of the above, stop and flag it rather than implementing it.

## Architecture

Layered, with strict boundaries. Respect the existing direction of dependencies:

```
screens/      → UI, navigation, form state. Calls stores. No direct storage access.
store/        → Zustand stores. Business logic + in-memory state. Calls services.
services/     → Side-effect boundary: SecureStore, expo-crypto, expo-local-authentication.
utils/        → Pure functions only (crypto, masking, formatters, validation, password gen).
components/   → ui/ (primitives) · layouts/ · features/ (domain-specific).
types/        → Shared TS types (models, navigation, storage). Source of truth.
```

- **Stores never live inside components**; screens consume them via hooks (`useCredentialsStore`, etc.).
- **`utils/` must stay pure** — no React, no storage, no side effects. Crypto primitives go here; the *calling* of them with the live key happens in services/stores.
- **All persistence goes through `services/secureStorage.ts`** — screens and stores never touch `SecureStore` directly except `authStore`/`settingsStore` for their own keys.

### The store pattern (follow it exactly)
All three domain stores (`credentialsStore`, `notesStore`, `personalInfoStore`) are intentionally identical in shape: `{ items, isLoading, error, loadX, addX, updateX, deleteX, getXById, clearX }`. When adding a feature to one, mirror it in the others unless there's a stated reason not to. `updateX` methods already exist and are correct — wire them to UI, don't rewrite them.

### Navigation
Typed stack via `RootStackParamList` in `types/navigation.ts`. Any new screen or new route param MUST be added there first. Use `ScreenProps<'RouteName'>` for screen components.

## Code style

- **TypeScript, strict.** No `any`. Prefer `unknown` + narrowing. Existing code uses discriminated unions and mapped types (e.g. `ToggleableSettingKey`) — match that level.
- **Functional components + hooks** only. `React.FC<Props>` with an explicit `Props` interface.
- **Styling:** NativeWind (`className`) is the default for components and simple screens. Several screens use `StyleSheet.create` with `react-native-size-matters` `scale()` for dimensions — when editing one of those, stay consistent with the file you're in; don't mix paradigms within a file.
- **Imports:** type-only imports use `import type`. Relative paths (no path aliases configured).
- **Colors** are currently hardcoded hex (`#006E90` primary, `#FFC107` secondary, `#4CAF50` success, `#F44336` danger, `#333333` dark). If touching theming, centralize rather than adding more scattered hex.
- Error handling in stores follows a fixed pattern: `set loading → try → set result → catch → set error + rethrow`. Match it.

## Conventions & gotchas

- New record types need: a model in `types/models.ts`, a `StorageType` entry in `types/storage.ts`, and a store following the shared shape.
- `obfuscateText` (in `utils/masking.ts`) is display-only masking — NOT a security control. Don't treat it as encryption.
- The `Input` component handles `secure` (toggle visibility) and `sensitive` (badge) as separate concerns — don't conflate them.
- Don't leave dead "Coming Soon" alerts when wiring a real feature — replace them, and remove disabled toggles for features that aren't coming.
- Keep the README's security claims in sync with reality. If you change what the app actually does, update `README.md` and `SECURITY.md` in the same change.

## When unsure
Ask before: changing the auth/unlock flow, altering anything in `services/secureStorage.ts` or `utils/crypto.ts`, modifying the store contract, or bumping the Expo SDK. These have blast radius.
