// 44x44 icon-only button on a surface tile (surface fill + line border).
// `tone` recolors the icon for accent/amber/danger actions. Always pass an
// accessibilityLabel: there is no visible text.
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';

export type IconButtonTone = 'default' | 'accent' | 'amber' | 'danger';

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  onPress?: () => void;
  tone?: IconButtonTone;
  disabled?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const IconButton: React.FC<IconButtonProps> = ({
  icon,
  accessibilityLabel,
  onPress,
  tone = 'default',
  disabled = false,
  size = 20,
  style,
  testID,
}) => {
  const { tokens } = useTheme();
  const color =
    tone === 'accent'
      ? tokens.colors.accent
      : tone === 'amber'
        ? tokens.colors.amberText
        : tone === 'danger'
          ? tokens.colors.bad
          : tokens.colors.icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: tokens.radius.md,
          backgroundColor: pressed ? tokens.colors.wash2 : tokens.colors.surface,
          borderColor: tokens.colors.line,
        },
        disabled && styles.disabled,
        style,
      ]}
      testID={testID}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    width: 44,
    height: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
});

export default IconButton;
