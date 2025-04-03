import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Reusable Card component for displaying information
 * 
 * @param {string} title - Card title
 * @param {node} children - Card content
 * @param {string} variant - 'default', 'outlined', 'elevated', 'accent'
 * @param {boolean} onPress - Makes card touchable and calls this function on press
 * @param {object} style - Additional style overrides
 * @param {string} icon - Optional icon name (Ionicons)
 * @param {string} iconColor - Optional icon color
 */
const Card = ({
  title,
  children,
  variant = 'default',
  onPress,
  style,
  className,
  icon,
  iconColor,
  ...props
}) => {
  // Get card style based on variant
  const getCardClassNames = () => {
    const baseClasses = "rounded-lg my-2 overflow-hidden";
    
    switch (variant) {
      case 'outlined':
        return `${baseClasses} bg-white border border-gray-200`;
      case 'elevated':
        return `${baseClasses} bg-white shadow-md`;
      case 'accent':
        return `${baseClasses} bg-white border-l-4 border-secondary shadow-sm`;
      default:
        return `${baseClasses} bg-white`;
    }
  };
  
  // Render card content
  const renderContent = () => (
    <View className="p-4">
      {(title || icon) && (
        <View className="flex-row items-center mb-2">
          {icon && (
            <Ionicons 
              name={icon} 
              size={20} 
              color={iconColor || '#FFC107'} 
              style={{ marginRight: 8 }} 
            />
          )}
          {title && (
            <Text className="text-base font-semibold text-dark">{title}</Text>
          )}
        </View>
      )}
      <View>{children}</View>
    </View>
  );
  
  const cardClassNames = `${getCardClassNames()} ${className || ''}`;
  
  // If onPress is provided, make the card touchable
  if (onPress) {
    return (
      <TouchableOpacity
        className={cardClassNames}
        style={style}
        onPress={onPress}
        activeOpacity={0.8}
        {...props}
      >
        {renderContent()}
      </TouchableOpacity>
    );
  }
  
  // Otherwise render a regular view
  return (
    <View className={cardClassNames} style={style} {...props}>
      {renderContent()}
    </View>
  );
};

export default Card;
