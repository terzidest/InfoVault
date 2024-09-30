import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getNotes } from '../../services/database';
import { useFocusEffect } from '@react-navigation/native';

const QuickNotesList = ({ navigation }) => {
  const [notes, setNotes] = useState([]);

  const fetchNotes = async () => {
    const data = await getNotes();
    setNotes(data);
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotes();
    }, [])
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('ViewQuickNote', { id: item.id })}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.content}>{item.content}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    fontSize: 14,
  },
});

export default QuickNotesList;
