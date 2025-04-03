import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Reusable Input component
 * 
 * @param {string} label - Input label
 * @param {string} value - Input value
 * @param {function} onChangeText - Text change handler
 * @param {string} placeholder - Placeholder text
 * @param {boolean} secure - Enable secure text entry for passwords
 * @param {boolean} error - Show error state
 * @param {string} helperText - Helper or error text to display below input
 * @param {boolean} multiline - Enable multiline input
 * @param {object} style - Additional style overrides
 * @param {boolean} sensitive - Indicate if the field contains sensitive data
 */
const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  secure = false,
  error = false,
  helperText,
  multiline = false,
  style,
  sensitive = false,
  ...props
}) => {
  const [secureTextEntry, setSecureTextEntry] = useState(secure);
  
  return (
    <View className="mb-4" style={style}>
      {label && (
        <View className="flex-row items-center mb-1.5">
          <Text className={`text-sm font-medium ${error ? 'text-danger' : 'text-dark'} mr-2`}>
            {label}
          </Text>
          
          {sensitive && (
            <View className="bg-secondary px-1.5 py-0.5 rounded">
              <Text className="text-xs font-semibold text-dark">Sensitive</Text>
            </View>
          )}
        </View>
      )}
      
      <View className="relative">
        <TextInput
          className={`
            bg-gray-100 border rounded-lg px-3 py-2.5 text-sm text-dark
            ${error ? 'border-danger' : 'border-gray-200'}
            ${multiline ? 'min-h-[100px] py-2.5 text-left' : ''}
          `}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#999999"
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...props}
        />
        
        {secure && (
          <TouchableOpacity
            className="absolute right-3 top-1/2 -mt-2.5"
            onPress={() => setSecureTextEntry(!secureTextEntry)}
          >
            <Ionicons
              name={secureTextEntry ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color="#777777"
            />
          </TouchableOpacity>
        )}
      </View>
      
      {helperText && (
        <Text className={`text-xs mt-1 ml-0.5 ${error ? 'text-danger' : 'text-gray-500'}`}>
          {helperText}
        </Text>
      )}
    </View>
  );
};

export default Input;
