// Read-only field on the record detail screen: a surface card with the label
// and kind tag up top, the value rendered per kind, and trailing actions.
// Secrets start masked; revealing them turns the card amber and starts a
// 10 s countdown after which they re-mask. Copying goes through the
// clearing clipboard (copySensitive) unless the parent supplies `onCopy`.
import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../../theme/useTheme';
import { rgba } from '../../../theme/tokens';
import type { Rgb } from '../../../theme/tokens';
import { Body, IconButton, Kind, Label, Mono, Secondary } from '../../ui';
import { copySensitive } from '../../../services/clipboard';
import { formatDate } from '../../../utils/formatters';
import { expiryState, groupDigits } from '../../../utils/records';
import type { Field } from '../../../types/models';
import { expiryBadge, isExpiryField, normalizeUrl } from './recordUi';
import type { BadgeTone } from './recordUi';
import { useAutoHide } from './useAutoHide';

export const REVEAL_MS = 10_000;

// Fixed-width mask: the dot count must not leak the secret's length.
const MASK = '••••••••';

interface FieldValueProps {
  field: Field;
  /** Override the copy action (defaults to the clearing clipboard). */
  onCopy?: (value: string) => void;
}

interface PillProps {
  label: string;
  tone: BadgeTone;
}

const Pill: React.FC<PillProps> = ({ label, tone }) => {
  const { tokens } = useTheme();
  const rgb: Rgb = tone === 'ok' ? tokens.colors.okRgb : tone === 'amber' ? tokens.colors.amberRgb : tokens.colors.badRgb;
  const text = tone === 'ok' ? tokens.colors.ok : tone === 'amber' ? tokens.colors.amberText : tokens.colors.bad;
  return (
    <View
      style={[
        styles.pill,
        { borderRadius: tokens.radius.pill, backgroundColor: rgba(rgb, 0.12), borderColor: rgba(rgb, 0.35) },
      ]}
    >
      <Kind color={text}>{label}</Kind>
    </View>
  );
};

const openUrl = (raw: string): void => {
  const url = normalizeUrl(raw);
  if (url === null) return;
  Linking.canOpenURL(url)
    .then((ok) => (ok ? Linking.openURL(url) : undefined))
    .catch(() => {});
};

const FieldValue: React.FC<FieldValueProps> = ({ field, onCopy }) => {
  const { tokens } = useTheme();
  const { revealed, remainingSeconds, reveal, hide } = useAutoHide(REVEAL_MS);

  const isSecret = field.kind === 'secret';
  const isEmpty = field.value.trim() === '';
  const showingSecret = isSecret && revealed;
  const canCopy = !isEmpty && field.kind !== 'multiline';

  const copy = () => {
    if (onCopy) onCopy(field.value);
    else copySensitive(field.value).catch(() => {});
  };

  const renderValue = (): React.ReactNode => {
    if (isEmpty) return <Secondary color={tokens.colors.quiet}>Empty</Secondary>;
    switch (field.kind) {
      case 'secret':
        return revealed ? (
          <Mono variant="secret" tone="amber">
            {field.value}
          </Mono>
        ) : (
          <Mono variant="secret" color={tokens.colors.muted} accessibilityLabel="Hidden value">
            {MASK}
          </Mono>
        );
      case 'number':
        return <Mono variant="number">{groupDigits(field.value)}</Mono>;
      case 'date': {
        const formatted = formatDate(field.value, 'medium');
        const badge = isExpiryField(field.label) ? expiryBadge(expiryState(field.value)) : null;
        return (
          <View style={styles.dateRow}>
            <Body>{formatted === '' ? field.value : formatted}</Body>
            {badge ? <Pill label={badge.label} tone={badge.tone} /> : null}
          </View>
        );
      }
      case 'url':
        return (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${field.value}`}
            onPress={() => openUrl(field.value)}
            hitSlop={8}
            style={styles.link}
          >
            <Body color={tokens.colors.accent} numberOfLines={2}>
              {field.value}
            </Body>
          </Pressable>
        );
      case 'text':
      case 'multiline':
        return <Body>{field.value}</Body>;
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.colors.surface,
          borderColor: showingSecret ? rgba(tokens.colors.amberRgb, 0.45) : tokens.colors.line,
          borderRadius: tokens.radius.lg,
          padding: tokens.spacing.md,
        },
      ]}
    >
      <View style={styles.header}>
        <Label numberOfLines={1} style={styles.label}>
          {field.label}
        </Label>
        <Kind>{field.kind}</Kind>
        {showingSecret ? (
          <Kind color={tokens.colors.amberText} style={{ marginLeft: tokens.spacing.sm }} accessibilityLiveRegion="polite">
            {`Hides in ${remainingSeconds} s`}
          </Kind>
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.value}>{renderValue()}</View>
        {isSecret || canCopy ? (
          <View style={[styles.actions, { gap: tokens.spacing.sm }]}>
            {isSecret && !isEmpty ? (
              <IconButton
                icon={revealed ? 'eye-off-outline' : 'eye-outline'}
                accessibilityLabel={revealed ? `Hide ${field.label}` : `Reveal ${field.label}`}
                tone={revealed ? 'amber' : 'default'}
                onPress={revealed ? hide : reveal}
              />
            ) : null}
            {canCopy ? (
              <IconButton icon="copy-outline" accessibilityLabel={`Copy ${field.label}`} onPress={copy} />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  label: { marginRight: 8, flexShrink: 1 },
  body: { flexDirection: 'row', alignItems: 'center' },
  value: { flex: 1, justifyContent: 'center', minHeight: 28 },
  actions: { flexDirection: 'row', marginLeft: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  link: { minHeight: 44, justifyContent: 'center' },
  pill: { borderWidth: 1, paddingHorizontal: 8, height: 20, justifyContent: 'center' },
});

export default FieldValue;
