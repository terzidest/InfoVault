// Two accent rings that expand (scale .96→2.1) and fade over 1.3 s, the
// second 180 ms behind, once per mount. Mount it when the door starts
// unlocking; unmount (or re-key) to replay. Renders nothing under reduced
// motion.
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../../theme/useTheme';

const RIPPLE_MS = 1300;
const SECOND_DELAY_MS = 180;
const SCALE_FROM = 0.96;
const SCALE_TO = 2.1;
const ease = Easing.bezier(0.2, 0.7, 0.2, 1);

interface RingProps {
  size: number;
  color: string;
  opacity: number;
  delay: number;
}

const Ring: React.FC<RingProps> = ({ size, color, opacity, delay }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: RIPPLE_MS, easing: ease }));
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity * (1 - progress.value),
    transform: [{ scale: SCALE_FROM + (SCALE_TO - SCALE_FROM) * progress.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }, style]}
    />
  );
};

interface VaultRippleProps {
  /** Diameter at scale 1 (match the door). */
  size: number;
}

const VaultRipple: React.FC<VaultRippleProps> = ({ size }) => {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  const color = tokens.colors.accent;
  return (
    <>
      <Ring size={size} color={color} opacity={0.7} delay={0} />
      <Ring size={size} color={color} opacity={0.4} delay={SECOND_DELAY_MS} />
    </>
  );
};

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 2 },
});

export default VaultRipple;
