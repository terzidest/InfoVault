// Unlock: the vault door, a one-line status, the biometric button (when the
// phone has one enrolled and the user opted in) and the master-password
// field. On unlock the door plays its sequence, then the app enters Home.
//
// Guards carried over from the v1 screen: single-flight on the keyboard's
// submit (buttons disable, the return key does not), one automatic
// biometric prompt per focus, failure text from the store's authError, and
// a stale-timer check so a vault that re-locked mid-animation never
// navigates past the lock screen.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';

import useAuthStore from '../../store/authStore';
import { biometricActionLabel, describeBiometricMethod, unlockStatusText } from '../../services/authentication';
import { useTheme } from '../../theme/useTheme';
import { ActionButton, BarTitle, Eyebrow, Screen, Secondary, TextField } from '../../components/ui';
import { OPEN_HOLD_MS, UNLOCK_SEQUENCE_MS, VaultDoor, VaultGlow, VaultRipple } from '../../components/features/vault';
import type { VaultDoorState } from '../../components/features/vault';
import type { ScreenProps } from '../../types/navigation';

const DOOR_SIZE = 260;
// Short windows (keyboard up on a small phone) get a smaller stage.
const DOOR_SIZE_COMPACT = 220;
const COMPACT_BELOW_HEIGHT = 700;
const GLOW_RATIO = 340 / 260;
const BIO_BUTTON = 64;

