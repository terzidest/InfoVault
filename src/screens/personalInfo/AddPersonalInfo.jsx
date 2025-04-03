import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { scale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

import usePersonalInfoStore from '../../store/personalInfoStore';
import useAuth from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { validateFields } from '../../utils/validation';

/**
 * Add personal information screen
 */
const AddPersonalInfo = ({ navigation }) => {
  const { addPersonalInfo, isLoading } = usePersonalInfoStore();
  const { updateLastActive } = useAuth();
  
  // Personal info types
  const infoTypes = [
    { label: 'Select Type...', value: '' },
    { label: 'Passport', value: 'Passport' },
    { label: 'Driver\'s License', value: 'Driver\'s License' },
    { label: 'ID Card', value: 'ID Card' },
    { label: 'Social Security', value: 'Social Security' },
    { label: 'Tax Number', value: 'Tax Number' },
    { label: 'Health Insurance', value: 'Health Insurance' },
    { label: 'Other', value: 'Other' }
  ];
  
  const [formData, setFormData] = useState({
    title: '',
    type: '',
    identifier: '',
    issueDate: '',
    expiryDate: '',
    issuingAuthority: '',
    notes: '',
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
  
  // Save personal info
  const handleSave = async () => {
    updateLastActive();
    
    // Validate form
    const validationRules = {
      title: { required: true, maxLength: 100 },
      type: { required: true },
      identifier: { required: true, maxLength: 100 },
      issueDate: { 
        date: true,
        validate: (value) => {
          if (value && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return 'Use format YYYY-MM-DD';
          }
          return '';
        }
      },
      expiryDate: { 
        date: true,
        validate: (value) => {
          if (value && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return 'Use format YYYY-MM-DD';
          }
          return '';
        }
      },
      issuingAuthority: { maxLength: 100 },
      notes: { maxLength: 500 },
    };
    
    const { isValid, errors } = validateFields(formData, validationRules);
    
    if (!isValid) {
      setFormErrors(errors);
      return;
    }
    
    try {
      await addPersonalInfo(formData);
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Error Saving Information',
        'An error occurred while saving your personal information. Please try again.',
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
          placeholder="e.g., My Passport, Driver's License"
          error={!!formErrors.title}
          helperText={formErrors.title}
        />
        
        {/* Type */}
        <View style={styles.pickerContainer}>
          <Text style={styles.label}>Type</Text>
          <View style={[styles.pickerWrapper, !!formErrors.type && styles.pickerError]}>
            <Picker
              selectedValue={formData.type}
              onValueChange={(value) => handleChange('type', value)}
              style={styles.picker}
              mode="dropdown"
            >
              {infoTypes.map((type, index) => (
                <Picker.Item key={index} label={type.label} value={type.value} />
              ))}
            </Picker>
          </View>
          {formErrors.type && (
            <Text style={styles.errorText}>{formErrors.type}</Text>
          )}
        </View>
        
        {/* Identifier */}
        <Input
          label="Identifier Number"
          value={formData.identifier}
          onChangeText={(value) => handleChange('identifier', value)}
          placeholder="Enter ID number, passport number, etc."
          sensitive
          error={!!formErrors.identifier}
          helperText={formErrors.identifier}
        />
        
        {/* Issue Date */}
        <Input
          label="Issue Date (optional)"
          value={formData.issueDate}
          onChangeText={(value) => handleChange('issueDate', value)}
          placeholder="YYYY-MM-DD"
          error={!!formErrors.issueDate}
          helperText={formErrors.issueDate || 'Format: YYYY-MM-DD'}
        />
        
        {/* Expiry Date */}
        <Input
          label="Expiry Date (optional)"
          value={formData.expiryDate}
          onChangeText={(value) => handleChange('expiryDate', value)}
          placeholder="YYYY-MM-DD"
          error={!!formErrors.expiryDate}
          helperText={formErrors.expiryDate || 'Format: YYYY-MM-DD'}
        />
        
        {/* Issuing Authority */}
        <Input
          label="Issuing Authority (optional)"
          value={formData.issuingAuthority}
          onChangeText={(value) => handleChange('issuingAuthority', value)}
          placeholder="e.g., Department of State, DMV"
          error={!!formErrors.issuingAuthority}
          helperText={formErrors.issuingAuthority}
        />
        
        {/* Notes */}
        <Input
          label="Notes (optional)"
          value={formData.notes}
          onChangeText={(value) => handleChange('notes', value)}
          placeholder="Add any additional information here"
          multiline
          error={!!formErrors.notes}
          helperText={formErrors.notes}
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
            disabled={isLoading || !formData.title || !formData.type || !formData.identifier}
          >
            Save Information
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

export default AddPersonalInfo;
