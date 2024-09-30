import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { getFromSecureStore, removeFromSecureStore } from '../../services/secureStore';
import { useIsFocused } from '@react-navigation/native';

const PersonalInfoList = ({ navigation }) => {
  const [personalInfoList, setPersonalInfoList] = useState([]);
  const isFocused = useIsFocused();

  const fetchPersonalInfoList = useCallback(async () => {
    try {
      const keys = await getFromSecureStore('personalInfoKeys');
      if (keys) {
        const parsedKeys = JSON.parse(keys);
        const data = await Promise.all(
          parsedKeys.map(async (key) => {
            const item = await getFromSecureStore(key);
            return { id: key, ...JSON.parse(item) };
          })
        );
        setPersonalInfoList(data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load personal information');
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchPersonalInfoList();
    }
  }, [isFocused, fetchPersonalInfoList]);

  const handleViewPersonalInfo = (id) => {
    navigation.navigate('ViewPersonalInfo', { id });
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchPersonalInfoList);
    return unsubscribe;
  }, [navigation, fetchPersonalInfoList]);

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
});

export default PersonalInfoList;
