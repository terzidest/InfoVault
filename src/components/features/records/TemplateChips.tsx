// Horizontal template picker for the editor: one Chip per template (icon +
// label) in the canonical order; the selected one is accent-tinted.
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/useTheme';
import { Chip } from '../../ui';
import { TEMPLATES } from '../../../utils/records';
import type { TemplateId } from '../../../types/models';
import { TEMPLATE_ICONS, TEMPLATE_ORDER } from './recordUi';

// Chip paints a 3px halo outside its bounds; leave room so it is not clipped.
const HALO = 3;

interface TemplateChipsProps {
  value: TemplateId;
  onChange: (template: TemplateId) => void;
}

const TemplateChips: React.FC<TemplateChipsProps> = ({ value, onChange }) => {
  const { tokens } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityRole="radiogroup"
      accessibilityLabel="Template"
      contentContainerStyle={[styles.content, { paddingHorizontal: tokens.spacing.lg, gap: tokens.spacing.sm }]}
    >
      {TEMPLATE_ORDER.map((id) => {
        const selected = id === value;
        return (
          <Chip
            key={id}
            label={TEMPLATES[id].label}
            selected={selected}
            tone="accent"
            onPress={() => onChange(id)}
            leading={
              <Ionicons
                name={TEMPLATE_ICONS[id]}
                size={14}
                color={selected ? tokens.colors.accent : tokens.colors.tints[id]}
              />
            }
          />
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { paddingVertical: HALO, alignItems: 'center' },
});

export default TemplateChips;
