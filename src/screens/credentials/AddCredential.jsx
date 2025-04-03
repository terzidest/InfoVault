import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { scale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';

import useCredentialsStore from '../../store/credentialsStore';
import useAuth from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { checkPasswordStrength } from '../../utils/encryption';
import { validateFields } from '../../utils/validation';

/**
 * Add credential screen
 */
const AddCredential = ({ navigation }) => {
  const { addCredential, isLoading } = useCredentialsStore();
  const { updateLastActive } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    website: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  // Update form data
  const handleChange = (field, value) => {
    updateLastActive();
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Calculate password strength if password field is updated
    if (field === 'password') {
      setPasswordStrength(checkPasswordStrength(value));
    }
    
    // Clear error for the field when user edits it
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };
  
  // Get password strength color
  const getStrengthColor = () => {
    if (passwordStrength < 30) return '#F44336';
    if (passwordStrength < 60) return '#FFC107';
    return '#4CAF50';
  };
  
  // Save credential
  const handleSave = async () => {
    updateLastActive();
    
    // Validate form
    const validationRules = {
      title: { required: true, maxLength: 100 },
      username: { maxLength: 100 },
      password: { maxLength: 100 },
      website: { maxLength: 200 },
      notes: { maxLength: 500 },
    };
    
    const { isValid, errors } = validateFields(formData, validationRules);
    
    if (!isValid) {
      setFormErrors(errors);
      return;
    }
    
    try {
      await addCredential(formData);
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Error Saving Credential',
        'An error occurred while saving your credential. Please try again.',
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
          placeholder="e.g., Gmail, Bank Account, Netflix"
          error={!!formErrors.title}
          helperText={formErrors.title}
        />
        
        {/* Username */}
        <Input
          label="Username / Email"
          value={formData.username}
          onChangeText={(value) => handleChange('username', value)}
          placeholder="Enter username or email"
          error={!!formErrors.username}
          helperText={formErrors.username}
        />
        
        {/* Password */}
        <View style={styles.passwordContainer}>
          <Input
            label="Password"
            value={formData.password}
            onChangeText={(value) => handleChange('password', value)}
            placeholder="Enter password"
            secure
            sensitive
            error={!!formErrors.password}
            helperText={formErrors.password}
          />
          
          {formData.password.length > 0 && (
            <View style={styles.strengthContainer}>
              <Text style={styles.strengthLabel}>Strength:</Text>
              <View style={styles.strengthBarContainer}>
                <View 
                  style={[
                    styles.strengthBar, 
                    { 
                      width: `${passwordStrength}%`, 
                      backgroundColor: getStrengthColor() 
                    }
                  ]} 
                />
              </View>
              <TouchableOpacity style={styles.generateButton}>
                <Ionicons name="refresh-outline" size={scale(16)} color="#006E90" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Website */}
        <Input
          label="Website (optional)"
          value={formData.website}
          onChangeText={(value) => handleChange('website', value)}
          placeholder="e.g., https://example.com"
          error={!!formErrors.website}
          helperText={formErrors.website}
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
            disabled={isLoading || !formData.title}
          >
            Save Credential
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
  passwordContainer: {
    marginBottom: scale(16),
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(8),
    marginLeft: scale(2),
  },
  strengthLabel: {
    fontSize: scale(12),
    color: '#666666',
    marginRight: scale(8),
  },
  strengthBarContainer: {
    flex: 1,
    height: scale(4),
    backgroundColor: '#EEEEEE',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  strengthBar: {
    height: '100%',
  },
  generateButton: {
    marginLeft: scale(8),
    padding: scale(4),
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

export default AddCredential;
