import React, { useLayoutEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { scale } from 'react-native-size-matters';

import useNotesStore from '../../store/notesStore';
import useAuth from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { validateFields, ValidationRules } from '../../utils/validation';
import type { ScreenProps } from '../../types/navigation';
import type { Note } from '../../types/models';

interface FormData {
  title: string;
  content: string;
  category: string;
}

type FormErrors = Partial<Record<keyof FormData, string>>;

const toFormData = (existing: Note | undefined): FormData => ({
  title: existing?.title ?? '',
  content: existing?.content ?? '',
  category: existing?.category ?? 'Personal',
});

const AddNote: React.FC<ScreenProps<'AddNote'>> = ({ navigation, route }) => {
  const id = route.params?.id;
  const isEditMode = Boolean(id);

  const { addNote, updateNote, categories, isLoading } = useNotesStore();
  const existing = useNotesStore((s) => (id ? s.getNoteById(id) : undefined));
  const { updateLastActive } = useAuth();

  const [formData, setFormData] = useState<FormData>(() => toFormData(existing));
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditMode ? 'Edit Note' : 'Add Note' });
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
      // SecureStore warns above ~2048 bytes per value and the hex-encoded
      // AES-GCM seal roughly doubles the plaintext, so long notes risk
      // failing to persist. Honest cap until the seal migrates to base64.
      content: { required: true, maxLength: 900 },
      category: { required: true },
    };

    const { isValid, errors } = validateFields(formData, validationRules);

    if (!isValid) {
      setFormErrors(errors);
      return;
    }

    try {
      if (id) {
        await updateNote(id, formData);
      } else {
        await addNote(formData);
      }
      navigation.goBack();
    } catch {
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
        <Input
          label="Title"
          value={formData.title}
          onChangeText={(value) => handleChange('title', value)}
          placeholder="Enter note title"
          error={!!formErrors.title}
          helperText={formErrors.title}
        />

        <Select
          label="Category"
          value={formData.category}
          onValueChange={(value) => handleChange('category', value)}
          options={categories.map((category) => ({ label: category, value: category }))}
          error={!!formErrors.category}
          helperText={formErrors.category}
        />

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
            {isEditMode ? 'Save Changes' : 'Save Note'}
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
