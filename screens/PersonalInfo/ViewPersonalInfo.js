import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { getFromSecureStore, removeFromSecureStore, removeKeyFromSecureStore } from '../../services/secureStore';

const ViewPersonalInfo = ({ route, navigation }) => {
  const { id } = route.params;
  const [personalInfo, setPersonalInfo] = useState(null);

  useEffect(() => {
    const fetchPersonalInfo = async () => {
      const data = await getFromSecureStore(id);
      if (data) {
        setPersonalInfo(JSON.parse(data));
      }
    };
    fetchPersonalInfo();
  }, [id]);

  const handleDelete = async () => {
    try {
      await removeFromSecureStore(id);
      await removeKeyFromSecureStore('personalInfo', id);
      Alert.alert('Success', 'Personal information deleted successfully');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete personal information');
    }
  };

  if (!personalInfo) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text>Name: {personalInfo.name}</Text>
      <Text>ID Number: {personalInfo.idNumber}</Text>
      <Button title="Delete" onPress={handleDelete} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});

export default ViewPersonalInfo;
