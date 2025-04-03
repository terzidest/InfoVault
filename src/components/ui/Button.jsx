import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

/**
 * Reusable Button component with various styles
 * 
 * @param {string} variant - 'primary', 'secondary', 'outline', 'danger', 'text'
 * @param {boolean} isLoading - Show loading indicator
 * @param {boolean} disabled - Disable button
 * @param {function} onPress - Button press handler
 * @param {string} size - 'small', 'medium', 'large'
 * @param {object} style - Additional style overrides
 * @param {object} textStyle - Additional text style overrides
 */
const Button = ({
  children,
  variant = 'primary',
  isLoading = false,
  disabled = false,
  onPress,
  size = 'medium',
  style,
  textStyle,
  className,
  ...props
}) => {
  // Determine button classes based on variant and size
  const getButtonClasses = () => {
    let baseClasses = "rounded-lg items-center justify-center flex-row shadow-sm";
    
    // Size classes
    const sizeClasses = {
      small: "py-1.5 px-3",
      medium: "py-2.5 px-4",
      large: "py-3.5 px-5"
    };
    baseClasses += ` ${sizeClasses[size] || sizeClasses.medium}`;
    
    // Variant classes
    const variantClasses = {
      primary: "bg-primary",
      secondary: "bg-secondary",
      outline: "bg-transparent border border-primary",
      outlineSecondary: "bg-transparent border border-secondary", 
      danger: "bg-danger",
      text: "bg-transparent"
    };
    baseClasses += ` ${variantClasses[variant] || variantClasses.primary}`;
    
    // Disabled state
    if (disabled || isLoading) {
      baseClasses += " opacity-50";
    }
    
    return baseClasses;
  };
  
  const getTextClasses = () => {
    let baseClasses = "font-semibold";
    
    // Size classes
    const sizeClasses = {
      small: "text-xs",
      medium: "text-sm",
      large: "text-base"
    };
    baseClasses += ` ${sizeClasses[size] || sizeClasses.medium}`;
    
    // Variant classes
    const variantClasses = {
      primary: "text-white",
      secondary: "text-dark",
      outline: "text-primary",
      outlineSecondary: "text-secondary", 
      danger: "text-white",
      text: "text-primary"
    };
    baseClasses += ` ${variantClasses[variant] || variantClasses.primary}`;
    
    return baseClasses;
  };
  
  const buttonClasses = `${getButtonClasses()} ${className || ''}`;
  
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
        <ActivityIndicator 
          size="small" 
          color={variant === 'outline' || variant === 'text' || variant === 'outlineSecondary' 
            ? (variant === 'outlineSecondary' ? '#FFC107' : '#006E90') 
            : (variant === 'secondary' ? '#333333' : '#FFFFFF')} 
        />
      ) : (
        <Text className={getTextClasses()} style={textStyle}>{children}</Text>
      )}
    </TouchableOpacity>
  );
};

export default Button;
