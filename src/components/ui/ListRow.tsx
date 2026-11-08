// Standard list row (56+ high): optional tinted leading icon tile, title,
// optional subtitle (sans or mono), trailing slot, press wash and an
// optional top divider. Used by record lists and settings.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';

const TILE = 42;

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Render the subtitle in the mono value style (identifiers, usernames). */
  subtitleMono?: boolean;
  /** Ionicons glyph for the leading tile. Requires `tint`. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Icon color; also used at 14% for the tile fill. */
  tint?: string;
  /** Custom leading element (overrides `icon`). */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  divider?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// `#rrggbb` + alpha → `rgba()`. Tints are hex tokens; fall back to the color
// itself for anything else.
const withAlpha = (hex: string, alpha: number): string => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1] ?? '0', 16)},${parseInt(m[2] ?? '0', 16)},${parseInt(m[3] ?? '0', 16)},${alpha})`;
};

const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  subtitleMono = false,
  icon,
  tint,
  leading,
  trailing,
  onPress,
  onLongPress,
  divider = false,
  accessibilityLabel,
  style,
  testID,
}) => {
  const { tokens } = useTheme();
  const tintColor = tint ?? tokens.colors.icon;
  const leadingNode =
    leading ??
    (icon ? (
      <View style={[styles.tile, { backgroundColor: withAlpha(tintColor, 0.14) }]}>
        <Ionicons name={icon} size={20} color={tintColor} />
      </View>
    ) : null);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.colors.line2 },
        pressed && { backgroundColor: tokens.colors.wash },
        style,
      ]}
      testID={testID}
    >
      {leadingNode ? <View style={styles.leading}>{leadingNode}</View> : null}
      <View style={styles.body}>
        <Text numberOfLines={1} style={[tokens.type.rowTitle, { color: tokens.colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={[
              subtitleMono ? tokens.type.monoValue : tokens.type.secondary,
              styles.subtitle,
              { color: tokens.colors.muted },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  leading: { marginRight: 12 },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, justifyContent: 'center' },
  subtitle: { marginTop: 2 },
  trailing: { marginLeft: 12 },
});

export default ListRow;
