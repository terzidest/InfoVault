import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { getNoteById, deleteNote } from '../../services/database';

const ViewQuickNote = ({ route, navigation }) => {
  const { id } = route.params;
  const [note, setNote] = useState(null);

  useEffect(() => {
    const fetchNote = async () => {
      const data = await getNoteById(id);
      setNote(data);
    };
    fetchNote();
  }, [id]);

  const handleDelete = async () => {
    try {
      await deleteNote(id);
      Alert.alert('Success', 'Note deleted successfully');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete note');
    }
  };

  if (!note) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{note.title}</Text>
      <Text style={styles.content}>{note.content}</Text>
      <Button title="Delete" onPress={handleDelete} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    fontSize: 16,
    marginVertical: 12,
  },
});

export default ViewQuickNote;
