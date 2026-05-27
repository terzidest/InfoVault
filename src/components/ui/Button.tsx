import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  className?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
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
  className,
  icon: _icon,
  ...props
}) => {
  const getButtonClasses = (): string => {
    let baseClasses = 'rounded-lg items-center justify-center flex-row shadow-sm';

    const sizeClasses: Record<ButtonSize, string> = {
      small: 'py-1.5 px-3',
      medium: 'py-2.5 px-4',
      large: 'py-3.5 px-5',
    };
    baseClasses += ` ${sizeClasses[size]}`;

    const variantClasses: Record<ButtonVariant, string> = {
      primary: 'bg-primary',
      secondary: 'bg-secondary',
      outline: 'bg-transparent border border-primary',
      outlineSecondary: 'bg-transparent border border-secondary',
      danger: 'bg-danger',
      text: 'bg-transparent',
    };
    baseClasses += ` ${variantClasses[variant]}`;

    if (disabled || isLoading) {
      baseClasses += ' opacity-50';
    }

    return baseClasses;
  };

  const getTextClasses = (): string => {
    let baseClasses = 'font-semibold';

    const sizeClasses: Record<ButtonSize, string> = {
      small: 'text-xs',
      medium: 'text-sm',
      large: 'text-base',
    };
    baseClasses += ` ${sizeClasses[size]}`;

    const variantClasses: Record<ButtonVariant, string> = {
      primary: 'text-white',
      secondary: 'text-dark',
      outline: 'text-primary',
      outlineSecondary: 'text-secondary',
      danger: 'text-white',
      text: 'text-primary',
    };
    baseClasses += ` ${variantClasses[variant]}`;

    return baseClasses;
  };

  const buttonClasses = `${getButtonClasses()} ${className || ''}`;

  const indicatorColor =
    variant === 'outline' || variant === 'text' || variant === 'outlineSecondary'
      ? variant === 'outlineSecondary'
        ? '#FFC107'
        : '#006E90'
      : variant === 'secondary'
        ? '#333333'
        : '#FFFFFF';

  return (
    <TouchableOpacity
      className={buttonClasses}
      style={style}
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={indicatorColor} />
      ) : (
        <Text className={getTextClasses()} style={textStyle}>
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
};

export default Button;
