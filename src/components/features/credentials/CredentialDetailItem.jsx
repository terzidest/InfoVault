import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { obfuscateText } from '../../../utils/encryption';

/**
 * Credential detail item for displaying credential field with reveal option
 * 
 * @param {string} label - Field label
 * @param {string} value - Field value
 * @param {boolean} isSensitive - Whether the field contains sensitive data
 * @param {function} onCopy - Function to copy value to clipboard
 */
const CredentialDetailItem = ({ label, value, isSensitive = false, onCopy }) => {
  const [isRevealed, setIsRevealed] = useState(false);
  
  // Toggle revelation state
  const toggleReveal = () => {
    setIsRevealed(prev => !prev);
    
    // Auto-hide after 10 seconds if revealed
    if (!isRevealed) {
      setTimeout(() => {
        setIsRevealed(false);
      }, 10000);
    }
  };
  
  // Display value based on sensitivity and reveal state
  const displayValue = isSensitive && !isRevealed ? obfuscateText(value) : value;
  
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
                color="#006E90" 
              />
            </TouchableOpacity>
          )}
          
          {!!value && onCopy && (
            <TouchableOpacity 
              className="p-1 ml-2 bg-white rounded-full" 
              onPress={onCopy}
            >
              <Ionicons name="copy-outline" size={18} color="#006E90" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default CredentialDetailItem;
