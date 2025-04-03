import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Clipboard } from 'react-native';
import { scale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import usePersonalInfoStore from '../../store/personalInfoStore';
import useSettingsStore from '../../store/settingsStore';
import useAuth from '../../hooks/useAuth';
import PersonalInfoDetailItem from '../../components/features/personalInfo/PersonalInfoDetailItem';
import Button from '../../components/ui/Button';
import { formatDate } from '../../utils/formatters';

/**
 * View personal information screen
 */
const ViewPersonalInfo = ({ route, navigation }) => {
  const { id } = route.params;
  const { personalInfo, getPersonalInfoById, loadPersonalInfo, deletePersonalInfo, isLoading } = usePersonalInfoStore();
  const { settings } = useSettingsStore();
  const { isAuthenticated, updateLastActive } = useAuth();
  const [info, setInfo] = useState(null);
  
  // Check authentication and load data
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
  
  // Load personal info details when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        updateLastActive();
        loadPersonalInfo().then(() => {
          const foundInfo = getPersonalInfoById(id);
          setInfo(foundInfo);
          
          if (!foundInfo) {
            Alert.alert(
              'Error',
              'Personal information not found. It may have been deleted.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        });
      }
    }, [isAuthenticated, id])
  );
  
  // Get icon name based on info type
  const getIconName = () => {
    if (!info) return 'person-outline';
    
    const type = info.type?.toLowerCase() || '';
    
    if (type.includes('passport')) return 'document-outline';
    if (type.includes('license')) return 'car-outline';
    if (type.includes('id') || type.includes('card')) return 'card-outline';
    if (type.includes('tax')) return 'cash-outline';
    
    return 'person-outline';
  };
  
  // Handle clipboard copy
  const handleCopy = (value, label) => {
    Clipboard.setString(value);
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };
  
  // Handle personal info deletion
  const handleDelete = () => {
    Alert.alert(
      'Delete Personal Information',
      'Are you sure you want to delete this information? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePersonalInfo(id);
              navigation.goBack();
            } catch (error) {
              Alert.alert(
                'Error',
                'Failed to delete the information. Please try again.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };
  
  // Handle personal info edit (placeholder for future implementation)
  const handleEdit = () => {
    // This will be implemented in a future version
    Alert.alert(
      'Coming Soon',
      'Editing personal information will be available in a future update.',
      [{ text: 'OK' }]
    );
  };
  
  // If personal info is not loaded yet
  if (!info) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading information...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons 
            name={getIconName()} 
            size={scale(28)} 
            color="#FFFFFF" 
          />
        </View>
        <Text style={styles.title}>{info.title}</Text>
        <Text style={styles.subtitle}>{info.type}</Text>
      </View>
      
      <View style={styles.detailsContainer}>
        <PersonalInfoDetailItem
          label="Identifier"
          value={info.identifier}
          isSensitive={settings.maskSensitiveData}
          onCopy={() => handleCopy(info.identifier, 'Identifier')}
        />
        
        {info.issueDate && (
          <PersonalInfoDetailItem
            label="Issue Date"
            value={info.issueDate}
            onCopy={() => handleCopy(info.issueDate, 'Issue Date')}
          />
        )}
        
        {info.expiryDate && (
          <PersonalInfoDetailItem
            label="Expiry Date"
            value={info.expiryDate}
            onCopy={() => handleCopy(info.expiryDate, 'Expiry Date')}
          />
        )}
        
        {info.issuingAuthority && (
          <PersonalInfoDetailItem
            label="Issuing Authority"
            value={info.issuingAuthority}
            onCopy={() => handleCopy(info.issuingAuthority, 'Issuing Authority')}
          />
        )}
        
        {info.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notes</Text>
            <View style={styles.notesContent}>
              <Text style={styles.notesText}>{info.notes}</Text>
            </View>
          </View>
        )}
        
        <View style={styles.metadataContainer}>
          <Text style={styles.metadataLabel}>Created: </Text>
          <Text style={styles.metadataValue}>
            {formatDate(info.createdAt, 'medium')}
          </Text>
        </View>
        
        <View style={styles.metadataContainer}>
          <Text style={styles.metadataLabel}>Last Updated: </Text>
          <Text style={styles.metadataValue}>
            {formatDate(info.updatedAt, 'medium')}
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
    backgroundColor: '#FFC107',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  title: {
    fontSize: scale(20),
    fontWeight: '600',
    color: '#333333',
    marginBottom: scale(4),
  },
  subtitle: {
    fontSize: scale(14),
    color: '#666666',
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

export default ViewPersonalInfo;
