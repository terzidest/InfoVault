import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '../../../utils/formatters';

/**
 * Credential list item component
 * 
 * @param {object} credential - Credential data
 * @param {function} onPress - Function to call when item is pressed
 */
const CredentialListItem = ({ credential, onPress }) => {
  return (
    <TouchableOpacity 
      className="flex-row items-center bg-white rounded-lg mb-3 p-3 border border-gray-100 shadow-sm"
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View className="w-10 h-10 rounded-lg justify-center items-center mr-3" style={{ backgroundColor: '#006E90' }}>
        <Ionicons
          name={credential.website ? 'globe-outline' : 'key-outline'}
          size={20}
          color="#FFFFFF"
        />
      </View>
      
      <View className="flex-1 mr-2">
        <Text className="text-base font-medium text-dark mb-0.5" numberOfLines={1}>
          {credential.title || credential.username || 'Untitled Credential'}
        </Text>
        
        <Text className="text-sm text-gray-600 mb-1" numberOfLines={1}>
          {credential.username || credential.website || 'No details'}
        </Text>
        
        <Text className="text-xs text-gray-400">
          {formatRelativeTime(credential.updatedAt)}
        </Text>
      </View>
      
      <View className="h-10 w-10 items-center justify-center">
        <Ionicons name="chevron-forward" size={20} color="#BBBBBB" />
      </View>
    </TouchableOpacity>
  );
};

export default CredentialListItem;
