import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export interface SelectOption<T extends string | number> {
  label: string;
  value: T;
}

interface SelectProps<T extends string | number> {
  label?: string;
  value: T;
  onValueChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  error?: boolean;
  helperText?: string;
}

function Select<T extends string | number>({
  label,
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  error = false,
  helperText,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);
  const isPlaceholder = !selected || selected.value === '';
  const displayLabel = !selected || selected.value === '' ? placeholder : selected.label;

  // Options the user can actually pick (exclude an empty-value sentinel like "Select Type...").
  const selectableOptions = options.filter((o) => o.value !== '');

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, error ? styles.labelError : styles.labelDefault]}>
          {label}
        </Text>
      )}

      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, error ? styles.fieldError : styles.fieldDefault]}
      >
        <Text style={[styles.value, isPlaceholder ? styles.valuePlaceholder : styles.valueSelected]}>
          {displayLabel}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#777777" />
      </Pressable>

      {helperText && (
        <Text style={[styles.helper, error ? styles.helperError : styles.helperDefault]}>
          {helperText}
        </Text>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handleWrapper}>
              <View style={styles.handle} />
            </View>
            {label && (
              <Text style={styles.sheetTitle}>{label}</Text>
            )}
            <ScrollView style={styles.list}>
              {selectableOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={String(option.value)}
                    onPress={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                    style={styles.option}
                  >
                    <Text style={[styles.optionText, isSelected ? styles.optionTextSelected : styles.optionTextDefault]}>
                      {option.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 6,
  },
  labelDefault: {
    color: colors.dark,
  },
  labelError: {
    color: colors.danger,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldDefault: {
    borderColor: '#E5E7EB',
  },
  fieldError: {
    borderColor: colors.danger,
  },
  value: {
    fontSize: 14,
    lineHeight: 20,
  },
  valuePlaceholder: {
    color: '#9CA3AF',
  },
  valueSelected: {
    color: colors.dark,
  },
  helper: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    marginLeft: 2,
  },
  helperDefault: {
    color: '#6B7280',
  },
  helperError: {
    color: colors.danger,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  handleWrapper: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 9999,
    backgroundColor: '#D1D5DB',
  },
  sheetTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: colors.dark,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  list: {
    maxHeight: 320,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  optionTextDefault: {
    color: colors.dark,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default Select;
