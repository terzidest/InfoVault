import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime, truncateText } from '../../../utils/formatters';

/**
 * Note list item component
 * 
 * @param {object} note - Note data
 * @param {function} onPress - Function to call when item is pressed
 */
const NoteListItem = ({ note, onPress }) => {
  // Get category color
  const getCategoryColor = () => {
    const category = note.category?.toLowerCase() || '';
    
    switch (category) {
      case 'personal':
        return '#4CAF50';
      case 'work':
        return '#2196F3';
      case 'financial':
        return '#FFC107';
      case 'health':
        return '#F44336';
      default:
        return '#9C27B0';
    }
  };
  
  const categoryColor = getCategoryColor();
  
  return (
    <TouchableOpacity 
      className="flex-row bg-white rounded-lg mb-3 p-3 border border-gray-100 shadow-sm"
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View 
        className="w-10 h-10 rounded-lg justify-center items-center mr-3" 
        style={{ backgroundColor: categoryColor }}
      >
        <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
      </View>
      
      <View className="flex-1">
        <Text className="text-base font-medium text-dark mb-1" numberOfLines={1}>
          {note.title || 'Untitled Note'}
        </Text>
        
        <Text className="text-sm text-gray-600 mb-2 leading-5" numberOfLines={2}>
          {truncateText(note.content || '', 80)}
        </Text>
        
        <View className="flex-row items-center justify-between">
          {note.category && (
            <View 
              className="px-2 py-0.5 rounded" 
              style={{ backgroundColor: categoryColor + '20' }}
            >
              <Text style={{ color: categoryColor, fontSize: 10, fontWeight: '600' }}>
                {note.category}
              </Text>
            </View>
          )}
          
          <Text className="text-xs text-gray-400">
            {formatRelativeTime(note.updatedAt)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default NoteListItem;
