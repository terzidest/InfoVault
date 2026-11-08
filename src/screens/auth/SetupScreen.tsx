// Setup: create the master password for a new vault. A small locked door,
// the password with a live strength meter and checklist, confirmation, the
// no-recovery warning, an optional biometric opt-in, and "Create vault".
// On success the store has already opened the vault; if the switch is on,
// enableBiometricUnlock prompts once, then the stack moves to Home.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import useAuthStore from '../../store/authStore';
import { checkAuthenticationTypes, describeBiometricMethod } from '../../services/authentication';
import { useTheme } from '../../theme/useTheme';
import { rgba } from '../../theme/tokens';
import { ActionButton, Body, Eyebrow, Kind, ListRow, Screen, Secondary, Switch, TextField, Title } from '../../components/ui';
import { VaultDoor } from '../../components/features/vault';
import { checkPasswordStrength } from '../../utils/crypto';
import { canCreateVault, passwordChecks, strengthLevel } from '../../utils/passwordRules';
import type { AuthTypes } from '../../types/models';
import type { ScreenProps } from '../../types/navigation';

const DOOR_SIZE = 112;
const SEGMENTS = [0, 1, 2, 3] as const;

const SetupScreen: React.FC<ScreenProps<'Setup'>> = ({ navigation }) => {
  const { tokens } = useTheme();
  const setupMasterPassword = useAuthStore((s) => s.setupMasterPassword);
  const enableBiometricUnlock = useAuthStore((s) => s.enableBiometricUnlock);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [wantsBiometric, setWantsBiometric] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authTypes, setAuthTypes] = useState<AuthTypes | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkAuthenticationTypes().then((types) => {
      if (!cancelled) setAuthTypes(types);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const biometrics = describeBiometricMethod(authTypes);
  const strength = strengthLevel(checkPasswordStrength(password));
  const checks = passwordChecks(password);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = canCreateVault(password, confirm) && !isLoading;
  const toneColor = tokens.colors[strength.tone];

  const handleSubmit = async () => {
    // The store serializes attempts; this only keeps the return key from
    // re-firing while a setup is already running.
    if (!canCreateVault(password, confirm) || useAuthStore.getState().isLoading) return;
    setError(null);
    const ok = await setupMasterPassword(password);
    if (!ok) {
      // Includes the cutover's "A vault already exists on this device.
      // Restart the app." case, which also flips needsSetup off.
      setError(useAuthStore.getState().authError ?? 'Could not set up your vault');
      return;
    }
    if (wantsBiometric) {
      // Prompts once. A declined or failed enrolment is not fatal: the vault
      // is open and the toggle stays available in Settings.
      await enableBiometricUnlock();
    }
    navigation.replace('Home');
  };

  const biometricTitle =
    biometrics.method === 'face'
      ? 'Unlock with Face ID'
      : biometrics.method === 'fingerprint'
        ? 'Unlock with fingerprint'
        : 'Unlock with biometrics';

  return (
    <Screen hero>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { padding: tokens.spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <VaultDoor size={DOOR_SIZE} state="locked" />
          </View>
          <Eyebrow style={{ marginBottom: tokens.spacing.sm }}>New vault</Eyebrow>
          <Title>Create your master password</Title>
          <Secondary style={{ marginTop: tokens.spacing.sm, marginBottom: tokens.spacing.xxl }}>
            It encrypts everything in the vault. You type it to unlock; a fingerprint or face can stand in after
            that.
          </Secondary>

          <TextField
            value={password}
            onChangeText={setPassword}
            placeholder="Master password"
            secure
            leading={<Ionicons name="lock-closed-outline" size={18} color={tokens.colors.icon} />}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            accessibilityLabel="Master password"
            editable={!isLoading}
          />

          <View
            style={[styles.strengthRow, { marginTop: tokens.spacing.md }]}
            accessible
            accessibilityLabel={password ? `Password strength ${strength.label.toLowerCase()}` : 'Password strength'}
          >
            <View style={styles.segments}>
              {SEGMENTS.map((i) => (
                <View
                  key={i}
                  style={[
                    styles.segment,
                    {
                      backgroundColor: i < strength.segments ? toneColor : tokens.colors.wash2,
                      marginLeft: i === 0 ? 0 : tokens.spacing.xs,
                    },
                  ]}
                />
              ))}
            </View>
            {password ? (
              <Kind color={toneColor} style={{ marginLeft: tokens.spacing.md }}>
                {strength.label}
              </Kind>
            ) : null}
          </View>

          <View style={{ marginTop: tokens.spacing.md, marginBottom: tokens.spacing.xl }}>
            {checks.map((check) => (
              <View key={check.id} style={[styles.checkRow, { marginTop: tokens.spacing.xs }]}>
                <Ionicons
                  name={check.met ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={check.met ? tokens.colors.ok : tokens.colors.faint}
                />
                <Secondary
                  color={check.met ? tokens.colors.text2 : tokens.colors.muted}
                  style={{ marginLeft: tokens.spacing.sm }}
                >
                  {check.label}
                </Secondary>
              </View>
            ))}
          </View>

          <TextField
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirm master password"
            secure
            leading={<Ionicons name="lock-closed-outline" size={18} color={tokens.colors.icon} />}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            error={mismatch ? 'Passwords do not match' : undefined}
            accessibilityLabel="Confirm master password"
            editable={!isLoading}
          />

          <View
            style={[
              styles.warning,
              {
                marginTop: tokens.spacing.xl,
                padding: tokens.spacing.lg,
                borderRadius: tokens.radius.lg,
                backgroundColor: tokens.colors.surface,
                borderColor: rgba(tokens.colors.amberRgb, 0.3),
              },
            ]}
          >
            <Ionicons name="warning-outline" size={18} color={tokens.colors.amberText} />
            <Body style={[styles.warningText, { marginLeft: tokens.spacing.md }]}>
              There is no recovery. Forget this password and the vault&apos;s contents are gone for good. Nothing is
              sent anywhere that could restore it.
            </Body>
          </View>

          {biometrics.method !== 'none' ? (
            <View
              style={[
                styles.optIn,
                {
                  marginTop: tokens.spacing.lg,
                  borderRadius: tokens.radius.lg,
                  backgroundColor: tokens.colors.surface,
                  borderColor: tokens.colors.line,
                },
              ]}
            >
              <ListRow
                title={biometricTitle}
                subtitle="Stands in for the password after this"
                icon={biometrics.icon}
                tint={tokens.colors.accent}
                trailing={
                  <Switch
                    value={wantsBiometric}
                    onValueChange={setWantsBiometric}
                    disabled={isLoading}
                    accessibilityLabel={biometricTitle}
                  />
                }
              />
            </View>
          ) : null}

          {error ? (
            <Secondary color={tokens.colors.bad} style={{ marginTop: tokens.spacing.lg }}>
              {error}
            </Secondary>
          ) : null}

          <ActionButton
            title="Create vault"
            onPress={handleSubmit}
            loading={isLoading}
            disabled={!canSubmit}
            style={{ marginTop: tokens.spacing.xxl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', maxWidth: 480, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', marginBottom: 16 },
  strengthRow: { flexDirection: 'row', alignItems: 'center' },
  segments: { flex: 1, flexDirection: 'row' },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  warning: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1 },
  warningText: { flex: 1 },
  optIn: { borderWidth: 1, overflow: 'hidden' },
});

export default SetupScreen;
