// Settings: its own top row (back + title), then Security / Appearance /
// About groups on surface cards and a "Lock now" action. Built on the v2
// theme primitives; reads tokens only.
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import useSettingsStore from '../../store/settingsStore';
import useAuthStore from '../../store/authStore';
import useAuth from '../../hooks/useAuth';
import { biometricLabel, describeBiometricMethod } from '../../services/authentication';
import { useTheme } from '../../theme/useTheme';
import {
  Screen,
  BarTitle,
  Eyebrow,
  IconButton,
  RowTitle,
  Secondary,
  Kind,
  Mono,
  ListRow,
  Switch,
  Segmented,
  Sheet,
  ActionButton,
} from '../../components/ui';
import type { SegmentedOption } from '../../components/ui';
import type { ScreenProps } from '../../types/navigation';
import type { AuthTypes, ThemeMode } from '../../types/models';

const THREAT_MODEL_URL = 'https://github.com/terzidest/InfoVault/blob/main/SECURITY.md';

interface TimeoutOption {
  value: number;
  /** Full label for the picker sheet. */
  label: string;
  /** Compact trailing value on the row. */
  short: string;
}

const TIMEOUT_OPTIONS: readonly TimeoutOption[] = [
  { value: 60000, label: '1 minute', short: 'After 1 min' },
  { value: 300000, label: '5 minutes', short: 'After 5 min' },
  { value: 900000, label: '15 minutes', short: 'After 15 min' },
  { value: 1800000, label: '30 minutes', short: 'After 30 min' },
  { value: 3600000, label: '1 hour', short: 'After 1 hour' },
];

const THEME_OPTIONS: SegmentedOption<ThemeMode>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// Subtitle + icon for the biometric row from the device capability.
const describeBiometrics = (
  auth: AuthTypes | null
): { subtitle: string; icon: keyof typeof Ionicons.glyphMap; available: boolean } => {
  if (!auth) return { subtitle: 'Checking this phone…', icon: 'finger-print-outline', available: false };
  const { method, icon } = describeBiometricMethod(auth);
  switch (method) {
    case 'none':
      return { subtitle: 'No fingerprint or face enrolled on this phone', icon, available: false };
    case 'face':
      return { subtitle: `${biometricLabel('face')} on this phone`, icon, available: true };
    case 'fingerprint':
      return { subtitle: 'Fingerprint on this phone', icon, available: true };
    case 'biometrics':
      return { subtitle: 'Biometrics on this phone', icon, available: true };
  }
};

interface GroupProps {
  title: string;
  children: React.ReactNode;
}

