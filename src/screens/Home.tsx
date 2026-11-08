// Home: search first. Brand row with lock and settings, the search field,
// a horizontal strip of pinned records (only while not searching), a sort
// toggle and the record list. Everything the user needs most is one tap
// after unlock: the row's copy button, a pinned card, or the search box.
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import useAuth from '../hooks/useAuth';
import useRecordsStore from '../store/recordsStore';
import useSettingsStore from '../store/settingsStore';
import { useTheme } from '../theme/useTheme';
import { ActionButton, BarTitle, Body, Eyebrow, IconButton, Mono, Screen, Secondary, TextField } from '../components/ui';
import { PINNED_CARD_WIDTH, PinnedCard, RecordRow } from '../components/features/records';
import { searchRecords, sortRecords } from '../utils/records';
import type { ScreenProps } from '../types/navigation';
import type { SortMode, VaultRecord } from '../types/models';

const FAB_SIZE = 58;
const PINNED_GAP = 12;
// Rows past this index enter together; a long list must not trickle in.
const MAX_STAGGERED_ROWS = 10;

const SORT_LABEL: Record<SortMode, string> = {
  lastUsed: 'last used first ⇅',
  az: 'A–Z ⇅',
};

const nextSortMode = (mode: SortMode): SortMode => (mode === 'lastUsed' ? 'az' : 'lastUsed');

const countLabel = (n: number): string => `${n} ${n === 1 ? 'item' : 'items'}`;

interface RowProps {
  record: VaultRecord;
  index: number;
  reduceMotion: boolean;
  stagger: number;
  onPress: (record: VaultRecord) => void;
}

// Module scope: a component defined inside Home would remount every row on
// each Home render. The entering animation runs once per mount (first paint
// and new search hits), never on reorder.
const Row: React.FC<RowProps> = ({ record, index, reduceMotion, stagger, onPress }) => (
  <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(index, MAX_STAGGERED_ROWS) * stagger)}>
    <RecordRow record={record} onPress={onPress} divider={index > 0} />
  </Animated.View>
);

const Home: React.FC<ScreenProps<'Home'>> = ({ navigation }) => {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();
  const { isAuthenticated, updateLastActive, logout } = useAuth();
  // Field-level selectors: never re-render Home for isLoading flips.
  const records = useRecordsStore((s) => s.records);
  const migrationPending = useRecordsStore((s) => s.migrationPending);
  const sortMode = useSettingsStore((s) => s.settings.sortMode);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) updateLastActive();
    }, [isAuthenticated, updateLastActive])
  );

  const searching = query.trim() !== '';
  const results = useMemo(() => sortRecords(searchRecords(records, query), sortMode), [records, query, sortMode]);
  const pinned = useMemo(() => (searching ? [] : results.filter((r) => r.pinned)), [results, searching]);

  const openRecord = useCallback((record: VaultRecord) => navigation.navigate('Record', { id: record.id }), [navigation]);
  const addRecord = () => navigation.navigate('AddEditRecord', {});
  const toggleSort = () => {
    updateSettings({ sortMode: nextSortMode(sortMode) }).catch(() => {});
  };

  const renderRow = ({ item, index }: ListRenderItemInfo<VaultRecord>) => (
    <Row record={item} index={index} reduceMotion={reduceMotion} stagger={tokens.motion.stagger} onPress={openRecord} />
  );

  const header = (
    <View>
      {migrationPending ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.notice,
            {
              marginHorizontal: tokens.spacing.lg,
              marginBottom: tokens.spacing.lg,
              padding: tokens.spacing.md,
              borderRadius: tokens.radius.lg,
              backgroundColor: tokens.colors.surface,
              borderColor: tokens.colors.line,
            },
          ]}
        >
          <Ionicons name="time-outline" size={18} color={tokens.colors.amberText} />
          <Secondary style={[styles.noticeText, { marginLeft: tokens.spacing.sm }]}>
            Some records are still being upgraded. They&apos;ll appear after the next unlock.
          </Secondary>
        </View>
      ) : null}
      {pinned.length > 0 ? (
        <View style={{ marginBottom: tokens.spacing.lg }}>
          <Eyebrow style={{ paddingHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.sm }}>Pinned</Eyebrow>
          <FlatList
            horizontal
            data={pinned}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => <PinnedCard record={item} onPress={openRecord} />}
            snapToInterval={PINNED_CARD_WIDTH + PINNED_GAP}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            // Room for the card shadow, and enough side padding that the next
            // card peeks in from the edge.
            contentContainerStyle={{ paddingHorizontal: tokens.spacing.lg, paddingVertical: 4, gap: PINNED_GAP }}
          />
        </View>
      ) : null}
      <View style={[styles.sortRow, { paddingHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.xs }]}>
        <Eyebrow>{countLabel(results.length)}</Eyebrow>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sort order: ${sortMode === 'lastUsed' ? 'last used first' : 'alphabetical'}. Tap to change`}
          onPress={toggleSort}
          hitSlop={8}
          style={styles.sortButton}
        >
          <Mono variant="value" color={tokens.colors.accent}>
            {SORT_LABEL[sortMode]}
          </Mono>
        </Pressable>
      </View>
    </View>
  );

  const empty = (
    <View style={[styles.empty, { padding: tokens.spacing.xxxl }]}>
      {records.length === 0 ? (
        <>
          <Body style={styles.emptyText}>Nothing in the vault yet</Body>
          <ActionButton title="Add your first record" variant="teal" onPress={addRecord} style={styles.emptyButton} />
        </>
      ) : (
        <Secondary style={styles.emptyText}>{`No matches for '${query.trim()}'`}</Secondary>
      )}
    </View>
  );

  return (
    <Screen>
      <View style={[styles.topRow, { paddingHorizontal: tokens.spacing.lg, gap: tokens.spacing.sm }]}>
        <Ionicons name="shield-checkmark-outline" size={22} color={tokens.colors.amber} />
        <BarTitle style={styles.brand}>
          Info
          <BarTitle color={tokens.colors.amberText}>Vault</BarTitle>
        </BarTitle>
        <IconButton icon="lock-closed-outline" accessibilityLabel="Lock the vault" onPress={logout} />
        <IconButton icon="settings-outline" accessibilityLabel="Settings" onPress={() => navigation.navigate('Settings')} />
      </View>

      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search titles, labels, tags…"
        accessibilityLabel="Search records"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        leading={<Ionicons name="search-outline" size={18} color={tokens.colors.accent} />}
        trailing={
          <Mono variant="value" color={tokens.colors.muted}>
            {countLabel(records.length)}
          </Mono>
        }
        style={{ paddingHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.lg }}
      />

      <FlatList
        data={results}
        keyExtractor={(r) => r.id}
        renderItem={renderRow}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: FAB_SIZE + tokens.spacing.xxxl * 2 }}
      />

      <View
        style={[
          styles.fab,
          tokens.shadows.glowAmber,
          { right: tokens.spacing.xl, bottom: tokens.spacing.xxl },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a record"
          onPress={addRecord}
          style={({ pressed }) => [styles.fabPressable, pressed && styles.fabPressed]}
        >
          <LinearGradient
            colors={tokens.gradients.buttonAmber.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="add" size={30} color={tokens.colors.onAmber} />
        </Pressable>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
  },
  brand: { flex: 1 },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  sortButton: { minHeight: 32, justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  noticeText: { flex: 1 },
  empty: { alignItems: 'center' },
  emptyText: { textAlign: 'center', marginBottom: 20 },
  emptyButton: { alignSelf: 'stretch' },
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
  },
  fabPressable: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPressed: { transform: [{ scale: 0.96 }] },
});

export default Home;
