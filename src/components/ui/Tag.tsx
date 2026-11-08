// Small accent pill for record tags. Optional `onRemove` renders a "×" that
// is its own 44pt touch target.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fontFamily, rgba } from '../../theme/tokens';

interface TagProps {
  label: string;
  onRemove?: () => void;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const Tag: React.FC<TagProps> = ({ label, onRemove, onPress, style }) => {
  const { tokens } = useTheme();
  const { accent, accentRgb } = tokens.colors;

  return (
    <View
      style={[
        styles.pill,
        {
          borderRadius: tokens.radius.pill,
          backgroundColor: rgba(accentRgb, 0.1),
          borderColor: rgba(accentRgb, 0.25),
          paddingRight: onRemove ? 0 : 10,
        },
        style,
      ]}
    >
      <Pressable accessibilityRole={onPress ? 'button' : 'text'} onPress={onPress} disabled={!onPress}>
        <Text style={[styles.text, { color: accent }]}>{label}</Text>
      </Pressable>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          onPress={onRemove}
          hitSlop={10}
          style={styles.remove}
        >
          <Text style={[styles.removeGlyph, { color: accent }]}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingLeft: 10,
    height: 24,
  },
  text: {
    fontFamily: fontFamily.mono400,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
  remove: {
    height: 24,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeGlyph: { fontSize: 14, lineHeight: 16 },
});

export default Tag;
