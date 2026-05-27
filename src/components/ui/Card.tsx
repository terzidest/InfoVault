import React from 'react';
import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type CardVariant = 'default' | 'outlined' | 'elevated' | 'accent';

interface CardProps {
  title?: string;
  children?: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  className?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
}

const Card: React.FC<CardProps> = ({
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
  const getCardClassNames = (): string => {
    const baseClasses = 'rounded-lg my-2 overflow-hidden';

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

  return (
    <View className={cardClassNames} style={style} {...props}>
      {renderContent()}
    </View>
  );
};

export default Card;
