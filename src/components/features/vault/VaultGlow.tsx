// Soft accent halo behind the vault door. While `locked` it breathes
// (scale 1→1.12, opacity .7→1 over 8 s, back and forth); otherwise it holds
// the expanded state. Radial-ish falloff from three nested circles — no
// shader, no extra dependency. Mount it absolutely centred under VaultDoor.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../../theme/useTheme';
import { rgba } from '../../../theme/tokens';

const BREATH_MS = 8000;
const SCALE_MAX = 1.12;
const OPACITY_MIN = 0.7;

interface VaultGlowProps {
  /** Diameter of the outermost circle. */
  size: number;
  /** Breathe while true; hold the expanded state otherwise. */
  locked: boolean;
}

const VaultGlow: React.FC<VaultGlowProps> = ({ size, locked }) => {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(locked && !reduceMotion ? 0 : 1);

  useEffect(() => {
    if (locked && !reduceMotion) {
      progress.value = withRepeat(
        withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
      return () => cancelAnimation(progress);
    }
    cancelAnimation(progress);
    progress.value = withTiming(1, { duration: reduceMotion ? 0 : tokens.motion.standard });
    return undefined;
  }, [locked, reduceMotion, progress, tokens.motion.standard]);

  const style = useAnimatedStyle(() => ({
    opacity: OPACITY_MIN + (1 - OPACITY_MIN) * progress.value,
    transform: [{ scale: 1 + (SCALE_MAX - 1) * progress.value }],
  }));

  const accent = tokens.colors.accentRgb;
  const ring = (diameter: number, alpha: number) => ({
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    backgroundColor: rgba(accent, alpha),
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.center, { width: size, height: size }, style]}>
      <View style={[styles.abs, ring(size, 0.05)]} />
      <View style={[styles.abs, ring(size * 0.72, 0.07)]} />
      <View style={[styles.abs, ring(size * 0.46, 0.1)]} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
});

export default VaultGlow;
