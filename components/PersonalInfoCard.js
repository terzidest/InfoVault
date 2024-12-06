import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale } from 'react-native-size-matters';

const PersonalInfoCard = ({ title, info, onEdit, onDelete }) => {
  const [isLocked, setIsLocked] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedInfo, setEditedInfo] = useState(info);
  
  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editedInfo !== info) {
      // Save the changes (This could be saving back to the secure store)
      onEdit(editedInfo); 
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedInfo(info);
    setIsEditing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Confirm Deletion',
      `Are you sure you want to delete the ${title}?`,
      [
        { text: 'Cancel' },
        { text: 'Delete', onPress: () => onDelete() },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>

      <View style={styles.content}>
        {isEditing ? (
          <TextInput
            style={styles.input}
            value={editedInfo}
            onChangeText={setEditedInfo}
          />
        ) : (
          <Text style={styles.infoText}>
            {isLocked ? '*****' : editedInfo}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={() => setIsLocked(!isLocked)} style={styles.iconButton}>
          <Ionicons name={isLocked ? 'lock-closed' : 'lock-open-sharp'} size={30} color="#006E90" />
        </TouchableOpacity>
        
        {isEditing ? (
          <>
            <TouchableOpacity onPress={handleSave} style={styles.iconButton}>
              <Ionicons name="checkmark" size={30} color="#28a745" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCancel} style={styles.iconButton}>
              <Ionicons name="close" size={30} color="#dc3545" />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity onPress={handleEdit} style={styles.iconButton}>
            <Ionicons name="create" size={30} color="#FFC107" />
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handleDelete} style={styles.iconButton}>
          <Ionicons name="trash" size={30} color="#dc3545" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '90%',
    padding: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFC107',
    backgroundColor: '#006E90',
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFC107',
    textAlign: 'center',
  },
  content: {
    marginBottom: 10,
  },
  infoText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  input: {
    height: verticalScale(40),
    width: '80%',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: scale(10),
    color: '#fff',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  iconButton: {
    marginHorizontal: scale(10),
    padding: scale(10),
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PersonalInfoCard;