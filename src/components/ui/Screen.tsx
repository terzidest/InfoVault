// Full-screen root for v2 screens: paints the "ground" gradient (a glow at
// the top fading into the background) and applies safe-area padding. `hero`
// swaps in the stronger glow used by the Unlock/Setup screens.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';

interface ScreenProps {
  children?: React.ReactNode;
  /** Use the stronger top glow (Unlock / Setup). */
  hero?: boolean;
  /** Skip the safe-area padding on these edges (e.g. under a header). */
  edges?: ('top' | 'bottom')[];
  style?: StyleProp<ViewStyle>;
}

const Screen: React.FC<ScreenProps> = ({ children, hero = false, edges = ['top', 'bottom'], style }) => {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const glow = hero ? tokens.colors.backgroundGlowHero : tokens.colors.backgroundGlow;
  const { background } = tokens.colors;

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <LinearGradient
        colors={[glow, background, background]}
        locations={tokens.gradients.ground.locations}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.content,
          {
            paddingTop: edges.includes('top') ? insets.top : 0,
            paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
});

export default Screen;
