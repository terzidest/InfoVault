import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { scale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import useCredentialsStore from '../../store/credentialsStore';
import useAuth from '../../hooks/useAuth';
import CredentialListItem from '../../components/features/credentials/CredentialListItem';
import SearchBar from '../../components/ui/SearchBar';
import type { ScreenProps } from '../../types/navigation';
import type { Credential } from '../../types/models';

const CredentialsList: React.FC<ScreenProps<'CredentialsList'>> = ({ navigation }) => {
  const { credentials, loadCredentials } = useCredentialsStore();
  const { isAuthenticated, updateLastActive } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const q = searchQuery.trim().toLowerCase();

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.replace('Authentication');
    }
  }, [isAuthenticated, navigation]);

  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        updateLastActive();
        loadCredentials();
      }
    }, [isAuthenticated, updateLastActive, loadCredentials])
  );

  const handleAddCredential = () => {
    navigation.navigate('AddCredential');
  };

  const handleViewCredential = (credential: Credential) => {
    navigation.navigate('ViewCredential', { id: credential.id });
  };

  const filteredCredentials = q
    ? credentials.filter(
        (cred) =>
          cred.title?.toLowerCase().includes(q) ||
          cred.username?.toLowerCase().includes(q) ||
          cred.website?.toLowerCase().includes(q)
      )
    : credentials;

  const renderEmptyState = () => {
    if (credentials.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="key-outline" size={scale(60)} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>No Credentials Yet</Text>
          <Text style={styles.emptySubtitle}>
            Add your first credential by tapping the plus button below
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={scale(60)} color="#CCCCCC" />
        <Text style={styles.emptyTitle}>No matches</Text>
        <Text style={styles.emptySubtitle}>No credentials match your search.</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search credentials…"
        />
      </View>

      <FlatList
        data={filteredCredentials}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CredentialListItem
            credential={item}
            onPress={() => handleViewCredential(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        keyboardShouldPersistTaps="handled"
      />

      <TouchableOpacity style={styles.addButton} onPress={handleAddCredential}>
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
    backgroundColor: '#006E90',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

export default CredentialsList;
