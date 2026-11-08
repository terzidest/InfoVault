import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '../../../utils/formatters';
import { colors } from '../../../theme/colors';
import type { Credential } from '../../../types/models';

interface CredentialListItemProps {
  credential: Credential;
  onPress?: () => void;
}

const CredentialListItem: React.FC<CredentialListItemProps> = ({ credential, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={[styles.icon, { backgroundColor: '#006E90' }]}>
        <Ionicons
          name={credential.website ? 'globe-outline' : 'key-outline'}
          size={20}
          color="#FFFFFF"
        />
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {credential.title || credential.username || 'Untitled Credential'}
        </Text>

        <Text style={styles.subtitle} numberOfLines={1}>
          {credential.username || credential.website || 'No details'}
        </Text>

        <Text style={styles.timestamp}>
          {formatRelativeTime(credential.updatedAt)}
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
export default React.memo(CredentialListItem);
