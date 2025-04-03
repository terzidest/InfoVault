import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import useAuth from '../hooks/useAuth';
import useCredentialsStore from '../store/credentialsStore';
import usePersonalInfoStore from '../store/personalInfoStore';
import useNotesStore from '../store/notesStore';
import useSettingsStore from '../store/settingsStore';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

/**
 * Home screen with category overview
 */
const Home = ({ navigation }) => {
  const { isAuthenticated, updateLastActive } = useAuth();
  const { credentials, loadCredentials } = useCredentialsStore();
  const { personalInfo, loadPersonalInfo } = usePersonalInfoStore();
  const { notes, loadNotes } = useNotesStore();
  const { initSettings } = useSettingsStore();
  
  // Check authentication before loading data
  useEffect(() => {
    if (!isAuthenticated) {
      navigation.replace('Authentication');
    }
  }, [isAuthenticated, navigation]);
  
  // Load data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        updateLastActive();
        initSettings();
        loadCredentials();
        loadPersonalInfo();
        loadNotes();
      }
    }, [isAuthenticated])
  );
  
  // Navigate to category screens
  const navigateToCredentials = () => navigation.navigate('CredentialsList');
  const navigateToPersonalInfo = () => navigation.navigate('PersonalInfoList');
  const navigateToNotes = () => navigation.navigate('NotesList');
  const navigateToSettings = () => navigation.navigate('Settings');
  
  // Card for each category
  const CategoryCard = ({ title, icon, count, onPress, color, description }) => (
    <TouchableOpacity 
      className="bg-white rounded-lg p-4 mb-3 shadow-sm border-l-4" 
      style={{ borderLeftColor: color }}
      onPress={onPress}
    >
      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-full justify-center items-center mr-4" style={{ backgroundColor: color + '20' }}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-medium text-dark">{title}</Text>
          {description && <Text className="text-xs text-gray-500 mt-0.5">{description}</Text>}
          <Text className="text-xs text-gray-500 mt-1.5">{count} items</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999999" />
      </View>
    </TouchableOpacity>
  );
  
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-4 pt-6 pb-4 bg-primary">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-2xl font-bold text-white">InfoVault</Text>
          <TouchableOpacity 
            onPress={navigateToSettings} 
            className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
          >
            <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <Text className="text-sm text-white/80">Your secure information vault</Text>
      </View>
      
      <View className="mx-4 -mt-4 mb-6 bg-white rounded-lg p-4 shadow-sm">
        <View className="flex-row">
          <View className="flex-1 items-center border-r border-gray-100">
            <Text className="text-2xl font-bold text-primary mb-1">{credentials.length}</Text>
            <Text className="text-xs text-gray-600">Credentials</Text>
          </View>
          <View className="flex-1 items-center border-r border-gray-100">
            <Text className="text-2xl font-bold text-secondary mb-1">{personalInfo.length}</Text>
            <Text className="text-xs text-gray-600">Personal Info</Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-2xl font-bold text-success mb-1">{notes.length}</Text>
            <Text className="text-xs text-gray-600">Notes</Text>
          </View>
        </View>
      </View>
      
      <View className="mx-4 mb-3 flex-row items-center">
        <View className="w-1 h-5 bg-secondary rounded-full mr-2" />
        <Text className="text-lg font-semibold text-dark">Categories</Text>
      </View>
      
      <View className="mx-4">
        <CategoryCard
          title="Credentials"
          description="Store website logins and passwords"
          icon="key-outline"
          count={credentials.length}
          onPress={navigateToCredentials}
          color="#006E90"
        />
        
        <CategoryCard
          title="Personal Information"
          description="Keep IDs, passports and documents"
          icon="card-outline"
          count={personalInfo.length}
          onPress={navigateToPersonalInfo}
          color="#FFC107"
        />
        
        <CategoryCard
          title="Notes"
          description="Secure private notes and ideas"
          icon="document-text-outline"
          count={notes.length}
          onPress={navigateToNotes}
          color="#4CAF50"
        />
      </View>
      
      <Card
        className="mx-4 mt-4 mb-6"
        variant="accent"
        icon="bulb-outline"
        title="Tip of the day"
      >
        <Text className="text-sm text-gray-600">
          Use strong, unique passwords for each of your accounts to enhance security.
        </Text>
      </Card>
      
      <View className="mx-4 mb-8 flex-row">
        <Button 
          variant="outlineSecondary" 
          className="flex-1 mr-2"
          icon="add-outline"
          onPress={() => navigation.navigate('AddCredential')}
        >
          Add New
        </Button>
        <Button 
          variant="secondary" 
          className="flex-1 ml-2"
          onPress={navigateToSettings}
        >
          Settings
        </Button>
      </View>
    </ScrollView>
  );
};

export default Home;
