import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, InteractionManager, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import useAuth from '../hooks/useAuth';
import useCredentialsStore from '../store/credentialsStore';
import usePersonalInfoStore from '../store/personalInfoStore';
import useNotesStore from '../store/notesStore';
import useSettingsStore from '../store/settingsStore';

import Card from '../components/ui/Card';
import { colors } from '../theme/colors';
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

// Module scope, not inside Home: defining a component inside the render body
// creates a new component type each render, forcing a full unmount/remount of
// every card on every Home re-render.
const CategoryCard: React.FC<CategoryCardProps> = ({ title, icon, onPress, color, description }) => (
  <TouchableOpacity
    style={[styles.categoryCard, { borderLeftColor: color }]}
    onPress={onPress}
  >
    <View style={styles.categoryRow}>
      <View style={[styles.categoryIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.categoryBody}>
        <Text style={styles.categoryTitle}>{title}</Text>
        {description && <Text style={styles.categoryDescription}>{description}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </View>
  </TouchableOpacity>
);

const Home: React.FC<ScreenProps<'Home'>> = ({ navigation }) => {
  const { isAuthenticated, updateLastActive } = useAuth();
  // Field-level selectors: whole-store subscriptions re-render on every set()
  // to that store (isLoading flips included), even while unfocused beneath
  // other stack screens. Select only what this screen renders or calls.
  const credentials = useCredentialsStore((s) => s.credentials);
  const loadCredentials = useCredentialsStore((s) => s.loadCredentials);
  const personalInfo = usePersonalInfoStore((s) => s.personalInfo);
  const loadPersonalInfo = usePersonalInfoStore((s) => s.loadPersonalInfo);
  const notes = useNotesStore((s) => s.notes);
  const loadNotes = useNotesStore((s) => s.loadNotes);
  const initSettings = useSettingsStore((s) => s.initSettings);

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

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={[styles.stat, styles.statDivider]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{credentials.length}</Text>
            <Text style={styles.statLabel}>Credentials</Text>
          </View>
          <View style={[styles.stat, styles.statDivider]}>
            <Text style={[styles.statValue, { color: colors.secondary }]}>{personalInfo.length}</Text>
            <Text style={styles.statLabel}>IDs & Docs</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.success }]}>{notes.length}</Text>
            <Text style={styles.statLabel}>Notes</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionAccent} />
        <Text style={styles.sectionTitle}>Categories</Text>
      </View>

      <View style={styles.categories}>
        <CategoryCard
          title="Credentials"
          description="Store website logins and passwords"
          icon="key-outline"
          onPress={navigateToCredentials}
          color={colors.primary}
        />

        <CategoryCard
          title="IDs & Documents"
          description="Passports, licenses and ID numbers"
          icon="card-outline"
          onPress={navigateToPersonalInfo}
          color={colors.secondary}
        />

        <CategoryCard
          title="Notes"
          description="Secure private notes and ideas"
          icon="document-text-outline"
          onPress={navigateToNotes}
          color={colors.success}
        />
      </View>

      <Card
        style={styles.tipCard}
        variant="accent"
        icon="bulb-outline"
        title="Tip of the day"
      >
        <Text style={styles.tipText}>{getDailyTip()}</Text>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  statsCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statsRow: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  statValue: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: '#4B5563',
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionAccent: {
    width: 4,
    height: 20,
    backgroundColor: colors.secondary,
    borderRadius: 9999,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '600',
    color: colors.dark,
  },
  categories: {
    marginHorizontal: 16,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  categoryBody: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: colors.dark,
  },
  categoryDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
    marginTop: 2,
  },
  tipCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
  },
});

export default Home;
