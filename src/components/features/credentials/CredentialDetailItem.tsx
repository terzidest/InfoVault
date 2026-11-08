import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { obfuscateText } from '../../../utils/masking';
import { colors } from '../../../theme/colors';

interface CredentialDetailItemProps {
  label: string;
  value?: string;
  isSensitive?: boolean;
  onCopy?: () => void;
}

const CredentialDetailItem: React.FC<CredentialDetailItemProps> = ({
  label,
  value,
  isSensitive = false,
  onCopy,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);

  const toggleReveal = () => setIsRevealed((prev) => !prev);

  // Auto-hide after 10s. Keyed on isRevealed with cleanup, so re-toggling
  // restarts a single timer and unmounting never fires a stale one.
  useEffect(() => {
    if (!isRevealed) return;
    const timer = setTimeout(() => setIsRevealed(false), 10000);
    return () => clearTimeout(timer);
  }, [isRevealed]);

  const displayValue = isSensitive && !isRevealed ? obfuscateText(value) : value;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {isSensitive && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Sensitive</Text>
          </View>
        )}
      </View>

      <View style={styles.valueRow}>
        <Text
          style={[
            styles.value,
            isSensitive && styles.valueMono,
            !value ? styles.valueEmpty : styles.valueSet,
          ]}
          selectable={!isSensitive || isRevealed}
        >
          {value ? displayValue : 'Not set'}
        </Text>

        <View style={styles.actions}>
          {isSensitive && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={toggleReveal}
              accessibilityRole="button"
              accessibilityLabel={isRevealed ? `Hide ${label}` : `Reveal ${label}`}
            >
              <Ionicons
                name={isRevealed ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}

          {!!value && onCopy && (
            <TouchableOpacity
              style={styles.copyButton}
              onPress={onCopy}
              accessibilityRole="button"
              accessibilityLabel={`Copy ${label}`}
            >
              <Ionicons name="copy-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
    marginRight: 8,
  },
  badge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.dark,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  value: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  valueMono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    letterSpacing: 0.4,
  },
  valueEmpty: {
    fontStyle: 'italic',
    color: '#9CA3AF',
  },
  valueSet: {
    color: colors.dark,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 4,
    marginLeft: 8,
  },
  copyButton: {
    padding: 4,
    marginLeft: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
  },
});

export default CredentialDetailItem;
