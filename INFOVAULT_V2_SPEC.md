# InfoVault v2 — Spec

**Purpose of the app:** one place on your phone for everything you'd otherwise write on a scrap of paper, in a notebook, or in a .txt file and then lose: passwords, Greek ΑΦΜ / ΑΜΚΑ, SIM PIN/PUK, card details, Wi‑Fi passwords, door codes, bank customer numbers. Store it safely, find it fast, read it out or copy it, edit it in place. Nothing leaves the device.

**Where v1 stands:** the security core is done and reviewed (AES‑256‑GCM whole-record encryption, master password + biometric unlock, auto-lock, masked reveal, screenshot blocking, clipboard clearing). The data model is the gap: three fixed record types (`Credential`, `PersonalInfo`, `Note`) don't fit most of the things the app exists for, so they end up as free text in Notes. And the quickest path to a value is four taps deep.

v2 fixes the model and the speed, adds the one feature that blocks calling it production (backup), and moves the stack to the current Expo SDK with the New Architecture.

---

## 1. Data model

One record type. A record is a title, a template, and an ordered list of labeled fields.

```ts
type FieldKind = 'text' | 'secret' | 'number' | 'date' | 'url' | 'multiline';

interface Field {
  id: string;
  label: string;        // user-editable: "PIN", "PUK", "ΑΦΜ", "Customer no."
  value: string;
  kind: FieldKind;      // drives masking, keyboard, display, copy behaviour
}

interface Record {
  id: string;
  title: string;
  template: TemplateId; // picks icon + default fields; never restricts fields
  fields: Field[];
  pinned: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

**Field kinds**
- `secret` — masked by default, reveal with auto-hide, tap-to-copy with timed clipboard clear. Passwords, PINs, PUKs, CVV.
- `number` — identification numbers. Rendered large, monospace, grouped (`123 456 789`) for reading out to a clerk. Not masked by default (ΑΦΜ isn't a secret, it's a thing you keep forgetting), but the user can flip any field to `secret`.
- `text`, `url`, `date`, `multiline` — as named. `url` gets an open action; `date` gets a picker and expiry awareness (an expired ID shows it).

**Templates** pre-fill the field list and pick an icon. They are a starting point only; any field can be added, removed, relabeled or re-kinded on any record.

| Template | Default fields |
|---|---|
| Login | username, password (secret), website (url), notes |
| ID number | number (number), issuing authority, notes — for ΑΦΜ, ΑΜΚΑ, SSN-style numbers |
| ID document | number (number), issue date, expiry date, issuing authority, notes — passport, ID card, licence |
| SIM | phone number, PIN (secret), PUK (secret), carrier |
| Card | number (number), expiry (date), CVV (secret), PIN (secret), bank, cardholder |
| Wi‑Fi | network name, password (secret) |
| Note | content (multiline) |
| Custom | title only; add fields freely |

**Why one type:** it's what the purpose needs, it collapses three identical stores into one, it gives the UI one list/detail/edit screen instead of three sets, and it gives export one shape to serialize.

### Migration from v1
Runs once, on the first unlock after update, same pattern as the vault-header migration: decrypt each v1 record, map it, re-encrypt, write, then delete the old entry and key registry. Never deletes an old record before its replacement is written.

- `Credential` → Login: username, password, website, notes.
- `PersonalInfo` → ID document (or ID number when only `identifier` is set and `type` is Tax Number / Social Security): identifier → number, dates, authority, notes.
- `Note` → Note: content; `category` → a tag.

### Storage
Unchanged: whole-record AES‑256‑GCM through `services/secureStorage.ts`, one `SecureStore` entry per record plus one key registry (`recordKeys`). SecureStore's per-entry size limit (~2 KB on Android) stays the practical cap on a single record; the add screen enforces it the way the note cap does today.

---

## 2. Screens

Designed in Claude Design; this lists what each screen must do, not how it looks.

- **Unlock** — as today: biometric prompt on open, password fallback.
- **Home** — search-first. The search box is the first thing on screen; pinned records above the results; recent records below. No category menu. Typing filters across titles, labels, tags and non-secret values. A row shows the title, template icon, and the first non-secret field as a subtitle (e.g. the username for a Login, the number for an ID number), with a copy action on the row so the common case is one tap after unlock.
- **Record** — fields rendered generically by kind. Secret fields masked with reveal/auto-hide and copy; number fields large and grouped; url opens; date shows expiry state. Pin and edit from the header.
- **Add / Edit** — one screen. Picking a template seeds the fields. Each field row is label + value + kind; fields can be added, removed, reordered. The password generator attaches to any `secret` field.
- **Settings** — auto-lock, biometrics, theme, **change master password**, **export / import**, lock now.

**Styling:** one paradigm across the app (decided during the rebuild; today NativeWind and StyleSheet + `size-matters` are mixed per file). Colors, spacing and type come from one theme module; light and dark both supported.

---

## 3. Features

**In**
1. Unified record model + migration (section 1).
2. Search-first Home with pinned records and row-level copy.
3. **Encrypted export / import.** A single file sealed under a key derived from the master password with the vault's current KDF, carrying the KDF params and salt in its header so it can be imported on a fresh install. Shared via the OS share sheet; the user keeps it wherever they like. This is the backup story and the production blocker.
4. **Change master password.** Re-wraps the vault key (PR #28's key hierarchy); records are untouched. Rotates the biometric keystore copy.
5. Dark theme (the toggle exists; the implementation doesn't).

**Later, if at all**
- TOTP / 2FA codes (pure crypto, fits the identity; needs a camera/QR flow).
- Password health (reused / weak), using `checkPasswordStrength`.

**Out**
- Attachments, photos of documents — storage model and size limits change entirely.
- System autofill — native extensions on both platforms, weeks of work.
- Sync or any network use — contradicts local-first.

---

## 4. Platform

- Expo SDK 52 → current (58 at time of writing), **New Architecture on**. Known fallout: Reanimated 3 → 4 (4 requires New Arch), React Navigation 6 → 7, NativeWind off the 4.1.23 pin, drop `plugins/with-fmt-xcode26-patch.js` (RN 0.76-only workaround). Follow the lockfile procedure in CLAUDE.md.
- Done on the v1 app first, behaviour unchanged, merged with green CI, before any v2 UI work. One unknown at a time.
- Unblocks `react-native-quick-crypto`, which gives PR #28 native Argon2id instead of pure JS on Hermes. Decide the KDF switch after the upgrade, with on-device timings.

---

## 5. Sequence

1. **SDK + New Arch upgrade** on v1 (branch, PR, CI green, APK rebuilt and smoke-tested).
2. **Design** in Claude Design, in parallel with 1: Unlock, Home, Record, Add/Edit, Settings, light + dark.
3. **Model + migration**: new `types/models.ts`, single `recordsStore`, migration on unlock, v1 stores deleted. Tested with the Node harness pattern used for the vault-header migration (real store + crypto, stubbed SecureStore).
4. **Screens**, one at a time against the design: Home, Record, Add/Edit, Settings, Unlock. Old screens deleted as each new one lands.
5. **Export / import**, then **change master password** (after PR #28 merges).
6. Release v2: EAS preview APK, GitHub release, Appetize upload, README + SECURITY.md updated in the same change.

Security invariants in CLAUDE.md apply throughout. Steps 3 and 5 touch `utils/crypto.ts` / `services/secureStorage.ts` and get a review pass before merge.
