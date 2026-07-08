import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useSettingsStore from '../../../store/settingsStore';
import { formatRelativeTime } from '../../../utils/formatters';
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
      className="flex-row items-center bg-white rounded-lg mb-3 p-3 border border-gray-100 shadow-sm"
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View
        className="w-10 h-10 rounded-lg justify-center items-center mr-3"
        style={{ backgroundColor: '#FFC107' }}
      >
        <Ionicons name={getIconName()} size={20} color="#333333" />
      </View>

      <View className="flex-1 mr-2">
        <Text className="text-base font-medium text-dark mb-0.5" numberOfLines={1}>
          {personalInfo.title || personalInfo.type || 'Untitled'}
        </Text>

        <Text className="text-sm text-gray-600 mb-1" numberOfLines={1}>
          {subtitle}
        </Text>

        <Text className="text-xs text-gray-400">
          {formatRelativeTime(personalInfo.updatedAt)}
        </Text>
      </View>

      <View className="h-10 w-10 items-center justify-center">
        <Ionicons name="chevron-forward" size={20} color="#BBBBBB" />
      </View>
    </TouchableOpacity>
  );
};

// Memoized: list re-renders must not re-render every visible row.
export default React.memo(PersonalInfoListItem);
