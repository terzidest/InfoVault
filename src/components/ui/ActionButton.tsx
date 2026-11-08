// Primary call-to-action button. `teal` and `amber` are gradient-filled with
// a matching glow; `ghostDanger` is an outlined destructive action; `text`
// is a bare label. Press scales to 0.98 over motion.press.
import React, { useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/useTheme';
import { easing, rgba } from '../../theme/tokens';

export type ActionButtonVariant = 'teal' | 'amber' | 'ghostDanger' | 'text';

interface ActionButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ActionButtonVariant;
  size?: 'default' | 'compact';
  loading?: boolean;
  disabled?: boolean;
  /** Icon rendered before the title. */
  leading?: React.ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  title,
  onPress,
  variant = 'teal',
  size = 'default',
  loading = false,
  disabled = false,
  leading,
  accessibilityLabel,
  style,
  testID,
}) => {
  const { tokens } = useTheme();
  // Lazy state initializer: a stable Animated.Value without reading a ref in render.
  const [scale] = useState(() => new Animated.Value(1));
  const inactive = disabled || loading;
  const height = size === 'compact' ? 44 : 52;

  const animateTo = (value: number) => {
    Animated.timing(scale, {
      toValue: value,
      duration: tokens.motion.press,
      easing,
      useNativeDriver: true,
    }).start();
  };

  const textColor =
    variant === 'teal'
      ? tokens.colors.onTeal
      : variant === 'amber'
        ? tokens.colors.onAmber
        : variant === 'ghostDanger'
          ? tokens.colors.bad
          : tokens.colors.accent;

  const gradient =
    variant === 'teal' ? tokens.gradients.buttonTeal : variant === 'amber' ? tokens.gradients.buttonAmber : null;

  const glow =
    variant === 'teal' ? tokens.shadows.glowTeal : variant === 'amber' ? tokens.shadows.glowAmber : null;

  const frame: ViewStyle = {
    height,
    borderRadius: tokens.radius.lg,
    ...(variant === 'ghostDanger'
      ? { borderWidth: 1, borderColor: rgba(tokens.colors.badRgb, 0.35), backgroundColor: 'transparent' }
      : {}),
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, inactive && styles.disabled, glow, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={onPress}
        onPressIn={() => animateTo(0.98)}
        onPressOut={() => animateTo(1)}
        style={[styles.pressable, frame]}
        testID={testID}
      >
        {gradient ? (
          <LinearGradient
            colors={gradient.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: tokens.radius.lg }]}
          />
        ) : null}
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <View style={styles.content}>
            {leading ? <View style={{ marginRight: tokens.spacing.sm }}>{leading}</View> : null}
            <Text style={[tokens.type.rowTitle, { color: textColor }]}>{title}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 20,
  },
  content: { flexDirection: 'row', alignItems: 'center' },
  disabled: { opacity: 0.5 },
});

export default ActionButton;
