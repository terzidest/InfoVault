import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { scale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import usePersonalInfoStore from '../../store/personalInfoStore';
import useAuth from '../../hooks/useAuth';
import PersonalInfoListItem from '../../components/features/personalInfo/PersonalInfoListItem';
import SearchBar from '../../components/ui/SearchBar';
import type { ScreenProps } from '../../types/navigation';
import type { PersonalInfo } from '../../types/models';

const PersonalInfoList: React.FC<ScreenProps<'PersonalInfoList'>> = ({ navigation }) => {
  const { personalInfo, loadPersonalInfo } = usePersonalInfoStore();
  const { isAuthenticated, updateLastActive } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const q = searchQuery.trim().toLowerCase();

  const filteredPersonalInfo = q
    ? personalInfo.filter(
        (info) =>
          info.title?.toLowerCase().includes(q) ||
          info.type?.toLowerCase().includes(q) ||
          info.identifier?.toLowerCase().includes(q) ||
          info.issuingAuthority?.toLowerCase().includes(q)
      )
    : personalInfo;

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.replace('Authentication');
    }
  }, [isAuthenticated, navigation]);

  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        updateLastActive();
        loadPersonalInfo();
      }
    }, [isAuthenticated])
  );

  const handleAddPersonalInfo = () => {
    navigation.navigate('AddPersonalInfo');
  };

  const handleViewPersonalInfo = (info: PersonalInfo) => {
    navigation.navigate('ViewPersonalInfo', { id: info.id });
  };

  const renderEmptyState = () => {
    if (personalInfo.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="card-outline" size={scale(60)} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>No Personal Information Yet</Text>
          <Text style={styles.emptySubtitle}>
            Add your personal information like ID numbers, passports, and more
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={scale(60)} color="#CCCCCC" />
        <Text style={styles.emptyTitle}>No matches</Text>
        <Text style={styles.emptySubtitle}>No items match your search.</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search personal info…"
        />
      </View>

      <FlatList
        data={filteredPersonalInfo}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PersonalInfoListItem
            personalInfo={item}
            onPress={() => handleViewPersonalInfo(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        keyboardShouldPersistTaps="handled"
      />

      <TouchableOpacity style={styles.addButton} onPress={handleAddPersonalInfo}>
        <Ionicons name="add" size={scale(24)} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: scale(16),
    paddingTop: scale(12),
  },
  listContent: {
    padding: scale(16),
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: scale(80),
    padding: scale(20),
  },
  emptyTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: '#333333',
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  emptySubtitle: {
    fontSize: scale(14),
    color: '#666666',
    textAlign: 'center',
    maxWidth: '80%',
  },
  addButton: {
    position: 'absolute',
    bottom: scale(20),
    right: scale(20),
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: '#FFC107',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

export default PersonalInfoList;
