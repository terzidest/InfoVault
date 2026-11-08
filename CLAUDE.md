# CLAUDE.md — InfoVault

Local-first secure personal information manager (passwords, IDs, notes). React Native + Expo. Data never leaves the device.

> The v2 roadmap (record model, screens, features, platform upgrade, sequence) lives in `INFOVAULT_V2_SPEC.md`; the target design (stack, layers, key hierarchy, flows, decisions) in `ARCHITECTURE.md`. Threat model lives in `SECURITY.md`. Read those before large changes to auth or storage.

## Commands

```bash
npm start          # expo start
npm run android    # expo start --android
npm run ios        # expo start --ios
npm run typecheck  # tsc --noEmit  — RUN THIS before considering any change done
```

Tests are Jest (`npm test`, config in `jest.config.js`), logic-level only: real Zustand stores and real `@noble` crypto run against in-memory stand-ins for the native modules in `__mocks__/` (SecureStore, expo-file-system, expo-crypto, local-authentication, clipboard). No component-render tests — pull logic out of components to test it. Suites live in `src/**/__tests__/*.test.ts`; use the mocks' `__reset`/`__setAuthGate`/`__failNextSet` helpers through the same `import * as` the code uses. Anything touching crypto, storage or the auth flow needs a test. UI changes are still verified by running the app. Always run `npm run typecheck` after editing — this is a strict-TS codebase and type errors are the primary regression signal. Lint with `npm run lint`; CI enforces zero warnings and runs the tests.

> **Lockfile gotcha:** after adding/removing any dependency, regenerate the lockfile from scratch (`rm -rf node_modules package-lock.json && npm install`). Incremental installs on macOS prune Linux-only optional entries (`@emnapi/*` under the unrs-resolver bindings) and `npm ci` then fails in CI.
> After regenerating, run `npx expo install --check` — a fresh resolve floats caret ranges past what SDK 58 supports. Verify bundling with `npx expo export --platform ios` before pushing dependency changes.

## Security invariants (NEVER violate these)

This is a credential manager. The following are hard rules, not preferences:

- **NEVER persist the encryption key, master password, or any derived key in plaintext.** The key lives in memory only, inside `authStore`. It may be stored in SecureStore *only* behind a biometric gate, never in AsyncStorage, never in a Zustand-persisted slice, never logged.
- **NEVER `console.log` secrets** — passwords, identifiers, keys, decrypted record contents, the master password. No exceptions, including "temporary" debugging.
- **NEVER write sensitive data to storage unencrypted.** The whole record set goes through `encodeVaultFile` (one AES-256-GCM blob under the vault key, `@noble/ciphers`) and is written only by `writeVault` in `services/vaultFile.ts`; reads go through `readVaultPayload`. Records never touch SecureStore. (The vault header — KDF params, salt, wrapped vault key — is not secret and is stored in SecureStore directly by `authStore`, so it's readable before unlock. Pre-header vaults' salt + verifier are migrated to it on password unlock; v1 per-record SecureStore entries are migrated into the vault file by `services/migrateV1.ts` on open.)
- **NEVER weaken the crypto** to make something easier — e.g. don't drop the GCM tag, reuse a nonce, skip the salt, or replace the key derivation with something faster without explicitly flagging it.
- **NEVER use `Math.random()` for anything security-relevant.** Use `expo-crypto` (`Crypto.randomUUID()`, `Crypto.getRandomBytesAsync`). Do NOT use `@noble`'s `randomBytes` — it relies on WebCrypto, which is absent in Hermes.
- On `logout()` and on auto-lock timeout, the in-memory key MUST be cleared, forcing re-unlock.
- The KDF is PBKDF2-SHA256 (100k iterations) via `@noble/hashes`, set by `CURRENT_KDF` in `utils/crypto.ts`; Argon2id is supported by the vault format and is the planned default. Don't silently swap it either direction — if changing, update `SECURITY.md` too. Never change `LEGACY_KDF`: it is what pre-header vaults were derived with.

If a requested change would conflict with any of the above, stop and flag it rather than implementing it.

## Architecture

Layered, with strict boundaries. Respect the existing direction of dependencies:

```
screens/      → UI, navigation, form state. Calls stores. No direct storage access.
                Home, RecordScreen, AddEditRecordScreen, settings/Settings, auth/*.
store/        → Zustand stores: authStore (vault key, unlock/lock), recordsStore (the
                decrypted record set + mutations), settingsStore. vaultKey.ts reads
                the live key at call time. Calls services.
services/     → Side-effect boundary: vaultFile (read/write vault.bin), migrateV1
                (v1 SecureStore records → vault file), legacyVault (v1 layout names,
                wipe), authentication, clipboard, interactions.
utils/        → Pure functions only: crypto, vaultFormat (the sealed container codec),
                records (templates, search, sort, v1 mappers), errors, formatters,
                validation, password gen.
components/   → ui/ (token-driven primitives) · features/records (record UI) ·
                features/AutoLockGate.
theme/        → tokens.ts (the only place colors live), ThemeProvider, useTheme.
types/        → Shared TS types (models, navigation). Source of truth.
```

