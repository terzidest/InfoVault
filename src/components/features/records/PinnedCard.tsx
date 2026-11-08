// Pinned record tile for the Home strip: 150 wide surface card with the
// template icon, an amber star, title and one-line subtitle, and a soft
// corner glow in the template tint. Press scales to 0.98 and lifts 2px.
import React, { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/useTheme';
import { easing } from '../../../theme/tokens';
import { Mono, RowTitle, Secondary } from '../../ui';
import { subtitleFor } from '../../../utils/records';
import type { VaultRecord } from '../../../types/models';
import TemplateIcon from './TemplateIcon';
import { subtitleIsMono } from './recordUi';

export const PINNED_CARD_WIDTH = 150;
const GLOW = 110;

interface PinnedCardProps {
  record: VaultRecord;
  onPress: (record: VaultRecord) => void;
  testID?: string;
}

const PinnedCard: React.FC<PinnedCardProps> = ({ record, onPress, testID }) => {
  const { tokens, scheme } = useTheme();
  // Lazy state initializer: a stable Animated.Value without reading a ref in render.
  const [scale] = useState(() => new Animated.Value(1));
  const translateY = scale.interpolate({ inputRange: [0.98, 1], outputRange: [-2, 0] });
  const subtitle = subtitleFor(record);
  const mono = subtitleIsMono(record);

  const animateTo = (value: number) => {
    Animated.timing(scale, { toValue: value, duration: tokens.motion.press, easing, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[styles.frame, scheme === 'light' ? tokens.shadows.elevation : null, { transform: [{ scale }, { translateY }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${record.title}, ${subtitle}, pinned`}
        onPress={() => onPress(record)}
        onPressIn={() => animateTo(0.98)}
        onPressOut={() => animateTo(1)}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: pressed ? tokens.colors.wash2 : tokens.colors.surface,
            borderColor: tokens.colors.line,
            borderRadius: tokens.radius.xl,
            padding: tokens.spacing.md,
          },
        ]}
        testID={testID}
      >
        <View pointerEvents="none" style={[styles.glow, { backgroundColor: tokens.colors.tints[record.template] }]} />
        <View style={styles.top}>
          <TemplateIcon template={record.template} size="sm" />
          <Ionicons name="star" size={14} color={tokens.colors.amber} />
        </View>
        <RowTitle numberOfLines={1}>{record.title}</RowTitle>
        {mono ? (
          <Mono variant="value" color={tokens.colors.muted} numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Mono>
        ) : (
          <Secondary numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Secondary>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  frame: { width: PINNED_CARD_WIDTH },
  card: { borderWidth: 1, overflow: 'hidden', minHeight: 112 },
  glow: {
    position: 'absolute',
    width: GLOW,
    height: GLOW,
    borderRadius: GLOW / 2,
    right: -GLOW * 0.35,
    bottom: -GLOW * 0.45,
    opacity: 0.16,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  subtitle: { marginTop: 2 },
});

export default PinnedCard;
