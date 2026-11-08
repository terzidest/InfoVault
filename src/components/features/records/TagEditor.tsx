// Tag list for the record editor: existing tags as removable `Tag` pills
// plus a dashed "+ tag" button that swaps in a small inline input. Tags are
// normalised (trimmed, lowercased, deduped, capped) by `addTag`.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../../theme/useTheme';
import { fontFamily } from '../../../theme/tokens';
import { Tag } from '../../ui';
import { MAX_TAG_LENGTH, addTag } from './recordUi';

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

const TagEditor: React.FC<TagEditorProps> = ({ tags, onChange }) => {
  const { tokens } = useTheme();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = () => {
    const next = addTag(tags, draft);
    if (next.length !== tags.length) onChange(next);
    setDraft('');
    setAdding(false);
  };

  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <View style={[styles.wrap, { gap: tokens.spacing.sm }]} accessibilityLabel="Tags">
      {tags.map((tag) => (
        <Tag key={tag} label={tag} onRemove={() => remove(tag)} />
      ))}
      {adding ? (
        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          onBlur={commit}
          maxLength={MAX_TAG_LENGTH}
          placeholder="tag"
          placeholderTextColor={tokens.colors.quiet}
          selectionColor={tokens.colors.accent}
          accessibilityLabel="New tag"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          blurOnSubmit
          style={[
            styles.input,
            {
              color: tokens.colors.accent,
              borderColor: tokens.colors.accent,
              borderRadius: tokens.radius.pill,
            },
          ]}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add tag"
          onPress={() => setAdding(true)}
          hitSlop={10}
          style={({ pressed }) => [
            styles.add,
            {
              borderRadius: tokens.radius.pill,
              borderColor: tokens.colors.line,
              backgroundColor: pressed ? tokens.colors.wash2 : 'transparent',
            },
          ]}
        >
          <Text style={[styles.addText, { color: tokens.colors.muted }]}>+ tag</Text>
        </Pressable>
      )}
    </View>
  );
};

const PILL_TEXT = {
  fontFamily: fontFamily.mono400,
  fontSize: 10.5,
  letterSpacing: 0.8,
} as const;

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  add: {
    height: 24,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
  },
  addText: { ...PILL_TEXT, lineHeight: 14 },
  input: {
    ...PILL_TEXT,
    height: 24,
    minWidth: 88,
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});

export default TagEditor;
