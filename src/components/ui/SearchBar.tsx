import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText, placeholder = 'Search…' }) => {
  return (
    <View className="flex-row items-center bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
      <Ionicons name="search-outline" size={18} color="#777777" style={{ marginRight: 8 }} />
      <TextInput
        className="flex-1 text-sm text-dark"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999999"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={18} color="#999999" />
        </Pressable>
      )}
    </View>
  );
};

export default SearchBar;
