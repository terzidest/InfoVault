// One editor for new and existing records. A template seeds the fields (and
// can be switched freely until something has been typed); each field row
// edits label, value and kind, can be reordered, removed, or filled from the
// password generator. Saving goes through recordsStore, which validates the
// shape and the 64 KB size cap and seals the whole vault.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import useAuthStore from '../store/authStore';
import useRecordsStore, { RecordTooLargeError } from '../store/recordsStore';
import { useTheme } from '../theme/useTheme';
import { ActionButton, BarTitle, Eyebrow, RowTitle, Screen, Secondary, TextField } from '../components/ui';
import {
  FieldEditorRow,
  GeneratorSheet,
  TagEditor,
  TemplateChips,
  allValuesEmpty,
  moveField,
  validateDraft,
} from '../components/features/records';
import { generateSecureId } from '../utils/crypto';
import { TEMPLATES, templateSeeds } from '../utils/records';
import type { ScreenProps } from '../types/navigation';
import type { Field, TemplateId, VaultRecord } from '../types/models';

interface Draft {
  title: string;
  template: TemplateId;
  fields: Field[];
  tags: string[];
}

const draftFrom = (record: VaultRecord | undefined, template: TemplateId): Draft =>
  record
    ? { title: record.title, template: record.template, fields: record.fields.map((f) => ({ ...f })), tags: [...record.tags] }
    : { title: '', template, fields: templateSeeds(template, generateSecureId), tags: [] };

const AddEditRecordScreen: React.FC<ScreenProps<'AddEditRecord'>> = ({ navigation, route }) => {
  const id = route.params?.id;
  const { tokens } = useTheme();
  const add = useRecordsStore((s) => s.add);
  const update = useRecordsStore((s) => s.update);
  const updateLastActive = useAuthStore((s) => s.updateLastActive);

  // The draft is seeded once from the store; later store changes (another
  // screen cannot edit meanwhile) are not pulled in under the user's typing.
  const [draft, setDraft] = useState<Draft>(() =>
    draftFrom(id ? useRecordsStore.getState().getById(id) : undefined, route.params?.template ?? 'login')
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Id of the secret field the generator sheet is open for.
  const [generatorFor, setGeneratorFor] = useState<string | null>(null);

  const editing = id !== undefined;

  const patch = (changes: Partial<Draft>) => {
    setError(null);
    setDraft((d) => ({ ...d, ...changes }));
  };

  // Functional updates: a keystroke and a generator pick must never clobber
  // each other by both starting from the same stale field list.
  const patchFields = (fn: (fields: Field[]) => Field[]) => {
    setError(null);
    setDraft((d) => ({ ...d, fields: fn(d.fields) }));
  };

  // Switching the template replaces the field list only while it is still
  // untouched; otherwise the icon changes and the fields stay.
  const changeTemplate = (template: TemplateId) => {
    setDraft((d) => ({
      ...d,
      template,
      fields: allValuesEmpty(d.fields) ? templateSeeds(template, generateSecureId) : d.fields,
    }));
  };

  const changeField = (next: Field) => patchFields((fields) => fields.map((f) => (f.id === next.id ? next : f)));
  const removeField = (fieldId: string) => patchFields((fields) => fields.filter((f) => f.id !== fieldId));
  const addField = () => {
    const field: Field = { id: generateSecureId(), label: '', value: '', kind: 'text' };
    patchFields((fields) => [...fields, field]);
  };
  const move = (index: number, direction: -1 | 1) => patchFields((fields) => moveField(fields, index, direction));

  const pickGenerated = (value: string) => {
    const target = generatorFor;
    if (target !== null) {
      patchFields((fields) => fields.map((f) => (f.id === target ? { ...f, value } : f)));
    }
    setGeneratorFor(null);
  };

  const save = async () => {
    if (saving) return;
    updateLastActive();
    const problem = validateDraft(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    const input = { title: draft.title.trim(), template: draft.template, fields: draft.fields, tags: draft.tags };
    try {
      if (editing) {
        await update(id, input);
        navigation.goBack();
      } else {
        const created = await add({ ...input, pinned: false });
        navigation.replace('Record', { id: created.id });
      }
    } catch (e) {
      setSaving(false);
      setError(e instanceof RecordTooLargeError ? 'This record is too large (64 KB limit)' : 'Could not save the record');
    }
  };

  return (
    <Screen>
      <View style={[styles.topRow, { paddingHorizontal: tokens.spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
        >
          <RowTitle color={tokens.colors.accent}>Cancel</RowTitle>
        </Pressable>
        <BarTitle style={styles.barTitle}>{editing ? 'Edit record' : 'New record'}</BarTitle>
        <View style={styles.topButton} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: tokens.spacing.xxxl }}
        >
          {editing ? (
            <Eyebrow style={{ paddingHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.sm }}>
              {TEMPLATES[draft.template].label}
            </Eyebrow>
          ) : (
            <TemplateChips value={draft.template} onChange={changeTemplate} />
          )}

          <View style={{ paddingHorizontal: tokens.spacing.lg }}>
            <TextField
              label="Title"
              value={draft.title}
              onChangeText={(title) => patch({ title })}
              placeholder="What is this?"
              autoCapitalize="sentences"
              returnKeyType="next"
              style={{ marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.xl }}
            />

            <View style={[styles.sectionRow, { marginBottom: tokens.spacing.sm }]}>
              <Eyebrow>Fields</Eyebrow>
              {draft.fields.length > 1 ? <Secondary color={tokens.colors.quiet}>↑↓ to reorder</Secondary> : null}
            </View>
            <View style={{ gap: tokens.spacing.md }}>
              {draft.fields.map((field, index) => (
                <FieldEditorRow
                  key={field.id}
                  field={field}
                  onChange={changeField}
                  onRemove={() => removeField(field.id)}
                  onMoveUp={index > 0 ? () => move(index, -1) : undefined}
                  onMoveDown={index < draft.fields.length - 1 ? () => move(index, 1) : undefined}
                  onGenerate={() => setGeneratorFor(field.id)}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a field"
                onPress={addField}
                style={({ pressed }) => [
                  styles.addField,
                  {
                    borderColor: tokens.colors.line,
                    borderRadius: tokens.radius.lg,
                    backgroundColor: pressed ? tokens.colors.wash : 'transparent',
                  },
                ]}
              >
                <Ionicons name="add" size={18} color={tokens.colors.muted} />
                <Secondary style={{ marginLeft: tokens.spacing.xs }}>Add a field</Secondary>
              </Pressable>
            </View>

            <Eyebrow style={{ marginTop: tokens.spacing.xl, marginBottom: tokens.spacing.sm }}>Tags</Eyebrow>
            <TagEditor tags={draft.tags} onChange={(tags) => patch({ tags })} />

            {error ? (
              <Secondary color={tokens.colors.bad} accessibilityLiveRegion="polite" style={{ marginTop: tokens.spacing.lg }}>
                {error}
              </Secondary>
            ) : null}

            <ActionButton
              title={editing ? 'Save changes' : 'Save'}
              variant="teal"
              loading={saving}
              onPress={() => {
                save().catch(() => {});
              }}
              style={{ marginTop: tokens.spacing.xl }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <GeneratorSheet visible={generatorFor !== null} onClose={() => setGeneratorFor(null)} onPick={pickGenerated} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
  },
  topButton: {
    width: 80,
    height: 44,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  barTitle: { flex: 1, textAlign: 'center' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});

export default AddEditRecordScreen;
