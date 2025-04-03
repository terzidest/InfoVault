import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { scale } from 'react-native-size-matters';
import { Picker } from '@react-native-picker/picker';

import useNotesStore from '../../store/notesStore';
import useAuth from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { validateFields } from '../../utils/validation';

/**
 * Add note screen
 */
const AddNote = ({ navigation }) => {
  const { addNote, categories, isLoading } = useNotesStore();
  const { updateLastActive } = useAuth();
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'Personal',
  });
  
  const [formErrors, setFormErrors] = useState({});
  
  // Update form data
  const handleChange = (field, value) => {
    updateLastActive();
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for the field when user edits it
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };
  
  // Save note
  const handleSave = async () => {
    updateLastActive();
    
    // Validate form
    const validationRules = {
      title: { required: true, maxLength: 100 },
      content: { required: true, maxLength: 10000 },
      category: { required: true },
    };
    
    const { isValid, errors } = validateFields(formData, validationRules);
    
    if (!isValid) {
      setFormErrors(errors);
      return;
    }
    
    try {
      await addNote(formData);
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Error Saving Note',
        'An error occurred while saving your note. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.formContainer}>
        {/* Title */}
        <Input
          label="Title"
          value={formData.title}
          onChangeText={(value) => handleChange('title', value)}
          placeholder="Enter note title"
          error={!!formErrors.title}
          helperText={formErrors.title}
        />
        
        {/* Category */}
        <View style={styles.pickerContainer}>
          <Text style={styles.label}>Category</Text>
          <View style={[styles.pickerWrapper, !!formErrors.category && styles.pickerError]}>
            <Picker
              selectedValue={formData.category}
              onValueChange={(value) => handleChange('category', value)}
              style={styles.picker}
              mode="dropdown"
            >
              {categories.map((category, index) => (
                <Picker.Item key={index} label={category} value={category} />
              ))}
            </Picker>
          </View>
          {formErrors.category && (
            <Text style={styles.errorText}>{formErrors.category}</Text>
          )}
        </View>
        
        {/* Content */}
        <Input
          label="Note Content"
          value={formData.content}
          onChangeText={(value) => handleChange('content', value)}
          placeholder="Enter your secure note here..."
          multiline
          style={styles.contentInput}
          error={!!formErrors.content}
          helperText={formErrors.content}
        />
        
        {/* Buttons */}
        <View style={styles.buttonsContainer}>
          <Button
            variant="outline"
            style={styles.button}
            onPress={() => navigation.goBack()}
          >
            Cancel
          </Button>
          
          <Button
            style={styles.button}
            onPress={handleSave}
            isLoading={isLoading}
            disabled={isLoading || !formData.title || !formData.content}
          >
            Save Note
          </Button>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  formContainer: {
    padding: scale(16),
  },
  pickerContainer: {
    marginBottom: scale(16),
  },
  label: {
    fontSize: scale(14),
    fontWeight: '500',
    color: '#333333',
    marginBottom: scale(6),
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: scale(8),
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
  },
  pickerError: {
    borderColor: '#F44336',
  },
  picker: {
    height: scale(44),
    width: '100%',
  },
  errorText: {
    fontSize: scale(12),
    color: '#F44336',
    marginTop: scale(4),
    marginLeft: scale(2),
  },
  contentInput: {
    height: scale(200),
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scale(16),
  },
  button: {
    flex: 1,
    marginHorizontal: scale(4),
  },
});

export default AddNote;
