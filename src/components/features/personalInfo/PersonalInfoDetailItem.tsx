import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { obfuscateText } from '../../../utils/encryption';

interface PersonalInfoDetailItemProps {
  label: string;
  value?: string;
  isSensitive?: boolean;
  onCopy?: () => void;
}

const PersonalInfoDetailItem: React.FC<PersonalInfoDetailItemProps> = ({
  label,
  value,
  isSensitive = false,
  onCopy,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);

  const toggleReveal = () => {
    setIsRevealed((prev) => !prev);

    if (!isRevealed) {
      setTimeout(() => {
        setIsRevealed(false);
      }, 10000);
    }
  };

  const displayValue = isSensitive && !isRevealed ? obfuscateText(value) : value;

  const isDateField =
    label.toLowerCase().includes('date') ||
    label.toLowerCase().includes('expiry') ||
    label.toLowerCase().includes('issued');

  return (
    <View className="mb-4">
      <View className="flex-row items-center mb-1">
        <Text className="text-sm text-gray-600 mr-2">{label}</Text>
        {isSensitive && (
          <View className="bg-secondary px-1.5 py-0.5 rounded">
            <Text className="text-xs font-semibold text-dark">Sensitive</Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2.5 min-h-11">
        <Text
          className={`
            flex-1 text-base
            ${isSensitive ? 'font-mono tracking-wide' : ''}
            ${isDateField ? 'text-success' : ''}
            ${!value ? 'italic text-gray-400' : 'text-dark'}
          `}
          selectable={!isSensitive || isRevealed}
        >
          {value ? displayValue : 'Not set'}
        </Text>

        <View className="flex-row items-center">
          {isSensitive && (
            <TouchableOpacity className="p-1 ml-2" onPress={toggleReveal}>
              <Ionicons
                name={isRevealed ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="#FFC107"
              />
            </TouchableOpacity>
          )}

          {!!value && onCopy && (
            <TouchableOpacity
              className="p-1 ml-2 bg-white rounded-full"
              onPress={onCopy}
            >
              <Ionicons name="copy-outline" size={18} color="#FFC107" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default PersonalInfoDetailItem;
