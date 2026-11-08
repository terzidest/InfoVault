import React, { useEffect, useRef, useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { useFocusEffect } from '@react-navigation/native';

import useAuthStore from '../../store/authStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { colors } from '../../theme/colors';
import type { ScreenProps } from '../../types/navigation';

// The lock animation is 40 frames @ 10fps (4s); played at 3x it lands ~1.3s.
const UNLOCK_ANIMATION_MS = 1400;

const Authentication: React.FC<ScreenProps<'Authentication'>> = ({ navigation }) => {
  const {
    unlockWithPassword,
    unlockWithBiometrics,
    isAuthenticated,
    isLoading,
    biometricEnabled,
  } = useAuthStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const biometricAttempted = useRef(false);
  const animationRef = useRef<LottieView>(null);

  useFocusEffect(
    React.useCallback(() => {
      setPassword('');
      setError(null);
      // Lock stays still while locked; rewind in case we replayed it before.
      animationRef.current?.reset();
      // Auto-trigger biometric once per focus when enabled. Cancelling
      // leaves the screen in place with the password input as fallback.
      if (biometricEnabled && !biometricAttempted.current) {
        biometricAttempted.current = true;
        unlockWithBiometrics();
      }
      return () => {
        biometricAttempted.current = false;
      };
    }, [biometricEnabled, unlockWithBiometrics])
  );

  // On unlock, play the lock animation once, then enter the app.
  useEffect(() => {
    if (!isAuthenticated) return;
    animationRef.current?.play();
    const timer = setTimeout(() => {
      // If the vault re-locked during the animation window, a stale timer
      // must never navigate past the lock screen.
      if (!useAuthStore.getState().isAuthenticated) return;
      navigation.replace('Home');
    }, UNLOCK_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [isAuthenticated, navigation]);

  // Single-flight guards: the keyboard's submit action is not disabled the
  // way the buttons are, so both handlers re-check live store state — an
  // unlock already in progress (e.g. the auto biometric prompt) or already
  // completed must never start a second, concurrent attempt.
  const handleUnlock = async () => {
    const auth = useAuthStore.getState();
    if (!password || auth.isLoading || auth.isAuthenticated) return;
    setError(null);
    const ok = await unlockWithPassword(password);
    // A late failure must not surface an error after a concurrent biometric
    // attempt has already unlocked the vault.
    if (!ok && !useAuthStore.getState().isAuthenticated) {
      setError('Incorrect master password');
    }
  };

  const handleBiometric = async () => {
    const auth = useAuthStore.getState();
    if (auth.isLoading || auth.isAuthenticated) return;
    setError(null);
    await unlockWithBiometrics();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.screen}>
        <View style={styles.content}>
          <Text style={styles.title}>InfoVault</Text>
          <Text style={styles.subtitle}>
            {biometricEnabled
              ? 'Unlock with biometrics, or enter your master password'
              : 'Enter your master password to unlock your vault'}
          </Text>

          <View style={{ height: 150, width: 150, marginBottom: 16 }}>
            <LottieView
              ref={animationRef}
              source={require('../../assets/animations/lock.json')}
              autoPlay={false}
              loop={false}
              speed={3}
              style={{ width: 150, height: 150 }}
            />
          </View>

          <View style={styles.form}>
            {biometricEnabled && (
              <Button
                onPress={handleBiometric}
                size="large"
                variant="outline"
                isLoading={isLoading}
                disabled={isLoading || isAuthenticated}
                style={styles.biometricButton}
              >
                Use biometrics
              </Button>
            )}
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="Master password"
              secure
              error={!!error}
              helperText={error ?? undefined}
              onSubmitEditing={handleUnlock}
            />
            <Button
              onPress={handleUnlock}
              size="large"
              isLoading={isLoading}
              disabled={isLoading || isAuthenticated || !password}
            >
              Unlock
            </Button>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.light,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 64,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.dark,
    marginBottom: 16,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 320,
  },
  biometricButton: {
    marginBottom: 12,
  },
});

export default Authentication;
