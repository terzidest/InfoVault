// Record detail: template icon, title, tags, then every field rendered by
// kind through FieldValue (secrets masked with reveal and auto-hide, numbers
// large and grouped, urls open, dates show expiry). Pin and edit live in the
// top row; delete sits at the bottom behind a confirmation.
import React, { useCallback, useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import useAuth from '../hooks/useAuth';
import useRecordsStore from '../store/recordsStore';
import { useTheme } from '../theme/useTheme';
import { ActionButton, Eyebrow, IconButton, RecordTitle, RowTitle, Screen, Tag } from '../components/ui';
import { FieldValue, TemplateIcon } from '../components/features/records';
import { TEMPLATES } from '../utils/records';
import { formatRelativeTime } from '../utils/formatters';
import type { ScreenProps } from '../types/navigation';

const RecordScreen: React.FC<ScreenProps<'Record'>> = ({ navigation, route }) => {
  const { id } = route.params;
  const { tokens } = useTheme();
  const { isAuthenticated, updateLastActive } = useAuth();
  // Selecting the one record keeps this screen quiet while others change.
  const record = useRecordsStore((s) => s.records.find((r) => r.id === id));
  const togglePin = useRecordsStore((s) => s.togglePin);
  const remove = useRecordsStore((s) => s.remove);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) updateLastActive();
    }, [isAuthenticated, updateLastActive])
  );

  // Deleted here or elsewhere (or locked, which empties the store): nothing to
  // show, so leave. This is the single place that navigates away after a
  // delete, so the handler below does not navigate itself.
  useEffect(() => {
    if (!record && navigation.canGoBack()) navigation.goBack();
  }, [record, navigation]);

  if (!record) return <Screen />;

  const edit = () => navigation.navigate('AddEditRecord', { id: record.id });

  const confirmDelete = () => {
    Alert.alert('Delete this record?', `"${record.title}" will be removed from the vault.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          remove(record.id).catch(() => {
            Alert.alert('Could not delete', 'The record was not removed. Try again.');
          });
        },
      },
    ]);
  };

  const template = TEMPLATES[record.template];

  return (
    <Screen>
      <View style={[styles.topRow, { paddingHorizontal: tokens.spacing.lg, gap: tokens.spacing.sm }]}>
        <IconButton icon="chevron-back" accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <View style={styles.spacer} />
        <IconButton
          icon={record.pinned ? 'star' : 'star-outline'}
          tone={record.pinned ? 'amber' : 'default'}
          accessibilityLabel={record.pinned ? 'Unpin record' : 'Pin record'}
          onPress={() => {
            togglePin(record.id).catch(() => {
              Alert.alert('Could not update', 'The pin was not saved. Try again.');
            });
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit record"
          onPress={edit}
          hitSlop={8}
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
        >
          <RowTitle color={tokens.colors.accent}>Edit</RowTitle>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: tokens.spacing.lg, paddingBottom: tokens.spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { marginBottom: tokens.spacing.xl }]}>
          <TemplateIcon template={record.template} size="lg" />
          <View style={[styles.headerText, { marginLeft: tokens.spacing.lg }]}>
            <Eyebrow numberOfLines={1} style={{ marginBottom: tokens.spacing.xs }}>
              {`${template.label} · updated ${formatRelativeTime(record.updatedAt)}`}
            </Eyebrow>
            <RecordTitle>{record.title}</RecordTitle>
          </View>
        </View>

        {record.tags.length > 0 ? (
          <View style={[styles.tags, { gap: tokens.spacing.sm, marginBottom: tokens.spacing.xl }]}>
            {record.tags.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </View>
        ) : null}

        <View style={{ gap: tokens.spacing.md }}>
          {record.fields.map((field) => (
            <FieldValue key={field.id} field={field} />
          ))}
        </View>

        <View style={[styles.actions, { marginTop: tokens.spacing.xxxl, gap: tokens.spacing.md }]}>
          <ActionButton title="Delete" variant="ghostDanger" onPress={confirmDelete} style={styles.action} />
          <ActionButton title="Edit record" variant="teal" onPress={edit} style={styles.action} />
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
  },
  spacer: { flex: 1 },
  editButton: {
    height: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap' },
  actions: { flexDirection: 'row' },
  action: { flex: 1 },
});

export default RecordScreen;
