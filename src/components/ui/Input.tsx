import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  TextStyle,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  secure?: boolean;
  error?: boolean;
  helperText?: string;
  multiline?: boolean;
  style?: StyleProp<ViewStyle>;
  // Sizes the TextInput itself. Never fix the container's height via `style`:
  // the helper/error text renders below the field and would overflow onto
  // whatever follows the input.
  inputStyle?: StyleProp<TextStyle>;
  sensitive?: boolean;
}

const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secure = false,
  error = false,
  helperText,
  multiline = false,
  style,
  inputStyle,
  sensitive = false,
  ...props
}) => {
  const [secureTextEntry, setSecureTextEntry] = useState(secure);

  return (
    <View style={[styles.container, style]}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, error ? styles.labelError : styles.labelDefault]}>
            {label}
          </Text>

          {sensitive && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Sensitive</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.fieldWrapper}>
        <TextInput
          style={[
            styles.input,
            error ? styles.inputError : styles.inputDefault,
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#999999"
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...props}
        />

        {secure && (
          <TouchableOpacity
            style={styles.toggle}
            onPress={() => setSecureTextEntry(!secureTextEntry)}
            accessibilityRole="button"
            accessibilityLabel={secureTextEntry ? 'Show value' : 'Hide value'}
          >
            <Ionicons
              name={secureTextEntry ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color="#777777"
            />
          </TouchableOpacity>
        )}
      </View>

      {helperText && (
        <Text style={[styles.helper, error ? styles.helperError : styles.helperDefault]}>
          {helperText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginRight: 8,
  },
  labelDefault: {
    color: colors.dark,
  },
  labelError: {
    color: colors.danger,
  },
  badge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.dark,
  },
  fieldWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    color: colors.dark,
  },
  inputDefault: {
    borderColor: '#E5E7EB',
  },
  inputError: {
    borderColor: colors.danger,
  },
  inputMultiline: {
    minHeight: 100,
    paddingVertical: 10,
    textAlign: 'left',
  },
  toggle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
  },
  helper: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
    marginLeft: 2,
  },
  helperDefault: {
    color: '#6B7280',
  },
  helperError: {
    color: colors.danger,
  },
});

export default Input;
