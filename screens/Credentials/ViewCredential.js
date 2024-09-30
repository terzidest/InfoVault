import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { getFromSecureStore, removeFromSecureStore, removeKeyFromSecureStore } from '../../services/secureStore';

const ViewCredential = ({ route, navigation }) => {
  const { id } = route.params;
  const [credential, setCredential] = useState(null);

  useEffect(() => {
    const fetchCredential = async () => {
      const data = await getFromSecureStore(id);
      if (data) {
        setCredential(JSON.parse(data));
      }
    };
    fetchCredential();
  }, [id]);

  const handleDelete = async () => {
    try {
      await removeFromSecureStore(id);
      await removeKeyFromSecureStore('credential', id);
      Alert.alert('Success', 'Credential deleted successfully');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete credential');
    }
  };

  if (!credential) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text>Username: {credential.username}</Text>
      <Text>Password: {credential.password}</Text>
      <Text>Website: {credential.website}</Text>
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

export default ViewCredential;
