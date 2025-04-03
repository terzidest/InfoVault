import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { scale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import useCredentialsStore from '../../store/credentialsStore';
import useAuth from '../../hooks/useAuth';
import CredentialListItem from '../../components/features/credentials/CredentialListItem';

/**
 * Credentials list screen
 */
const CredentialsList = ({ navigation }) => {
  const { credentials, loadCredentials, isLoading } = useCredentialsStore();
  const { isAuthenticated, updateLastActive } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Handle authentication check
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.replace('Authentication');
    }
  }, [isAuthenticated, navigation]);
  
  // Load credentials when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        updateLastActive();
        loadCredentials();
      }
    }, [isAuthenticated])
  );
  
  // Navigate to add credential screen
  const handleAddCredential = () => {
    navigation.navigate('AddCredential');
  };
  
  // Navigate to credential details screen
  const handleViewCredential = (credential) => {
    navigation.navigate('ViewCredential', { id: credential.id });
  };
  
  // Filter credentials based on search query
  const filteredCredentials = searchQuery.length > 0
    ? credentials.filter(cred => 
        cred.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cred.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cred.website?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : credentials;
  
  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="key-outline" size={scale(60)} color="#CCCCCC" />
      <Text style={styles.emptyTitle}>No Credentials Yet</Text>
      <Text style={styles.emptySubtitle}>
        Add your first credential by tapping the plus button below
      </Text>
    </View>
  );
  
  return (
    <View style={styles.container}>
      {/* Search bar (disabled for MVP) */}
      {/* <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={scale(20)} color="#999999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search credentials..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View> */}
      
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: scale(8),
    marginHorizontal: scale(16),
    marginVertical: scale(12),
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
  },
  searchInput: {
    flex: 1,
    fontSize: scale(14),
    marginLeft: scale(8),
    color: '#333333',
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
