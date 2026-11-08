import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useSettingsStore from '../../../store/settingsStore';
import { formatRelativeTime } from '../../../utils/formatters';
import { colors } from '../../../theme/colors';
import { obfuscateText } from '../../../utils/masking';
import type { PersonalInfo } from '../../../types/models';

interface PersonalInfoListItemProps {
  personalInfo: PersonalInfo;
  onPress?: () => void;
}

const PersonalInfoListItem: React.FC<PersonalInfoListItemProps> = ({ personalInfo, onPress }) => {
  const maskSensitiveData = useSettingsStore((s) => s.settings.maskSensitiveData);

  // The identifier is a sensitive field (passport/ID/tax numbers): the list
  // shows a partially-masked form; the full value lives behind the detail
  // view's reveal control.
  const subtitle = personalInfo.identifier
    ? maskSensitiveData
      ? obfuscateText(personalInfo.identifier, true)
      : personalInfo.identifier
    : 'No details';

  const getIconName = (): React.ComponentProps<typeof Ionicons>['name'] => {
    const type = personalInfo.type?.toLowerCase() || '';

    if (type.includes('passport')) return 'document-outline';
    if (type.includes('license')) return 'car-outline';
    if (type.includes('id') || type.includes('card')) return 'card-outline';
    if (type.includes('tax')) return 'cash-outline';

    return 'person-outline';
  };

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.icon, { backgroundColor: '#FFC107' }]}>
        <Ionicons name={getIconName()} size={20} color="#333333" />
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {personalInfo.title || personalInfo.type || 'Untitled'}
        </Text>

        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>

        <Text style={styles.timestamp}>
          {formatRelativeTime(personalInfo.updatedAt)}
        </Text>
      </View>

      <View style={styles.chevron}>
        <Ionicons name="chevron-forward" size={20} color="#BBBBBB" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  body: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: colors.dark,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    lineHeight: 16,
    color: '#9CA3AF',
  },
  chevron: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Memoized: list re-renders must not re-render every visible row.
export default React.memo(PersonalInfoListItem);
