import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime, truncateText } from '../../../utils/formatters';
import { colors, noteCategoryColor } from '../../../theme/colors';
import type { Note } from '../../../types/models';

interface NoteListItemProps {
  note: Note;
  onPress?: () => void;
}

const NoteListItem: React.FC<NoteListItemProps> = ({ note, onPress }) => {
  const categoryColor = noteCategoryColor(note.category);

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.icon, { backgroundColor: categoryColor }]}>
        <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {note.title || 'Untitled Note'}
        </Text>

        <Text style={styles.preview} numberOfLines={2}>
          {truncateText(note.content || '', 80)}
        </Text>

        <View style={styles.footer}>
          {note.category && (
            <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '20' }]}>
              <Text style={{ color: categoryColor, fontSize: 10, fontWeight: '600' }}>
                {note.category}
              </Text>
            </View>
          )}

          <Text style={styles.timestamp}>
            {formatRelativeTime(note.updatedAt)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: colors.dark,
    marginBottom: 4,
  },
  preview: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timestamp: {
    fontSize: 12,
    lineHeight: 16,
    color: '#9CA3AF',
  },
});

// Memoized: list re-renders must not re-render every visible row.
export default React.memo(NoteListItem);
