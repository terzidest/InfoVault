// The vault door: an SVG dial lock (ring, retracting bolts, door disc,
// spinning wheel, keyhole) with the unlock sequence driven by Reanimated.
//
// Animation strategy: react-native-svg's native elements understand only
// `matrix` and `opacity` as transform-ish props (rotation/translate are
// computed in JS at render time), so Reanimated `animatedProps` is used
// only for props that map 1:1 to native — the bolt rect `y`, the glow and
// heat `opacity`. Whole-group transforms (wheel rotation, door scale) wrap
// their own <Svg> in an Animated.View instead. Four stacked Svgs in total.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  type SharedValue,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../../theme/useTheme';
import { rgba } from '../../../theme/tokens';
import {
  BOLT,
  BOLT_ANGLES,
  BOLT_TRAVEL,
  CENTER,
  DIAL_DASH,
  DOOR_RADIUS,
  HUB_DOT_ANGLES,
  HUB_DOT_RADIUS,
  RING_RADIUS,
  RIVET_ANGLES,
  RIVET_RADIUS,
  SPOKE_ANGLES,
  TICK_ANGLES,
  TICK_INNER,
  TICK_OUTER,
  VIEWBOX,
  WHEEL_TURNS_DEG,
  polar,
} from './vaultGeometry';

export type VaultDoorState = 'locked' | 'unlocking' | 'open';

/** How long the caller should wait after `unlocking` before setting `open`. */
export const UNLOCK_SEQUENCE_MS = 1700;

const BOLTS_MS = 700;
const WHEEL_MS = 1800;
const OPEN_SCALE_MS = 800;
const GLOW_MS = 600;
const HEAT_OPACITY = 0.35;
const GLOW_OPACITY = 0.45;
const OPEN_SCALE = 1.06;

const easeStandard = Easing.bezier(0.2, 0.7, 0.2, 1);
const easeWheel = Easing.bezier(0.3, 0.7, 0.2, 1);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface VaultDoorProps {
  size?: number;
  state: VaultDoorState;
}

const ORIGIN = `${CENTER}, ${CENTER}`;
const VIEW_BOX = `0 0 ${VIEWBOX} ${VIEWBOX}`;

interface BoltProps {
  angle: number;
  y: SharedValue<number>;
}

// One bolt at 12 o'clock, rotated into place. Only `y` animates (a native
// prop), and because the group rotation is static the rect slides along its
// own axis toward the centre.
const Bolt: React.FC<BoltProps> = ({ angle, y }) => {
  const animatedProps = useAnimatedProps(() => ({ y: BOLT.y + y.value }));
  return (
    <G rotation={angle} origin={ORIGIN}>
      <AnimatedRect
        animatedProps={animatedProps}
        x={BOLT.x}
        width={BOLT.width}
        height={BOLT.height}
        rx={BOLT.rx}
        fill="url(#boltFill)"
        stroke="rgba(0,0,0,0.45)"
        strokeWidth={1}
      />
    </G>
  );
};

