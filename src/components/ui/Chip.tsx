// 36-high selectable chip (filters, template pickers). Unselected: surface
// tile. Selected: tinted fill + border + 3px halo in `tone` (ok by default).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { rgba } from '../../theme/tokens';

const HALO = 3;

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'ok' | 'accent';
  leading?: React.ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const Chip: React.FC<ChipProps> = ({ label, selected = false, onPress, tone = 'ok', leading, disabled = false, style }) => {
  const { tokens } = useTheme();
  const rgb = tone === 'accent' ? tokens.colors.accentRgb : tokens.colors.okRgb;
  const solid = tone === 'accent' ? tokens.colors.accent : tokens.colors.ok;

  return (
    <View
      style={[
        styles.halo,
        { borderRadius: tokens.radius.sm + HALO, backgroundColor: selected ? rgba(rgb, 0.1) : 'transparent' },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={onPress}
        hitSlop={{ top: 4, bottom: 4 }}
        style={({ pressed }) => [
          styles.chip,
          {
            borderRadius: tokens.radius.sm,
            backgroundColor: selected ? rgba(rgb, 0.1) : pressed ? tokens.colors.wash2 : tokens.colors.surface,
            borderColor: selected ? rgba(rgb, 0.5) : tokens.colors.line,
          },
          disabled && styles.disabled,
        ]}
      >
        {leading ? <View style={{ marginRight: tokens.spacing.xs + 2 }}>{leading}</View> : null}
        <Text style={[tokens.type.label, { color: selected ? solid : tokens.colors.text2 }]}>{label}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  halo: { padding: HALO, margin: -HALO, alignSelf: 'flex-start' },
  chip: {
    height: 36,
    paddingHorizontal: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
});

export default Chip;
