// Themed single-line text input (52 high) on a surface tile. Focus shows an
// accent border plus a 3px halo (rendered as an outer View so it never
// shifts layout). `secure` adds an eye toggle; `leading`/`trailing` are icon
// slots; `error`/`helperText` render below the field.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { rgba } from '../../theme/tokens';

const HALO = 3;

interface TextFieldProps extends Omit<TextInputProps, 'style' | 'secureTextEntry'> {
  label?: string;
  /** Mask the value with a visibility toggle. */
  secure?: boolean;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Error message; also switches the border to `bad`. */
  error?: string;
  helperText?: string;
  style?: StyleProp<ViewStyle>;
}

const TextField: React.FC<TextFieldProps> = ({
  label,
  secure = false,
  leading,
  trailing,
  error,
  helperText,
  style,
  onFocus,
  onBlur,
  accessibilityLabel,
  ...inputProps
}) => {
  const { tokens } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);

  const borderColor = error
    ? tokens.colors.bad
    : focused
      ? rgba(tokens.colors.accentRgb, 0.6)
      : tokens.colors.line;
  const haloColor = focused && !error ? rgba(tokens.colors.accentRgb, 0.15) : 'transparent';
  const message = error ?? helperText;

  return (
    <View style={style}>
      {label ? (
        <Text style={[tokens.type.label, styles.label, { color: tokens.colors.muted }]}>{label}</Text>
      ) : null}
      <View style={[styles.halo, { borderRadius: tokens.radius.lg + HALO, backgroundColor: haloColor }]}>
        <View
          style={[
            styles.field,
            { borderRadius: tokens.radius.lg, backgroundColor: tokens.colors.surface, borderColor },
          ]}
        >
          {leading ? <View style={styles.slot}>{leading}</View> : null}
          <TextInput
            {...inputProps}
            accessibilityLabel={accessibilityLabel ?? label}
            secureTextEntry={secure && hidden}
            placeholderTextColor={tokens.colors.quiet}
            selectionColor={tokens.colors.accent}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[tokens.type.body, styles.input, { color: tokens.colors.text }]}
          />
          {secure ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hidden ? 'Show value' : 'Hide value'}
              onPress={() => setHidden((h) => !h)}
              hitSlop={8}
              style={styles.slot}
            >
              <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={tokens.colors.icon} />
            </Pressable>
          ) : null}
          {trailing ? <View style={styles.slot}>{trailing}</View> : null}
        </View>
      </View>
      {message ? (
        <Text style={[tokens.type.secondary, styles.message, { color: error ? tokens.colors.bad : tokens.colors.muted }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  halo: { padding: HALO, margin: -HALO },
  field: {
    height: 52,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    // Line height on a single-line input mis-centers the text on Android.
    lineHeight: undefined,
  },
  slot: {
    minWidth: 28,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { marginTop: 6 },
});

export default TextField;
