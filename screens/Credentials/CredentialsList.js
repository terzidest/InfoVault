import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { getFromSecureStore } from '../../services/secureStore';
import { useIsFocused } from '@react-navigation/native';


const CredentialsList = ({ navigation }) => {
  const [credentialsList, setCredentialsList] = useState([]);
  const isFocused = useIsFocused();

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

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleViewCredential(item.id)}
      style={styles.item}
    >
      <Text>{item.username}</Text>
      <Text>{item.website}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>

      <FlatList
        data={credentialsList}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    //backgroundColor: '#006E90'
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
});

export default CredentialsList;