const UnlockScreen: React.FC<ScreenProps<'Unlock'>> = ({ navigation }) => {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();
  const unlockWithPassword = useAuthStore((s) => s.unlockWithPassword);
  const unlockWithBiometrics = useAuthStore((s) => s.unlockWithBiometrics);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isMigrating = useAuthStore((s) => s.isMigrating);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const authTypes = useAuthStore((s) => s.authTypes);
  const { height: windowHeight } = useWindowDimensions();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Door state is derived: locked until authenticated, then unlocking until
  // the open timer fires. Reset when the vault locks (adjusting state during
  // render, so no setState lives inside an effect).
  const [opened, setOpened] = useState(false);
  const [wasAuthenticated, setWasAuthenticated] = useState(isAuthenticated);
  if (wasAuthenticated !== isAuthenticated) {
    setWasAuthenticated(isAuthenticated);
    if (!isAuthenticated) setOpened(false);
  }
  const door: VaultDoorState = !isAuthenticated ? 'locked' : opened || reduceMotion ? 'open' : 'unlocking';
  const biometricAttempted = useRef(false);

  const biometrics = describeBiometricMethod(authTypes);
  const showBiometric = biometricEnabled && biometrics.method !== 'none';
  const doorSize = windowHeight < COMPACT_BELOW_HEIGHT ? DOOR_SIZE_COMPACT : DOOR_SIZE;
  const glowSize = Math.round(doorSize * GLOW_RATIO);

  // Shows why an unlock attempt failed. The store's authError wins (a corrupt
  // vault is not a wrong password); `fallback` covers the paths that set none.
  // A dismissed biometric prompt sets nothing and so shows nothing. Never
  // surfaces a late failure once a concurrent attempt has already unlocked.
  const reportFailure = (ok: boolean, fallback: string | null = null) => {
    const auth = useAuthStore.getState();
    if (!ok && !auth.isAuthenticated) setError(auth.authError ?? fallback);
  };

  useFocusEffect(
    useCallback(() => {
      setPassword('');
      setError(null);
      // Auto-trigger biometric once per focus when enabled. Cancelling
      // leaves the screen in place with the password input as fallback.
      if (biometricEnabled && !biometricAttempted.current) {
        biometricAttempted.current = true;
        unlockWithBiometrics().then(reportFailure);
      }
      return () => {
        biometricAttempted.current = false;
      };
    }, [biometricEnabled, unlockWithBiometrics])
  );

  // On unlock: bolts retract and the wheel spins, the door opens, then Home.
  // Every timer re-checks the live store: if the vault re-locked during the
  // sequence, a stale timer must never advance the door or navigate.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (reduceMotion) {
      navigation.replace('Home');
      return;
    }
    const openTimer = setTimeout(() => {
      if (!useAuthStore.getState().isAuthenticated) return;
      setOpened(true);
    }, UNLOCK_SEQUENCE_MS);
    const homeTimer = setTimeout(() => {
      if (!useAuthStore.getState().isAuthenticated) return;
      navigation.replace('Home');
    }, UNLOCK_SEQUENCE_MS + OPEN_HOLD_MS);
    return () => {
      clearTimeout(openTimer);
      clearTimeout(homeTimer);
    };
  }, [isAuthenticated, reduceMotion, navigation]);

  // Single-flight guards: the keyboard's submit action is not disabled the
  // way the buttons are, so both handlers re-check live store state — an
  // unlock already in progress (e.g. the auto biometric prompt) or already
  // completed must never start a second, concurrent attempt.
  const handleUnlock = async () => {
    const auth = useAuthStore.getState();
    if (!password || auth.isLoading || auth.isAuthenticated) return;
    setError(null);
    reportFailure(await unlockWithPassword(password), 'Incorrect master password');
  };

  const handleBiometric = async () => {
    const auth = useAuthStore.getState();
    if (auth.isLoading || auth.isAuthenticated) return;
    setError(null);
    reportFailure(await unlockWithBiometrics());
  };

  const busy = isLoading || isAuthenticated;
  const status = unlockStatusText({
    isAuthenticated,
    isMigrating,
    isLoading,
    method: biometrics.method,
    biometricEnabled,
  });

  return (
    <Screen hero>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingHorizontal: tokens.spacing.xxl, paddingVertical: tokens.spacing.xl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <Ionicons name="shield-checkmark-outline" size={22} color={tokens.colors.amber} />
            <BarTitle style={{ marginLeft: tokens.spacing.sm }}>
              Info
              <BarTitle color={tokens.colors.amberText}>Vault</BarTitle>
            </BarTitle>
          </View>

          <View style={[styles.stage, { width: glowSize, height: glowSize }]}>
            <VaultGlow size={glowSize} locked={door === 'locked'} />
            {door !== 'locked' ? <VaultRipple size={doorSize} /> : null}
            <VaultDoor size={doorSize} state={door} />
          </View>

          <Eyebrow style={{ marginBottom: tokens.spacing.xl }} accessibilityLiveRegion="polite">
            {status}
          </Eyebrow>

          <View style={styles.form}>
            {showBiometric ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={biometricActionLabel(biometrics.method)}
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={handleBiometric}
                  style={({ pressed }) => [
                    styles.bioButton,
                    {
                      backgroundColor: pressed ? tokens.colors.wash2 : tokens.colors.surface,
                      borderColor: tokens.colors.line,
                    },
                    busy && styles.disabled,
                  ]}
                >
                  <Ionicons name={biometrics.icon} size={30} color={tokens.colors.accent} />
                </Pressable>
                <Secondary style={{ marginTop: tokens.spacing.sm, textAlign: 'center' }}>
                  {biometricActionLabel(biometrics.method)}
                </Secondary>
                <View style={[styles.divider, { marginVertical: tokens.spacing.lg }]}>
                  <View style={[styles.rule, { backgroundColor: tokens.colors.line }]} />
                  <Secondary color={tokens.colors.quiet} style={{ marginHorizontal: tokens.spacing.md }}>
                    or
                  </Secondary>
                  <View style={[styles.rule, { backgroundColor: tokens.colors.line }]} />
                </View>
              </>
            ) : null}

            <TextField
              value={password}
              onChangeText={setPassword}
              placeholder="Master password"
              secure
              leading={<Ionicons name="lock-closed-outline" size={18} color={tokens.colors.icon} />}
              error={error ?? undefined}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleUnlock}
              accessibilityLabel="Master password"
              editable={!busy}
            />
            <ActionButton
              title="Unlock"
              onPress={handleUnlock}
              loading={isLoading}
              disabled={busy || !password}
              style={{ marginTop: tokens.spacing.md }}
            />
            <Secondary color={tokens.colors.quiet} style={[styles.footnote, { marginTop: tokens.spacing.xl }]}>
              No recovery exists. The password is never stored.
            </Secondary>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stage: { alignItems: 'center', justifyContent: 'center' },
  form: { width: '100%', maxWidth: 360, alignItems: 'center' },
  bioButton: {
    width: BIO_BUTTON,
    height: BIO_BUTTON,
    borderRadius: BIO_BUTTON / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  divider: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  footnote: { textAlign: 'center' },
});

export default UnlockScreen;
