import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, InteractionManager } from 'react-native';
import { scale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import useNotesStore from '../../store/notesStore';
import useAuth from '../../hooks/useAuth';
import NoteListItem from '../../components/features/notes/NoteListItem';
import SearchBar from '../../components/ui/SearchBar';
import type { ScreenProps } from '../../types/navigation';
import type { Note } from '../../types/models';

const NotesList: React.FC<ScreenProps<'NotesList'>> = ({ navigation }) => {
  const { notes, loadNotes } = useNotesStore();
  const { isAuthenticated, updateLastActive } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const q = searchQuery.trim().toLowerCase();

  const filteredNotes = q
    ? notes.filter(
        (note) =>
          note.title?.toLowerCase().includes(q) ||
          note.content?.toLowerCase().includes(q) ||
          note.category?.toLowerCase().includes(q)
      )
    : notes;

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.replace('Authentication');
    }
  }, [isAuthenticated, navigation]);

  useFocusEffect(
    React.useCallback(() => {
      if (!isAuthenticated) return;
      // Defer the reload (SecureStore reads + decryption) until the
      // navigation transition has finished, so the animation stays smooth.
      const task = InteractionManager.runAfterInteractions(() => {
        updateLastActive();
        loadNotes();
      });
      return () => task.cancel();
    }, [isAuthenticated, updateLastActive, loadNotes])
  );

  const handleAddNote = () => {
    navigation.navigate('AddNote');
  };

  const handleViewNote = (note: Note) => {
    navigation.navigate('ViewNote', { id: note.id });
  };

  const renderEmptyState = () => {
    if (notes.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={scale(60)} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>No Notes Yet</Text>
          <Text style={styles.emptySubtitle}>
            Add your first note by tapping the plus button below
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={scale(60)} color="#CCCCCC" />
        <Text style={styles.emptyTitle}>No matches</Text>
        <Text style={styles.emptySubtitle}>No notes match your search.</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search notes…"
        />
      </View>

      <FlatList
        data={filteredNotes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NoteListItem note={item} onPress={() => handleViewNote(item)} />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        keyboardShouldPersistTaps="handled"
      />

      <TouchableOpacity style={styles.addButton} onPress={handleAddNote}>
        <Ionicons name="add" size={scale(24)} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: scale(16),
    paddingTop: scale(12),
  },
  listContent: {
    padding: scale(16),
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scale(80),
    padding: scale(20),
  },
  emptyTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: '#333333',
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  emptySubtitle: {
    fontSize: scale(14),
    color: '#666666',
    textAlign: 'center',
    maxWidth: '80%',
  },
  addButton: {
    position: 'absolute',
    bottom: scale(20),
    right: scale(20),
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

export default NotesList;
