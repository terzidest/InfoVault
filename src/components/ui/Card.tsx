import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type CardVariant = 'default' | 'outlined' | 'elevated' | 'accent';

interface CardProps {
  title?: string;
  children?: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
}

const Card: React.FC<CardProps> = ({
  title,
  children,
  variant = 'default',
  onPress,
  style,
  icon,
  iconColor,
  ...props
}) => {
  const renderContent = () => (
    <View style={styles.content}>
      {(title || icon) && (
        <View style={styles.header}>
          {icon && (
            <Ionicons
              name={icon}
              size={20}
              color={iconColor || '#FFC107'}
              style={{ marginRight: 8 }}
            />
          )}
          {title && (
            <Text style={styles.title}>{title}</Text>
          )}
        </View>
      )}
      <View>{children}</View>
    </View>
  );

  const cardStyle = [styles.base, variantStyles[variant], style];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.8}
        {...props}
      >
        {renderContent()}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle} {...props}>
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: colors.dark,
  },
});

const variantStyles = StyleSheet.create<Record<CardVariant, ViewStyle>>({
  default: {},
  outlined: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  accent: {
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
});

export default Card;