// Eyebrow heading + surface card. Rows inside separate themselves with
// ListRow's `divider`.
const Group: React.FC<GroupProps> = ({ title, children }) => {
  const { tokens } = useTheme();
  return (
    <View style={{ marginBottom: tokens.spacing.xxl }}>
      <Eyebrow style={{ marginBottom: tokens.spacing.sm, marginLeft: tokens.spacing.xs }}>{title}</Eyebrow>
      <View
        style={[
          styles.card,
          { backgroundColor: tokens.colors.surface, borderColor: tokens.colors.line, borderRadius: tokens.radius.xl },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const Settings: React.FC<ScreenProps<'Settings'>> = ({ navigation }) => {
  const { tokens } = useTheme();

  // Field-level selectors: skip the isLoading/error interim re-renders.
  const autoLockTimeout = useSettingsStore((s) => s.settings.autoLockTimeout);
  const theme = useSettingsStore((s) => s.settings.theme);
  const initSettings = useSettingsStore((s) => s.initSettings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { isAuthenticated, updateLastActive, logout } = useAuth();
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const enableBiometricUnlock = useAuthStore((s) => s.enableBiometricUnlock);
  const disableBiometricUnlock = useAuthStore((s) => s.disableBiometricUnlock);
  const authTypes = useAuthStore((s) => s.authTypes);
  const refreshAuthTypes = useAuthStore((s) => s.refreshAuthTypes);

  const [timeoutSheetOpen, setTimeoutSheetOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      initSettings();
    }
  }, [isAuthenticated, initSettings]);

  // Enrolment can change while the app is backgrounded; re-probe on focus.
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        updateLastActive();
      }
      refreshAuthTypes();
    }, [isAuthenticated, updateLastActive, refreshAuthTypes])
  );

  const biometrics = describeBiometrics(authTypes);
  const biometricRowEnabled = biometrics.available;

  const handleBiometricToggle = async (next: boolean) => {
    updateLastActive();
    if (next) {
      await enableBiometricUnlock();
    } else {
      await disableBiometricUnlock();
    }
  };

  const handleTimeoutSelect = (value: number) => {
    updateLastActive();
    setTimeoutSheetOpen(false);
    if (value !== autoLockTimeout) {
      updateSettings({ autoLockTimeout: value });
    }
  };

  const handleThemeChange = (next: ThemeMode) => {
    updateLastActive();
    if (next !== theme) {
      updateSettings({ theme: next });
    }
  };

  const handleOpenThreatModel = () => {
    updateLastActive();
    Linking.openURL(THREAT_MODEL_URL).catch(() => {});
  };

  // Navigation to the lock screen happens centrally (AutoLockGate resets
  // the stack on logout) — never navigate here too, or the stack
  // accumulates a route per lock cycle.
  const handleLock = () => {
    logout();
  };

  const currentTimeout = TIMEOUT_OPTIONS.find((o) => o.value === autoLockTimeout);
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <Screen>
      <View style={[styles.topRow, { paddingHorizontal: tokens.spacing.lg }]}>
        <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <BarTitle style={styles.topTitle}>Settings</BarTitle>
        <View style={styles.topSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: tokens.spacing.lg, paddingBottom: tokens.spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
      >
        <Group title="Security">
          <ListRow
            title="Biometric unlock"
            subtitle={biometrics.subtitle}
            icon={biometrics.icon}
            tint={tokens.colors.accent}
            style={!biometricRowEnabled && styles.disabledRow}
            trailing={
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                disabled={!biometricRowEnabled}
                accessibilityLabel="Biometric unlock"
              />
            }
          />
          <ListRow
            divider
            title="Auto-lock"
            subtitle="Also when the app leaves the foreground"
            icon="time-outline"
            tint={tokens.colors.tints.idDocument}
            onPress={() => setTimeoutSheetOpen(true)}
            accessibilityLabel={`Auto-lock, ${currentTimeout?.short ?? 'Choose a timeout'}`}
            trailing={
              <View style={styles.trailingRow}>
                <Secondary>{currentTimeout?.short ?? '—'}</Secondary>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={tokens.colors.quiet}
                  style={{ marginLeft: tokens.spacing.xs }}
                />
              </View>
            }
          />
          <ListRow
            divider
            title="Screen privacy"
            subtitle="Screenshots and recording blocked while unlocked"
            icon="shield-checkmark-outline"
            tint={tokens.colors.ok}
            accessibilityLabel="Screen privacy, screenshots and recording blocked while unlocked, always on"
            trailing={<Kind color={tokens.colors.ok}>Always on</Kind>}
          />
        </Group>

        <Group title="Appearance">
          <View style={{ padding: tokens.spacing.lg }}>
            <RowTitle style={{ marginBottom: tokens.spacing.md }}>Theme</RowTitle>
            <Segmented
              options={THEME_OPTIONS}
              value={theme}
              onChange={handleThemeChange}
              accessibilityLabel="Theme"
            />
          </View>
        </Group>

        <Group title="About">
          <ListRow
            title="InfoVault"
            subtitle="Local-first. Nothing leaves this device."
            icon="lock-closed-outline"
            tint={tokens.colors.accent}
            accessibilityLabel={`InfoVault version ${version}. Local-first. Nothing leaves this device.`}
            trailing={<Mono variant="value">{version}</Mono>}
          />
          <ListRow
            divider
            title="Threat model"
            subtitle="What InfoVault protects against, and what it does not"
            icon="document-text-outline"
            tint={tokens.colors.icon}
            onPress={handleOpenThreatModel}
            accessibilityLabel="Threat model, opens in browser"
            trailing={<Ionicons name="open-outline" size={18} color={tokens.colors.quiet} />}
          />
        </Group>

        <ActionButton
          title="Lock now"
          variant="ghostDanger"
          onPress={handleLock}
          accessibilityLabel="Lock vault now"
          leading={<Ionicons name="lock-closed" size={18} color={tokens.colors.bad} />}
        />
      </ScrollView>

      <Sheet visible={timeoutSheetOpen} onClose={() => setTimeoutSheetOpen(false)} title="Auto-lock after">
        <View accessibilityRole="radiogroup">
          {TIMEOUT_OPTIONS.map((option, index) => {
            const selected = option.value === autoLockTimeout;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected, checked: selected }}
                onPress={() => handleTimeoutSelect(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.colors.line2 },
                  pressed && { backgroundColor: tokens.colors.wash },
                ]}
              >
                <RowTitle color={selected ? tokens.colors.accent : tokens.colors.text}>{option.label}</RowTitle>
                {selected ? <Ionicons name="checkmark" size={20} color={tokens.colors.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
  },
  topTitle: { flex: 1, textAlign: 'center' },
  // Mirrors the back button so the title stays centred.
  topSpacer: { width: 44 },
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  trailingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabledRow: {
    opacity: 0.6,
  },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
});

export default Settings;
