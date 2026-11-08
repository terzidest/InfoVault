// Template glyph on a rounded square tinted with the template colour (14%
// fill). `md`/`lg` add a soft halo behind the tile: RN has no blur filter,
// so a larger, low-alpha circle approximates the design's glow. Decorative:
// hidden from assistive tech (the row/card it sits in carries the label).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/useTheme';
import type { TemplateId } from '../../../types/models';
import { TEMPLATE_ICONS, hexAlpha } from './recordUi';

export type TemplateIconSize = 'sm' | 'md' | 'lg';

interface TemplateIconProps {
  template: TemplateId;
  size?: TemplateIconSize;
}

interface Metrics {
  box: number;
  glyph: number;
  radius: number;
}

const METRICS: Record<TemplateIconSize, Metrics> = {
  sm: { box: 34, glyph: 16, radius: 11 },
  md: { box: 42, glyph: 20, radius: 13 },
  lg: { box: 58, glyph: 28, radius: 18 },
};

const HALO_SCALE = 1.45;

const TemplateIcon: React.FC<TemplateIconProps> = ({ template, size = 'md' }) => {
  const { tokens } = useTheme();
  const tint = tokens.colors.tints[template];
  const { box, glyph, radius } = METRICS[size];
  const halo = box * HALO_SCALE;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.root, { width: box, height: box }]}
    >
      {size !== 'sm' ? (
        <View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              width: halo,
              height: halo,
              borderRadius: halo / 2,
              top: (box - halo) / 2,
              left: (box - halo) / 2,
              backgroundColor: hexAlpha(tint, 0.12),
            },
          ]}
        />
      ) : null}
      <View style={[styles.tile, { width: box, height: box, borderRadius: radius, backgroundColor: hexAlpha(tint, 0.14) }]}>
        <Ionicons name={TEMPLATE_ICONS[template]} size={glyph} color={tint} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  tile: { alignItems: 'center', justifyContent: 'center' },
});

export default TemplateIcon;
