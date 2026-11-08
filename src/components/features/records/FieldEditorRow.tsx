// One editable field in the record editor: a decorative drag handle, label
// and value inputs, a kind pill that cycles through the kinds on tap, an
// optional generator button for secrets, and remove / move up / move down.
// Values are shown in clear here (the editor is where you type them), in
// the mono face for numbers and secrets. Reorder gestures come later —
// today reordering is the up/down buttons when the callbacks exist.
import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/useTheme';
import { IconButton, Kind } from '../../ui';
import type { Field } from '../../../types/models';
import { isMonoKind, kindCycle } from './recordUi';

interface FieldEditorRowProps {
  field: Field;
  onChange: (field: Field) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** Shown only for `secret` fields: opens the password generator. */
  onGenerate?: () => void;
}

const FieldEditorRow: React.FC<FieldEditorRowProps> = ({ field, onChange, onRemove, onMoveUp, onMoveDown, onGenerate }) => {
  const { tokens } = useTheme();
  const mono = isMonoKind(field.kind);
  const hasMoves = onMoveUp !== undefined || onMoveDown !== undefined;
  const labelOrFallback = field.label.trim() === '' ? 'field' : field.label;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.colors.surface,
          borderColor: tokens.colors.line,
          borderRadius: tokens.radius.lg,
          padding: tokens.spacing.md,
        },
      ]}
    >
      <View style={styles.row}>
        <Ionicons
          name="reorder-three-outline"
          size={20}
          color={tokens.colors.faint}
          style={styles.handle}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <TextInput
          value={field.label}
          onChangeText={(label) => onChange({ ...field, label })}
          placeholder="Label"
          placeholderTextColor={tokens.colors.quiet}
          selectionColor={tokens.colors.accent}
          accessibilityLabel="Field label"
          autoCapitalize="sentences"
          returnKeyType="next"
          style={[styles.labelInput, { color: tokens.colors.muted, fontFamily: tokens.type.label.fontFamily }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Field kind: ${field.kind}, tap to change`}
          onPress={() => onChange({ ...field, kind: kindCycle(field.kind) })}
          hitSlop={8}
          style={styles.kindHit}
        >
          {({ pressed }) => (
            <View
              style={[
                styles.kindPill,
                {
                  borderRadius: tokens.radius.pill,
                  borderColor: tokens.colors.line,
                  backgroundColor: pressed ? tokens.colors.wash2 : tokens.colors.wash,
                },
              ]}
            >
              <Kind color={tokens.colors.muted}>{field.kind}</Kind>
            </View>
          )}
        </Pressable>
      </View>

      <TextInput
        value={field.value}
        onChangeText={(value) => onChange({ ...field, value })}
        placeholder="Value"
        placeholderTextColor={tokens.colors.quiet}
        selectionColor={tokens.colors.accent}
        accessibilityLabel={`${labelOrFallback} value`}
        multiline={field.kind === 'multiline'}
        autoCapitalize="none"
        autoCorrect={field.kind === 'text' || field.kind === 'multiline'}
        keyboardType={field.kind === 'number' ? 'numbers-and-punctuation' : field.kind === 'url' ? 'url' : 'default'}
        style={[
          styles.valueInput,
          mono ? tokens.type.monoValue : tokens.type.body,
          field.kind === 'multiline' ? styles.multiline : styles.singleLine,
          { color: tokens.colors.text, borderColor: tokens.colors.line2 },
        ]}
      />

      <View style={[styles.actions, { gap: tokens.spacing.sm }]}>
        {hasMoves ? (
          <>
            <IconButton icon="chevron-up" accessibilityLabel="Move field up" onPress={onMoveUp} disabled={!onMoveUp} />
            <IconButton icon="chevron-down" accessibilityLabel="Move field down" onPress={onMoveDown} disabled={!onMoveDown} />
          </>
        ) : null}
        <View style={styles.spacer} />
        {field.kind === 'secret' && onGenerate ? (
          <IconButton icon="sparkles-outline" accessibilityLabel="Generate password" tone="amber" onPress={onGenerate} />
        ) : null}
        <IconButton icon="trash-outline" accessibilityLabel={`Remove ${labelOrFallback}`} tone="danger" onPress={onRemove} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  handle: { marginRight: 8 },
  labelInput: {
    flex: 1,
    fontSize: 12,
    height: 44,
    paddingVertical: 0,
    paddingHorizontal: 4,
  },
  kindHit: { minHeight: 44, justifyContent: 'center', marginLeft: 8 },
  kindPill: { height: 24, paddingHorizontal: 10, borderWidth: 1, justifyContent: 'center' },
  valueInput: {
    paddingHorizontal: 4,
    marginTop: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  singleLine: { height: 44, paddingVertical: 0, lineHeight: undefined },
  multiline: { minHeight: 72, paddingTop: 10, paddingBottom: 10, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  spacer: { flex: 1 },
});

export default FieldEditorRow;
