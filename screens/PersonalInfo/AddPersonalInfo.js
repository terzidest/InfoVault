import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { saveToSecureStore } from '../../services/secureStore';

const AddPersonalInfo = ({ navigation }) => {
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [ssn, setSsn] = useState('');

  const handleSave = async () => {
    const id = new Date().getTime().toString(); // Unique ID for each personal info
    const personalInfo = { name, idNumber, ssn };
    await saveToSecureStore(id, JSON.stringify(personalInfo), 'personalInfo');
    Alert.alert('Success', 'Personal info saved successfully');
    navigation.goBack();
  };
  

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="ID Number"
        value={idNumber}
        onChangeText={setIdNumber}
      />
      <TextInput
        style={styles.input}
        placeholder="SSN"
        value={ssn}
        onChangeText={setSsn}
      />
      <Button title="Save" onPress={handleSave} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
});

export default AddPersonalInfo;
