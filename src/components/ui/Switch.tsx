// Controlled on/off toggle: 44x26 track (teal on, wash2 off) with a 20px
// white knob that slides over 220ms. Wrapped in a 44pt-high hit area.
import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { easing } from '../../theme/tokens';

const TRACK_W = 44;
const TRACK_H = 26;
const KNOB = 20;
const PAD = (TRACK_H - KNOB) / 2;
const TRAVEL = TRACK_W - KNOB - PAD * 2;
const DURATION = 220;

interface SwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const Switch: React.FC<SwitchProps> = ({ value, onValueChange, disabled = false, accessibilityLabel, style }) => {
  const { tokens } = useTheme();
  // Lazy state initializer: a stable Animated.Value without reading a ref in render.
  const [progress] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: DURATION,
      easing,
      useNativeDriver: false, // backgroundColor is not native-driver animatable
    }).start();
  }, [value, progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });
  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [tokens.colors.wash2, tokens.colors.teal],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={6}
      style={[styles.hit, disabled && styles.disabled, style]}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor, borderColor: tokens.colors.line }]}>
        <Animated.View style={[styles.knob, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  hit: { height: 44, justifyContent: 'center' },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    borderWidth: StyleSheet.hairlineWidth,
    padding: PAD,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  disabled: { opacity: 0.5 },
});

export default Switch;
