import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, Alert, StyleSheet, } from 'react-native';
import { getFromSecureStore, setToSecureStore, removeFromSecureStore } from '../../services/secureStore';
import PersonalInfoCard from '../../components/PersonalInfoCard';
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

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchPersonalInfoList);
    return unsubscribe;
  }, [navigation, fetchPersonalInfoList]);

  const handleEditPersonalInfo = async (id, newInfo) => {
    try {
      // Update the personal info in secure storage
      await setToSecureStore(id, JSON.stringify(newInfo));
      fetchPersonalInfoList(); // Reload the list after update
    } catch (error) {
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  const handleDeletePersonalInfo = async (id) => {
    try {
      // Remove the personal info from secure storage
      await removeFromSecureStore(id);
      // Remove the key from personalInfoKeys as well
      const keys = await getFromSecureStore('personalInfoKeys');
      if (keys) {
        const parsedKeys = JSON.parse(keys);
        const updatedKeys = parsedKeys.filter((key) => key !== id);
        await setToSecureStore('personalInfoKeys', JSON.stringify(updatedKeys));
        fetchPersonalInfoList(); // Reload the list after deletion
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete personal information');
    }
  };

  const renderItem = ({ item }) => (
    <PersonalInfoCard
      title={item.name} // Example: ID number, Passport number, etc.
      info={item.idNumber} // Encrypted info, will be toggled
      onEdit={(newInfo) => handleEditPersonalInfo(item.id, newInfo)}
      onDelete={() => handleDeletePersonalInfo(item.id)}
    />
  );

  // Dummy Data for Testing
  const dummyData = [
    { id: '1', name: 'ID Number', idNumber: '1234 5678 910' },
    { id: '2', name: 'Tax ID (ΑΦΜ)', idNumber: '9876 5432 109' },
    { id: '3', name: 'Social Security Number (ΑΜΚΑ)', idNumber: '5555 1234 567' },
    { id: '4', name: 'Driving License', idNumber: 'ABC123456789' },
    { id: '5', name: 'Passport Number', idNumber: 'P1234567' }
  ];

  return (
    <View style={styles.container}>
      <FlatList
        data={dummyData} // Use dummy data for testing
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
});

export default PersonalInfoList;


