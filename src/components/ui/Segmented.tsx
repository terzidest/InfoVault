// Segmented control: equal-width options on a wash track with a sliding
// highlight (220ms). Generic over the option value type.
import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { easing } from '../../theme/tokens';

const PAD = 3;
const DURATION = 220;

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const Segmented = <T extends string>({ options, value, onChange, accessibilityLabel, style }: SegmentedProps<T>) => {
  const { tokens, scheme } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  // Lazy state initializer: a stable Animated.Value without reading a ref in render.
  const [position] = useState(() => new Animated.Value(index));

  useEffect(() => {
    Animated.timing(position, { toValue: index, duration: DURATION, easing, useNativeDriver: true }).start();
  }, [index, position]);

  const segmentWidth = options.length > 0 ? (trackWidth - PAD * 2) / options.length : 0;
  const translateX = Animated.multiply(position, segmentWidth);

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      style={[
        styles.track,
        { borderRadius: tokens.radius.sm, backgroundColor: tokens.colors.wash, borderColor: tokens.colors.line2 },
        style,
      ]}
    >
      {trackWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.highlight,
            scheme === 'light' ? tokens.shadows.elevation : null,
            {
              width: segmentWidth,
              borderRadius: tokens.radius.sm - PAD,
              backgroundColor: tokens.colors.segmentHighlight,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={styles.segment}
          >
            <Text
              numberOfLines={1}
              style={[tokens.type.label, { color: selected ? tokens.colors.text : tokens.colors.muted }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: PAD,
    borderWidth: 1,
    height: 44,
  },
  highlight: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Segmented;
