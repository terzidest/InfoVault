import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import { colors } from '../../theme/colors';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'outlineSecondary' | 'danger' | 'text';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  isLoading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  disabled = false,
  onPress,
  size = 'medium',
  style,
  textStyle,
  ...props
}) => {
  const indicatorColor =
    variant === 'outline' || variant === 'text' || variant === 'outlineSecondary'
      ? variant === 'outlineSecondary'
        ? colors.secondary
        : colors.primary
      : variant === 'secondary'
        ? colors.dark
        : colors.light;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        buttonSizeStyles[size],
        buttonVariantStyles[variant],
        (disabled || isLoading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={indicatorColor} />
      ) : (
        <Text style={[styles.text, textSizeStyles[size], textVariantStyles[variant], textStyle]}>
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
  },
});

const buttonSizeStyles = StyleSheet.create<Record<ButtonSize, ViewStyle>>({
  small: { paddingVertical: 6, paddingHorizontal: 12 },
  medium: { paddingVertical: 10, paddingHorizontal: 16 },
  large: { paddingVertical: 14, paddingHorizontal: 20 },
});

const buttonVariantStyles = StyleSheet.create<Record<ButtonVariant, ViewStyle>>({
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  outlineSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.secondary },
  danger: { backgroundColor: colors.danger },
  text: { backgroundColor: 'transparent' },
});

const textSizeStyles = StyleSheet.create<Record<ButtonSize, TextStyle>>({
  small: { fontSize: 12, lineHeight: 16 },
  medium: { fontSize: 14, lineHeight: 20 },
  large: { fontSize: 16, lineHeight: 24 },
});

const textVariantStyles = StyleSheet.create<Record<ButtonVariant, TextStyle>>({
  primary: { color: '#FFFFFF' },
  secondary: { color: colors.dark },
  outline: { color: colors.primary },
  outlineSecondary: { color: colors.secondary },
  danger: { color: '#FFFFFF' },
  text: { color: colors.primary },
});

export default Button;
