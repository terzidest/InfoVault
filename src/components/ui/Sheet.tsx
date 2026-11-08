// Bottom sheet: RN Modal over a 40% black scrim, surface card with rounded
// top corners and a drag handle. Tapping the scrim dismisses. Content is
// padded for the bottom safe area.
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const Sheet: React.FC<SheetProps> = ({ visible, onClose, title, children, style }) => {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  // `surface` is translucent (it layers over the ground gradient); over a
  // scrim the sheet needs an opaque base so content stays legible.
  const sheetBackground = tokens.colors.sheet;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.scrim} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: sheetBackground,
              borderTopLeftRadius: tokens.radius.xxl,
              borderTopRightRadius: tokens.radius.xxl,
              borderColor: tokens.colors.line,
              paddingBottom: Math.max(insets.bottom, tokens.spacing.lg),
            },
            style,
          ]}
        >
          <View style={[styles.handle, { backgroundColor: tokens.colors.faint }]} />
          {title ? (
            <Text style={[tokens.type.barTitle, styles.title, { color: tokens.colors.text }]}>{title}</Text>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
    opacity: 0.6,
  },
  title: { marginBottom: 12 },
});

export default Sheet;
