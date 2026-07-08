import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, InteractionManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import useAuth from '../hooks/useAuth';
import useCredentialsStore from '../store/credentialsStore';
import usePersonalInfoStore from '../store/personalInfoStore';
import useNotesStore from '../store/notesStore';
import useSettingsStore from '../store/settingsStore';

import Card from '../components/ui/Card';
import type { ScreenProps } from '../types/navigation';

interface CategoryCardProps {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  color: string;
  description?: string;
}

// Rotated daily by day-of-year; keeps "tip of the day" honest without a backend.
const SECURITY_TIPS = [
  'Use a strong, unique password for every account — the generator can make one for you.',
  'Enable biometric unlock in Settings for fast access without weakening your master password.',
  'Never share your master password. InfoVault cannot recover it if you forget it.',
  'Review your stored credentials occasionally and delete accounts you no longer use.',
  'A longer password beats a complex short one — aim for 16 characters or more.',
  'Turn on auto-lock with a short timeout if you often leave your phone unattended.',
  'Avoid reusing your master password anywhere else — it protects everything in this vault.',
  'Update passwords for critical accounts (email, banking) at least once a year.',
] as const;

const getDailyTip = (): string => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
  return SECURITY_TIPS[dayOfYear % SECURITY_TIPS.length] ?? SECURITY_TIPS[0];
};

const Home: React.FC<ScreenProps<'Home'>> = ({ navigation }) => {
  const { isAuthenticated, updateLastActive } = useAuth();
  const { credentials, loadCredentials } = useCredentialsStore();
  const { personalInfo, loadPersonalInfo } = usePersonalInfoStore();
  const { notes, loadNotes } = useNotesStore();
  const { initSettings } = useSettingsStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.replace('Authentication');
    }
  }, [isAuthenticated, navigation]);

  useFocusEffect(
    React.useCallback(() => {
      if (!isAuthenticated) return;
      // Defer store reloads (SecureStore reads + per-record decryption) until
      // the navigation transition has finished, so the animation stays smooth.
      const task = InteractionManager.runAfterInteractions(() => {
        updateLastActive();
        initSettings();
        loadCredentials();
        loadPersonalInfo();
        loadNotes();
      });
      return () => task.cancel();
    }, [isAuthenticated, updateLastActive, initSettings, loadCredentials, loadPersonalInfo, loadNotes])
  );

  const navigateToCredentials = () => navigation.navigate('CredentialsList');
  const navigateToPersonalInfo = () => navigation.navigate('PersonalInfoList');
  const navigateToNotes = () => navigation.navigate('NotesList');

  const CategoryCard: React.FC<CategoryCardProps> = ({ title, icon, onPress, color, description }) => (
    <TouchableOpacity
      className="bg-white rounded-lg p-4 mb-3 shadow-sm border-l-4"
      style={{ borderLeftColor: color }}
      onPress={onPress}
    >
      <View className="flex-row items-center">
        <View
          className="w-12 h-12 rounded-full justify-center items-center mr-4"
          style={{ backgroundColor: color + '20' }}
        >
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-medium text-dark">{title}</Text>
          {description && <Text className="text-xs text-gray-500 mt-0.5">{description}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999999" />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="mx-4 mt-4 mb-6 bg-white rounded-lg p-4 shadow-sm">
        <View className="flex-row">
          <View className="flex-1 items-center border-r border-gray-100">
            <Text className="text-2xl font-bold text-primary mb-1">{credentials.length}</Text>
            <Text className="text-xs text-gray-600">Credentials</Text>
          </View>
          <View className="flex-1 items-center border-r border-gray-100">
            <Text className="text-2xl font-bold text-secondary mb-1">{personalInfo.length}</Text>
            <Text className="text-xs text-gray-600">IDs & Docs</Text>
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
          onPress={navigateToCredentials}
          color="#006E90"
        />

        <CategoryCard
          title="IDs & Documents"
          description="Passports, licenses and ID numbers"
          icon="card-outline"
          onPress={navigateToPersonalInfo}
          color="#FFC107"
        />

        <CategoryCard
          title="Notes"
          description="Secure private notes and ideas"
          icon="document-text-outline"
          onPress={navigateToNotes}
          color="#4CAF50"
        />
      </View>

      <Card
        className="mx-4 mt-4 mb-8"
        variant="accent"
        icon="bulb-outline"
        title="Tip of the day"
      >
        <Text className="text-sm text-gray-600">{getDailyTip()}</Text>
      </Card>
    </ScrollView>
  );
};

export default Home;
