import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getFromSecureStore } from '../../services/secureStore';
import { useIsFocused } from '@react-navigation/native';

const PersonalNotesList = ({ navigation }) => {
  const [notes, setNotes] = useState([]);
  const isFocused = useIsFocused();

  const fetchNotesList = useCallback(async () => {
    try {
      const keys = await getFromSecureStore('personalNotesKeys');
      if(keys){
        const parsedKeys = JSON.parse(keys);
        const data = await Promise.all(
          parsedKeys.map(async (key) => {
            const item = await getFromSecureStore(key);
            return { id: key, ...JSON.parse(item) };
          })
        );
        setNotes(data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load Notes');
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchNotesList();
    }
  }, [isFocused, fetchNotesList]);

  const handleViewNote = (id) => {
    navigation.navigate('ViewPersonalNote', { id });
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchNotesList);
    return unsubscribe;
  }, [navigation, fetchNotesList]);

  const renderNoteItem = ({ item }) => (
    <TouchableOpacity onPress={() => navigation.navigate('ViewPersonalNote', { id: item.id })}>
      <View style={styles.noteItem}>
        <Text>{item.note}</Text>
      </View>
    </TouchableOpacity>
  );

  /*
  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleViewPersonalInfo(item.id)}
      style={styles.item}
    >
      <Text>{item.name}</Text>
      <Text>{item.idNumber}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={personalInfoList}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
};
   */


  /*
    const fetchCredentialsList = useCallback(async () => {
    try {
      const keys = await getFromSecureStore('credentialKeys');
      if (keys) {
        const parsedKeys = JSON.parse(keys);
        const data = await Promise.all(
          parsedKeys.map(async (key) => {
            const item = await getFromSecureStore(key);
            return { id: key, ...JSON.parse(item) };
          })
        );
        setCredentialsList(data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load credentials');
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchCredentialsList();
    }
  }, [isFocused, fetchCredentialsList]);

  const handleViewCredential = (id) => {
    navigation.navigate('ViewCredential', { id });
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchCredentialsList);
    return unsubscribe;
  }, [navigation, fetchCredentialsList]);
   */


  /*const storedKeys = await getFromSecureStore('personalNotesKeys'); // Adjust as per your key naming
  const keys = JSON.parse(storedKeys || '[]');
  const fetchedNotes = await Promise.all(keys.map(async (key) => {
    const noteData = await getFromSecureStore(key);
    return { id: key, ...JSON.parse(noteData) };
  }));
  setNotes(fetchedNotes); */

  return (
    <View style={styles.container}>
      <FlatList
        data={notes}
        renderItem={renderNoteItem}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  noteItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: 'gray' },
});

export default PersonalNotesList;