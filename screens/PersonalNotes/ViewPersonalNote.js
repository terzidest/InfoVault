import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { getFromSecureStore, removeFromSecureStore } from '../../services/secureStore';

const ViewPersonalNote = ({ route, navigation }) => {
  const { id } = route.params;
  const [note, setNote] = useState(null);

  useEffect(() => {
    const fetchNote = async () => {
      const data = await getFromSecureStore(id);
      if (data) {
        setNote(JSON.parse(data).note);
      }
    };
    fetchNote();
  }, [id]);

  const handleDelete = async () => {
    await removeFromSecureStore(id);
    Alert.alert('Success', 'Note deleted successfully');
    navigation.goBack();
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
      <Text>{note}</Text>
      <Button title="Delete" onPress={handleDelete} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
});

export default ViewPersonalNote;