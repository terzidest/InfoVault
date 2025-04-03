import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Clipboard } from 'react-native';
import { scale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import useCredentialsStore from '../../store/credentialsStore';
import useSettingsStore from '../../store/settingsStore';
import useAuth from '../../hooks/useAuth';
import CredentialDetailItem from '../../components/features/credentials/CredentialDetailItem';
import Button from '../../components/ui/Button';
import { formatDate } from '../../utils/formatters';

/**
 * View credential screen
 */
const ViewCredential = ({ route, navigation }) => {
  const { id } = route.params;
  const { credentials, getCredentialById, loadCredentials, deleteCredential, isLoading } = useCredentialsStore();
  const { settings } = useSettingsStore();
  const { isAuthenticated, updateLastActive } = useAuth();
  const [credential, setCredential] = useState(null);
  
  // Check authentication and load credentials
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.replace('Authentication');
      return;
    }
    
    if (!id) {
      navigation.goBack();
      return;
    }
  }, [isAuthenticated, id, navigation]);
  
  // Load credential details when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        updateLastActive();
        loadCredentials().then(() => {
          const foundCredential = getCredentialById(id);
          setCredential(foundCredential);
          
          if (!foundCredential) {
            Alert.alert(
              'Error',
              'Credential not found. It may have been deleted.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        });
      }
    }, [isAuthenticated, id])
  );
  
  // Handle clipboard copy
  const handleCopy = (value, label) => {
    Clipboard.setString(value);
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };
  
  // Handle credential deletion
  const handleDelete = () => {
    Alert.alert(
      'Delete Credential',
      'Are you sure you want to delete this credential? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCredential(id);
              navigation.goBack();
            } catch (error) {
              Alert.alert(
                'Error',
                'Failed to delete the credential. Please try again.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };
  
  // Handle credential edit (placeholder for future implementation)
  const handleEdit = () => {
    // This will be implemented in a future version
    Alert.alert(
      'Coming Soon',
      'Editing credentials will be available in a future update.',
      [{ text: 'OK' }]
    );
  };
  
  // If credential is not loaded yet
  if (!credential) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading credential...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons 
            name={credential.website ? 'globe-outline' : 'key-outline'} 
            size={scale(28)} 
            color="#FFFFFF" 
          />
        </View>
        <Text style={styles.title}>{credential.title}</Text>
      </View>
      
      <View style={styles.detailsContainer}>
        <CredentialDetailItem
          label="Username / Email"
          value={credential.username}
          onCopy={() => handleCopy(credential.username, 'Username')}
        />
        
        <CredentialDetailItem
          label="Password"
          value={credential.password}
          isSensitive={settings.maskSensitiveData}
          onCopy={() => handleCopy(credential.password, 'Password')}
        />
        
        <CredentialDetailItem
          label="Website"
          value={credential.website}
          onCopy={() => handleCopy(credential.website, 'Website')}
        />
        
        {credential.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notes</Text>
            <View style={styles.notesContent}>
              <Text style={styles.notesText}>{credential.notes}</Text>
            </View>
          </View>
        )}
        
        <View style={styles.metadataContainer}>
          <Text style={styles.metadataLabel}>Created: </Text>
          <Text style={styles.metadataValue}>
            {formatDate(credential.createdAt, 'medium')}
          </Text>
        </View>
        
        <View style={styles.metadataContainer}>
          <Text style={styles.metadataLabel}>Last Updated: </Text>
          <Text style={styles.metadataValue}>
            {formatDate(credential.updatedAt, 'medium')}
          </Text>
        </View>
      </View>
      
      <View style={styles.actionsContainer}>
        <Button
          variant="outline"
          style={styles.actionButton}
          onPress={handleEdit}
        >
          Edit
        </Button>
        
        <Button
          variant="danger"
          style={styles.actionButton}
          onPress={handleDelete}
          isLoading={isLoading}
        >
          Delete
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  iconContainer: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(12),
    backgroundColor: '#006E90',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  title: {
    fontSize: scale(20),
    fontWeight: '600',
    color: '#333333',
  },
  detailsContainer: {
    padding: scale(16),
  },
  notesContainer: {
    marginBottom: scale(16),
  },
  notesLabel: {
    fontSize: scale(14),
    color: '#666666',
    marginBottom: scale(4),
  },
  notesContent: {
    backgroundColor: '#F5F5F5',
    borderRadius: scale(8),
    padding: scale(12),
  },
  notesText: {
    fontSize: scale(14),
    color: '#333333',
    lineHeight: scale(20),
  },
  metadataContainer: {
    flexDirection: 'row',
    marginBottom: scale(8),
  },
  metadataLabel: {
    fontSize: scale(12),
    color: '#666666',
  },
  metadataValue: {
    fontSize: scale(12),
    color: '#333333',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: scale(16),
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: scale(4),
  },
});

export default ViewCredential;
