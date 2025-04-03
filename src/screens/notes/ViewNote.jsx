import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Share } from 'react-native';
import { scale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import useNotesStore from '../../store/notesStore';
import useAuth from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import { formatDate } from '../../utils/formatters';

/**
 * View note screen
 */
const ViewNote = ({ route, navigation }) => {
  const { id } = route.params;
  const { notes, getNoteById, loadNotes, deleteNote, isLoading } = useNotesStore();
  const { isAuthenticated, updateLastActive } = useAuth();
  const [note, setNote] = useState(null);
  
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
  
  // Load note details when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        updateLastActive();
        loadNotes().then(() => {
          const foundNote = getNoteById(id);
          setNote(foundNote);
          
          if (!foundNote) {
            Alert.alert(
              'Error',
              'Note not found. It may have been deleted.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        });
      }
    }, [isAuthenticated, id])
  );
  
  // Get category color
  const getCategoryColor = () => {
    if (!note) return '#9C27B0';
    
    const category = note.category?.toLowerCase() || '';
    
    switch (category) {
      case 'personal':
        return '#4CAF50';
      case 'work':
        return '#2196F3';
      case 'financial':
        return '#FFC107';
      case 'health':
        return '#F44336';
      default:
        return '#9C27B0';
    }
  };
  
  // Handle note share (plain text only)
  const handleShare = async () => {
    if (!note) return;
    
    try {
      await Share.share({
        message: `${note.title}\n\n${note.content}\n\nShared from InfoVault`,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share note');
    }
  };
  
  // Handle note deletion
  const handleDelete = () => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNote(id);
              navigation.goBack();
            } catch (error) {
              Alert.alert(
                'Error',
                'Failed to delete the note. Please try again.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };
  
  // Handle note edit (placeholder for future implementation)
  const handleEdit = () => {
    // This will be implemented in a future version
    Alert.alert(
      'Coming Soon',
      'Editing notes will be available in a future update.',
      [{ text: 'OK' }]
    );
  };
  
  // If note is not loaded yet
  if (!note) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading note...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{note.title}</Text>
        
        <View style={styles.metaContainer}>
          <View 
            style={[
              styles.categoryBadge, 
              { backgroundColor: getCategoryColor() + '30' }
            ]}
          >
            <Text 
              style={[
                styles.categoryText,
                { color: getCategoryColor() }
              ]}
            >
              {note.category}
            </Text>
          </View>
          
          <Text style={styles.dateText}>
            {formatDate(note.updatedAt, 'medium')}
          </Text>
        </View>
      </View>
      
      <View style={styles.contentContainer}>
        <Text style={styles.content}>{note.content}</Text>
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
          variant="outline"
          style={styles.actionButton}
          onPress={handleShare}
        >
          Share
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
    paddingHorizontal: scale(16),
    paddingVertical: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  title: {
    fontSize: scale(22),
    fontWeight: '600',
    color: '#333333',
    marginBottom: scale(8),
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  categoryText: {
    fontSize: scale(12),
    fontWeight: '600',
  },
  dateText: {
    fontSize: scale(12),
    color: '#666666',
  },
  contentContainer: {
    padding: scale(16),
    paddingBottom: scale(32),
  },
  content: {
    fontSize: scale(16),
    color: '#333333',
    lineHeight: scale(24),
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

export default ViewNote;
