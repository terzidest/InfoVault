// Password generator in a bottom Sheet: length (12 / 16 / 24), four
// character-class switches (the last enabled one locks), a mono preview of
// the current candidate, Regenerate and Use this. Candidates come from
// generatePassword (expo-crypto CSPRNG). The candidate lives only in this
// component's state and is dropped when the sheet closes; it is never logged.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/useTheme';
import { ActionButton, ListRow, Mono, Segmented, Sheet, Switch } from '../../ui';
import type { SegmentedOption } from '../../ui';
import { generatePassword } from '../../../utils/password';
import {
  CHAR_CLASS_LABELS,
  CHAR_CLASS_ORDER,
  GENERATOR_LENGTHS,
  isLastEnabledClass,
  toggleCharClass,
} from './recordUi';
import type { CharClasses, GeneratorLength } from './recordUi';

interface GeneratorSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (value: string) => void;
}

const LENGTH_OPTIONS: SegmentedOption<GeneratorLength>[] = GENERATOR_LENGTHS.map((value) => ({ value, label: value }));

const ALL_CLASSES: CharClasses = { upper: true, lower: true, digits: true, symbols: true };

const GeneratorSheet: React.FC<GeneratorSheetProps> = ({ visible, onClose, onPick }) => {
  const { tokens } = useTheme();
  const [length, setLength] = useState<GeneratorLength>('16');
  const [classes, setClasses] = useState<CharClasses>(ALL_CLASSES);
  const [candidate, setCandidate] = useState('');
  // Bumped by "Regenerate" to re-run the effect with unchanged settings.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    generatePassword(Number(length), classes)
      .then((value) => {
        if (!cancelled) setCandidate(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, length, classes, nonce]);

  // Drop the candidate as soon as the sheet goes away, on either exit path.
  const close = () => {
    setCandidate('');
    onClose();
  };

  const pick = () => {
    if (candidate === '') return;
    const value = candidate;
    setCandidate('');
    onPick(value);
  };

  return (
    <Sheet visible={visible} onClose={close} title="Generate password">
      <Segmented options={LENGTH_OPTIONS} value={length} onChange={setLength} accessibilityLabel="Length" />

      <View style={[styles.classes, { marginTop: tokens.spacing.lg }]}>
        {CHAR_CLASS_ORDER.map((key, i) => (
          <ListRow
            key={key}
            title={CHAR_CLASS_LABELS[key]}
            divider={i > 0}
            style={styles.row}
            trailing={
              <Switch
                value={classes[key]}
                disabled={isLastEnabledClass(classes, key)}
                onValueChange={() => setClasses((current) => toggleCharClass(current, key))}
                accessibilityLabel={CHAR_CLASS_LABELS[key]}
              />
            }
          />
        ))}
      </View>

      <View
        style={[
          styles.preview,
          {
            backgroundColor: tokens.colors.surface,
            borderColor: tokens.colors.line,
            borderRadius: tokens.radius.lg,
            padding: tokens.spacing.lg,
            marginTop: tokens.spacing.lg,
          },
        ]}
        accessibilityLabel="Generated password"
        accessibilityLiveRegion="polite"
      >
        <Mono variant="secret" style={styles.previewText}>
          {candidate === '' ? '…' : candidate}
        </Mono>
      </View>

      <View style={[styles.buttons, { marginTop: tokens.spacing.lg, gap: tokens.spacing.md }]}>
        <ActionButton
          title="Regenerate"
          variant="text"
          onPress={() => setNonce((n) => n + 1)}
          leading={<Ionicons name="refresh-outline" size={18} color={tokens.colors.accent} />}
        />
        <ActionButton title="Use this" variant="teal" onPress={pick} disabled={candidate === ''} style={styles.use} />
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  classes: {},
  row: { paddingHorizontal: 0 },
  preview: { borderWidth: 1, alignItems: 'center' },
  previewText: { textAlign: 'center' },
  buttons: { flexDirection: 'row', alignItems: 'center' },
  use: { flex: 1 },
});

export default GeneratorSheet;