- **Stores never live inside components**; screens consume them via hooks with field selectors (`useRecordsStore((s) => s.records)`), never whole-store subscriptions.
- **`utils/` must stay pure** — no React, no storage, no side effects, no randomness (ids come from an injected generator). Crypto primitives go here; the *calling* of them with the live key happens in services/stores.
- **All record persistence goes through `services/vaultFile.ts`** (`writeVault` is the only writer). SecureStore is touched only by `authStore` (header, biometric key copy, setup flag), `settingsStore` (settings blob) and `legacyVault`/`migrateV1` (the v1 layout).

### The records store contract (follow it exactly)
`recordsStore` is `{ records, isLoading, error, isOpen, open, add, update, remove, togglePin, getById, clear }`. `open()` is called by `authStore` after the key is in state and resolves `true` when the records are published (`false` when the vault locked meanwhile; throws when the file cannot be opened). Every mutation goes through one internal `mutate()`: it runs on a serial queue, computes the next full record set, validates **every** record (`isVaultRecord` + the 64 KB `MAX_RECORD_BYTES` cap), writes the whole set with `writeVault` (lock-checked after sealing), and only then publishes to state. Add new mutations as another `mutate()` call — never write to the file or `set({ records })` from anywhere else. `clear()` is for lock only; it never touches the file.

### Navigation
Typed stack via `RootStackParamList` in `types/navigation.ts`. Any new screen or new route param MUST be added there first. Use `ScreenProps<'RouteName'>` for screen components.

## Code style

- **TypeScript, strict.** No `any`. Prefer `unknown` + narrowing. Existing code uses discriminated unions and mapped types (e.g. `ToggleableSettingKey`) — match that level.
- **Functional components + hooks** only. `React.FC<Props>` with an explicit `Props` interface.
- **Styling:** `StyleSheet.create` + `useTheme()` tokens (`tokens.colors`, `spacing`, `radius`, `type`, `motion`), light and dark. No styling dependencies. Compose screens from `components/ui` (`Screen`, `TextField`, `ActionButton`, `IconButton`, `ListRow`, the `Type` primitives) rather than raw `Text`/`TextInput`.
- **Imports:** type-only imports use `import type`. Relative paths (no path aliases configured).
- **Colors:** no hex outside `theme/tokens.ts`. The one exception is the vault-door artwork in `components/features/vault/VaultDoor.tsx`, whose metal/steel palette is part of the illustration, not the theme (it still reads accent/amber from tokens and picks ring colors per scheme). Every screen must look right in both schemes.
- Error handling in stores follows a fixed pattern: `set loading → try → set result → catch → set error + rethrow`. Match it.

## Conventions & gotchas

- There is one record type (`VaultRecord`: title, template, ordered kinded fields, tags, pinned). New templates need a `TEMPLATES` entry in `utils/records.ts` (label + seeded fields), an icon in `components/features/records/recordUi.ts` (`TEMPLATE_ICONS`, `TEMPLATE_ORDER`) and a tint in `theme/tokens.ts`; the `TemplateId` union in `types/models.ts` drives all three. New field kinds touch `FieldKind`, `FieldValue`, `FieldEditorRow` and `KIND_ORDER`.
- Masking in `FieldValue` (fixed-width dots, reveal with auto-hide) is display-only — NOT a security control. Secret values are also excluded from search on purpose.
- The v1 `Credential`/`Note`/`PersonalInfo` types stay in `types/models.ts` because the migration mappers in `utils/records.ts` read them. Don't rename or "clean up" the v1 layout names in `services/legacyVault.ts` either — they are what is on users' devices.
- Animating `react-native-svg` with Reanimated: only props the native elements understand (`opacity`, geometry like `y`/`r`/`cx`, `strokeDashoffset`) work through `animatedProps`; `rotation`/`translate`/`scale` are resolved in JS at render and do not animate. Rotate or scale an `Animated.View` around the `<Svg>` instead (see `VaultDoor.tsx`).
- Don't leave dead "Coming Soon" alerts when wiring a real feature — replace them, and remove disabled toggles for features that aren't coming.
- Keep the README's security claims in sync with reality. If you change what the app actually does, update `README.md` and `SECURITY.md` in the same change.

## When unsure
Ask before: changing the auth/unlock flow, altering anything in `services/vaultFile.ts`, `utils/vaultFormat.ts`, `services/migrateV1.ts` or `utils/crypto.ts`, modifying the records store contract, or bumping the Expo SDK. These have blast radius.
