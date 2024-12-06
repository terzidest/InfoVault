import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet } from 'react-native';
import { saveToSecureStore } from '../../services/secureStore';

const AddPersonalNote = ({ navigation }) => {
  const [note, setNote] = useState('');

  const handleSave = async () => {
    const noteId = `note-${Date.now()}`;
    await saveToSecureStore(noteId, JSON.stringify({ note }), 'personalNotes');
    Alert.alert('Success', 'Credential saved successfully');
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        placeholder="Enter your note"
      />
      <Button title="Save Note" onPress={handleSave} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 20, paddingLeft: 10 }
});

export default AddPersonalNote;