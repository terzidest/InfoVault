/**
 * Expo config plugin: patch fmt's base.h to force FMT_USE_CONSTEVAL=0.
 *
 * Why: React Native 0.76 (Expo SDK 52) bundles fmt v11, which gates its
 * consteval path on `__cpp_consteval`. Xcode 26's clang defines that macro,
 * but its stricter constant-evaluation rules reject the resulting consteval
 * call patterns in fmt — compilation fails inside Pods/fmt/include/fmt/format-inl.h.
 * An external `-DFMT_USE_CONSTEVAL=0` doesn't help because base.h redefines
 * the macro itself; the fix has to be inside base.h.
 *
 * This plugin appends a CocoaPods `post_install` hook to the generated Podfile
 * that rewrites the two fmt branches that would otherwise set the macro to 1.
 * It runs on every `expo prebuild`, so the patch survives Podfile regeneration.
 * Idempotent both in the Podfile (marker check) and in base.h (gsub no-op when
 * already patched). Remove once Expo SDK is bumped to one that ships an
 * Xcode-26-compatible RN.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PATCH_MARKER = '# fmt (bundled with RN 0.76) defines FMT_USE_CONSTEVAL=1';

const PATCH_BLOCK = `
    # fmt (bundled with RN 0.76) defines FMT_USE_CONSTEVAL=1 from inside its own
    # base.h when __cpp_consteval is detected, which Xcode 26 sets — and its
    # consteval code paths fail to compile under Xcode 26's stricter rules.
    # An external -D define cannot win since base.h re-defines the macro.
    # Patch base.h directly to force FMT_USE_CONSTEVAL=0. Idempotent.
    fmt_base = File.expand_path('Pods/fmt/include/fmt/base.h', Pod::Config.instance.installation_root)
    if File.exist?(fmt_base)
      text = File.read(fmt_base)
      patched = text
        .gsub(/^#elif defined\\(__cpp_consteval\\)\\n#  define FMT_USE_CONSTEVAL 1/, "#elif defined(__cpp_consteval)\\n#  define FMT_USE_CONSTEVAL 0  // patched: Xcode 26 consteval incompatibility")
        .gsub(/^#elif FMT_GCC_VERSION >= 1002 \\|\\| FMT_CLANG_VERSION >= 1101\\n#  define FMT_USE_CONSTEVAL 1/, "#elif FMT_GCC_VERSION >= 1002 || FMT_CLANG_VERSION >= 1101\\n#  define FMT_USE_CONSTEVAL 0  // patched: Xcode 26 consteval incompatibility")
      File.write(fmt_base, patched) if patched != text
    end
`;

const withFmtXcode26Patch = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes(PATCH_MARKER)) {
        return config;
      }

      // Insert before the final `end` lines that close the post_install block
      // and the target block. The Expo-generated Podfile ends with
      // `    end\n  end\nend\n`. We splice our patch in after the existing
      // post_install body and before the post_install's own `end`.
      const closingPattern = /\n  end\nend\s*$/;
      if (!closingPattern.test(contents)) {
        // Podfile shape changed — bail rather than corrupting it.
        return config;
      }
      contents = contents.replace(closingPattern, `\n${PATCH_BLOCK}\n  end\nend\n`);

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
};

module.exports = withFmtXcode26Patch;
