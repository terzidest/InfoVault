import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const displayLabel = !isPlaceholder ? selected!.label : placeholder;

  // Options the user can actually pick (exclude an empty-value sentinel like "Select Type...").
  const selectableOptions = options.filter((o) => o.value !== '');

  return (
    <View className="mb-4">
      {label && (
        <Text className={`text-sm font-medium ${error ? 'text-danger' : 'text-dark'} mb-1.5`}>
          {label}
        </Text>
      )}

      <Pressable
        onPress={() => setOpen(true)}
        className={`
          flex-row items-center justify-between bg-gray-100 border rounded-lg px-3 py-2.5
          ${error ? 'border-danger' : 'border-gray-200'}
        `}
      >
        <Text className={`text-sm ${isPlaceholder ? 'text-gray-400' : 'text-dark'}`}>
          {displayLabel}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#777777" />
      </Pressable>

      {helperText && (
        <Text className={`text-xs mt-1 ml-0.5 ${error ? 'text-danger' : 'text-gray-500'}`}>
          {helperText}
        </Text>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setOpen(false)}>
          <Pressable className="bg-white rounded-t-2xl pt-2 pb-6" onPress={(e) => e.stopPropagation()}>
            <View className="items-center py-2">
              <View className="w-10 h-1 rounded-full bg-gray-300" />
            </View>
            {label && (
              <Text className="text-base font-semibold text-dark px-4 py-2">{label}</Text>
            )}
            <ScrollView className="max-h-80">
              {selectableOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={String(option.value)}
                    onPress={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                    className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100"
                  >
                    <Text className={`text-base ${isSelected ? 'text-primary font-semibold' : 'text-dark'}`}>
                      {option.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color="#006E90" />}
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

export default Select;
