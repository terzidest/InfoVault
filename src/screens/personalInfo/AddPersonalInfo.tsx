import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { scale } from 'react-native-size-matters';

import usePersonalInfoStore from '../../store/personalInfoStore';
import useAuth from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { validateFields, ValidationRules } from '../../utils/validation';
import type { ScreenProps } from '../../types/navigation';
import type { PersonalInfo } from '../../types/models';

interface FormData {
  title: string;
  type: string;
  identifier: string;
  issueDate: string;
  expiryDate: string;
  issuingAuthority: string;
  notes: string;
}

type FormErrors = Partial<Record<keyof FormData, string>>;

const toFormData = (existing: PersonalInfo | undefined): FormData => ({
  title: existing?.title ?? '',
  type: existing?.type ?? '',
  identifier: existing?.identifier ?? '',
  issueDate: existing?.issueDate ?? '',
  expiryDate: existing?.expiryDate ?? '',
  issuingAuthority: existing?.issuingAuthority ?? '',
  notes: existing?.notes ?? '',
});

const AddPersonalInfo: React.FC<ScreenProps<'AddPersonalInfo'>> = ({ navigation, route }) => {
  const id = route.params?.id;
  const isEditMode = Boolean(id);

  const { addPersonalInfo, updatePersonalInfo, isLoading } = usePersonalInfoStore();
  const existing = usePersonalInfoStore((s) => (id ? s.getPersonalInfoById(id) : undefined));
  const { isAuthenticated, updateLastActive } = useAuth();

  const infoTypes = [
    { label: 'Passport', value: 'Passport' },
    { label: "Driver's License", value: "Driver's License" },
    { label: 'ID Card', value: 'ID Card' },
    { label: 'Social Security', value: 'Social Security' },
    { label: 'Tax Number', value: 'Tax Number' },
    { label: 'Health Insurance', value: 'Health Insurance' },
    { label: 'Other', value: 'Other' },
  ];

  const [formData, setFormData] = useState<FormData>(() => toFormData(existing));
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.replace('Authentication');
    }
  }, [isAuthenticated, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditMode ? 'Edit Personal Info' : 'Add Personal Info' });
  }, [isEditMode, navigation]);

  const handleChange = (field: keyof FormData, value: string) => {
    updateLastActive();

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (formErrors[field]) {
      setFormErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const handleSave = async () => {
    updateLastActive();

    const validationRules: ValidationRules<FormData> = {
      title: { required: true, maxLength: 100 },
      type: { required: true },
      identifier: { required: true, maxLength: 100 },
      issueDate: {
        date: true,
        validate: (value) => {
          if (value && typeof value === 'string' && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return 'Use format YYYY-MM-DD';
          }
          return '';
        },
      },
      expiryDate: {
        date: true,
        validate: (value) => {
          if (value && typeof value === 'string' && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return 'Use format YYYY-MM-DD';
          }
          return '';
        },
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
      if (id) {
        await updatePersonalInfo(id, formData);
      } else {
        await addPersonalInfo(formData);
      }
      navigation.goBack();
    } catch {
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
        <Input
          label="Title"
          value={formData.title}
          onChangeText={(value) => handleChange('title', value)}
          placeholder="e.g., My Passport, Driver's License"
          error={!!formErrors.title}
          helperText={formErrors.title}
        />

        <Select
          label="Type"
          value={formData.type}
          onValueChange={(value) => handleChange('type', value)}
          options={infoTypes}
          placeholder="Select Type..."
          error={!!formErrors.type}
          helperText={formErrors.type}
        />

        <Input
          label="Identifier Number"
          value={formData.identifier}
          onChangeText={(value) => handleChange('identifier', value)}
          placeholder="Enter ID number, passport number, etc."
          sensitive
          error={!!formErrors.identifier}
          helperText={formErrors.identifier}
        />

        <Input
          label="Issue Date (optional)"
          value={formData.issueDate}
          onChangeText={(value) => handleChange('issueDate', value)}
          placeholder="YYYY-MM-DD"
          error={!!formErrors.issueDate}
          helperText={formErrors.issueDate || 'Format: YYYY-MM-DD'}
        />

        <Input
          label="Expiry Date (optional)"
          value={formData.expiryDate}
          onChangeText={(value) => handleChange('expiryDate', value)}
          placeholder="YYYY-MM-DD"
          error={!!formErrors.expiryDate}
          helperText={formErrors.expiryDate || 'Format: YYYY-MM-DD'}
        />

        <Input
          label="Issuing Authority (optional)"
          value={formData.issuingAuthority}
          onChangeText={(value) => handleChange('issuingAuthority', value)}
          placeholder="e.g., Department of State, DMV"
          error={!!formErrors.issuingAuthority}
          helperText={formErrors.issuingAuthority}
        />

        <Input
          label="Notes (optional)"
          value={formData.notes}
          onChangeText={(value) => handleChange('notes', value)}
          placeholder="Add any additional information here"
          multiline
          error={!!formErrors.notes}
          helperText={formErrors.notes}
        />

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
            {isEditMode ? 'Save Changes' : 'Save Information'}
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