const VaultDoor: React.FC<VaultDoorProps> = ({ size = VIEWBOX, state }) => {
  const { tokens, scheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const accentRgb = tokens.colors.accentRgb;
  const amber = tokens.colors.amber;
  const dark = scheme === 'dark';

  const ringStops: [string, string] = dark ? ['#39C6E8', '#006E90'] : ['#0E8BB3', '#003F55'];
  const tickStroke = dark ? rgba(accentRgb, 0.5) : 'rgba(0,110,144,0.6)';
  const dialStroke = rgba(accentRgb, 0.22);
  const heatStroke = tokens.colors.accent;

  // Shared values: 0 = fully locked.
  const bolt = useSharedValue(0); // 0 → BOLT_TRAVEL
  const wheel = useSharedValue(0); // degrees
  const heat = useSharedValue(0); // ring halo opacity
  const scale = useSharedValue(1); // door group
  const glow = useSharedValue(0); // keyhole glow opacity

  useEffect(() => {
    const timing = (to: number, ms: number, easing = easeStandard) =>
      reduceMotion ? to : withTiming(to, { duration: ms, easing });

    if (state === 'locked') {
      // Reset without motion: the door snaps shut when the vault locks.
      bolt.value = 0;
      wheel.value = 0;
      heat.value = 0;
      scale.value = 1;
      glow.value = 0;
      return;
    }
    if (state === 'unlocking') {
      bolt.value = timing(BOLT_TRAVEL, BOLTS_MS);
      wheel.value = timing(WHEEL_TURNS_DEG, WHEEL_MS, easeWheel);
      heat.value = timing(HEAT_OPACITY, BOLTS_MS);
      return;
    }
    // 'open': the bolt/wheel timings keep running to their ends; only the
    // door swells and the keyhole lights up. Also covers a direct
    // locked→open jump (reduced motion callers) by landing the end states.
    bolt.value = timing(BOLT_TRAVEL, BOLTS_MS);
    wheel.value = timing(WHEEL_TURNS_DEG, WHEEL_MS, easeWheel);
    heat.value = timing(HEAT_OPACITY, BOLTS_MS);
    scale.value = timing(OPEN_SCALE, OPEN_SCALE_MS);
    glow.value = timing(GLOW_OPACITY, GLOW_MS);
  }, [state, reduceMotion, bolt, wheel, heat, scale, glow]);

  const heatProps = useAnimatedProps(() => ({ opacity: heat.value }));
  const glowProps = useAnimatedProps(() => ({ opacity: glow.value }));
  const wheelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wheel.value}deg` }] }));
  const doorStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const layer = { width: size, height: size };

  return (
    <View style={[layer, styles.root]} accessible accessibilityRole="image" accessibilityLabel="Vault door">
      {/* Layer 1: ring heat halo + outer ring + ticks (static frame). */}
      <Svg width={size} height={size} viewBox={VIEW_BOX} style={styles.layer}>
        <Defs>
          <LinearGradient id="ringStroke" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={ringStops[0]} />
            <Stop offset="1" stopColor={ringStops[1]} />
          </LinearGradient>
        </Defs>
        <AnimatedCircle
          animatedProps={heatProps}
          cx={CENTER}
          cy={CENTER}
          r={RING_RADIUS}
          stroke={heatStroke}
          strokeWidth={6}
          fill="none"
        />
        <Circle cx={CENTER} cy={CENTER} r={RING_RADIUS} stroke="url(#ringStroke)" strokeWidth={3} fill="none" />
        {TICK_ANGLES.map((a) => {
          const from = polar(TICK_INNER, a);
          const to = polar(TICK_OUTER, a);
          return (
            <Line
              key={a}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={tickStroke}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>

      {/* Door group: scales to 1.06 on open. */}
      <Animated.View style={[layer, styles.layer, doorStyle]}>
        {/* Layer 2: door disc, bevels, rivets, dial ring, bolts. */}
        <Svg width={size} height={size} viewBox={VIEW_BOX} style={styles.layer}>
          <Defs>
            <RadialGradient id="doorFill" cx="50%" cy="40%" r="60%" fx="50%" fy="40%">
              <Stop offset="0" stopColor="#14283A" />
              <Stop offset="1" stopColor="#0B1826" />
            </RadialGradient>
            <LinearGradient id="boltFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#2E5068" />
              <Stop offset="1" stopColor="#10243A" />
            </LinearGradient>
          </Defs>
          <Circle cx={CENTER} cy={CENTER} r={DOOR_RADIUS} fill="url(#doorFill)" stroke="rgba(255,255,255,0.1)" />
          <Circle cx={CENTER} cy={CENTER} r={97} stroke="rgba(0,0,0,0.45)" strokeWidth={2} fill="none" />
          <Circle cx={CENTER} cy={CENTER} r={94} stroke="rgba(255,255,255,0.07)" strokeWidth={1} fill="none" />
          {RIVET_ANGLES.map((a) => {
            const p = polar(RIVET_RADIUS, a);
            return (
              <Circle key={a} cx={p.x} cy={p.y} r={2.6} fill="#16283A" stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
            );
          })}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={80}
            stroke={dialStroke}
            strokeWidth={4}
            strokeDasharray={DIAL_DASH}
            fill="none"
          />
          {BOLT_ANGLES.map((a) => (
            <Bolt key={a} angle={a} y={bolt} />
          ))}
        </Svg>

        {/* Layer 3: the wheel, rotated as a whole view about its centre. */}
        <Animated.View style={[layer, styles.layer, wheelStyle]}>
          <Svg width={size} height={size} viewBox={VIEW_BOX}>
            <Defs>
              <LinearGradient id="rimStroke" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#5ED8F2" />
                <Stop offset="0.5" stopColor="#1FA6D1" />
                <Stop offset="1" stopColor="#075E7C" />
              </LinearGradient>
              <LinearGradient id="spokeStroke" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#5ED8F2" />
                <Stop offset="0.5" stopColor="#1FA6D1" />
                <Stop offset="1" stopColor="#075E7C" />
              </LinearGradient>
              <RadialGradient id="knobFill" cx="40%" cy="35%" r="70%" fx="40%" fy="35%">
                <Stop offset="0" stopColor="#4FCDEB" />
                <Stop offset="1" stopColor="#0C6F90" />
              </RadialGradient>
              <RadialGradient id="hubFill" cx="50%" cy="40%" r="65%" fx="50%" fy="40%">
                <Stop offset="0" stopColor="#1B3448" />
                <Stop offset="1" stopColor="#0B1826" />
              </RadialGradient>
            </Defs>
            {/* Rim */}
            <Circle cx={CENTER} cy={CENTER} r={58} stroke="#0A4A61" strokeWidth={12} fill="none" />
            <Circle cx={CENTER} cy={CENTER} r={58} stroke="url(#rimStroke)" strokeWidth={8} fill="none" />
            <Circle cx={CENTER} cy={CENTER} r={62.5} stroke="rgba(255,255,255,0.2)" strokeWidth={1} fill="none" />
            <Circle cx={CENTER} cy={CENTER} r={53.5} stroke="rgba(0,0,0,0.5)" strokeWidth={1} fill="none" />
            {/* Spokes + knobs */}
            {SPOKE_ANGLES.map((a) => (
              <G key={a} rotation={a} origin={ORIGIN}>
                <Line x1={CENTER} y1={110} x2={CENTER} y2={58} stroke="#0A4A61" strokeWidth={10} strokeLinecap="round" />
                <Line
                  x1={CENTER}
                  y1={110}
                  x2={CENTER}
                  y2={58}
                  stroke="url(#spokeStroke)"
                  strokeWidth={6}
                  strokeLinecap="round"
                />
                <Circle cx={CENTER} cy={58} r={7.5} fill="url(#knobFill)" stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
                <Circle cx={CENTER - 2.5} cy={55.5} r={2.2} fill="rgba(255,255,255,0.4)" />
              </G>
            ))}
            {/* Hub */}
            <Circle cx={CENTER} cy={CENTER} r={23} fill="url(#hubFill)" stroke="#0A4A61" strokeWidth={4} />
            <Circle cx={CENTER} cy={CENTER} r={23} stroke="url(#rimStroke)" strokeWidth={2} fill="none" />
            <Circle cx={CENTER} cy={CENTER} r={16} stroke="rgba(255,255,255,0.12)" strokeWidth={1} fill="none" />
            {HUB_DOT_ANGLES.map((a) => {
              const p = polar(HUB_DOT_RADIUS, a);
              return <Circle key={a} cx={p.x} cy={p.y} r={1.7} fill="rgba(255,255,255,0.35)" />;
            })}
          </Svg>
        </Animated.View>

        {/* Layer 4: keyhole glow (animated opacity) under the static keyhole. */}
        <Svg width={size} height={size} viewBox={VIEW_BOX} style={styles.layer}>
          <AnimatedCircle animatedProps={glowProps} cx={CENTER} cy={131} r={14} fill={amber} />
          <Circle cx={CENTER} cy={125} r={5.5} fill={amber} />
          <Path d="M127.2 128 H132.8 L134.5 140 H125.5 Z" fill={amber} />
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { position: 'relative' },
  layer: { position: 'absolute', top: 0, left: 0 },
});

export default VaultDoor;
