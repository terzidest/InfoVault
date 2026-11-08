// Typographic primitives. Each maps one `tokens.type` variant to a themed
// <Text>; use these instead of raw <Text> so size, weight, font family and
// color stay consistent across screens.
import React from 'react';
import { Text } from 'react-native';
import type { StyleProp, TextProps, TextStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import type { TypeVariant } from '../../theme/tokens';

interface TypeProps extends Omit<TextProps, 'style'> {
  children?: React.ReactNode;
  /** Override the default color (a token color string). */
  color?: string;
  style?: StyleProp<TextStyle>;
}

type ColorKey = 'text' | 'text2' | 'muted' | 'quiet' | 'faint' | 'accent';

const makeText = (
  variant: TypeVariant,
  defaultColor: ColorKey,
  extra?: TextStyle
): React.FC<TypeProps> => {
  const Component: React.FC<TypeProps> = ({ children, color, style, ...rest }) => {
    const { tokens } = useTheme();
    return (
      <Text style={[tokens.type[variant], { color: color ?? tokens.colors[defaultColor] }, extra, style]} {...rest}>
        {children}
      </Text>
    );
  };
  Component.displayName = variant.charAt(0).toUpperCase() + variant.slice(1);
  return Component;
};

export const Title = makeText('title', 'text');
export const RecordTitle = makeText('recordTitle', 'text');
export const BarTitle = makeText('barTitle', 'text');
export const RowTitle = makeText('rowTitle', 'text');
export const Body = makeText('body', 'text2');
export const Secondary = makeText('secondary', 'muted');
export const Label = makeText('label', 'muted');
/** Small uppercase section eyebrow; accent-colored by default. */
export const Eyebrow = makeText('eyebrow', 'accent', { textTransform: 'uppercase' });
/** Uppercase mono record-kind tag (e.g. "LOGIN"); faint by default. */
export const Kind = makeText('kind', 'faint', { textTransform: 'uppercase' });

export type MonoVariant = 'number' | 'secret' | 'value';

interface MonoProps extends TypeProps {
  variant?: MonoVariant;
  tone?: 'text' | 'amber';
}

const MONO_VARIANT: Record<MonoVariant, TypeVariant> = {
  number: 'monoNumber',
  secret: 'monoSecret',
  value: 'monoValue',
};

/** Monospace values: identifiers (`number`), secrets (`secret`), inline (`value`). */
export const Mono: React.FC<MonoProps> = ({ variant = 'value', tone = 'text', color, children, style, ...rest }) => {
  const { tokens } = useTheme();
  const toneColor = tone === 'amber' ? tokens.colors.amberText : tokens.colors.text;
  return (
    <Text style={[tokens.type[MONO_VARIANT[variant]], { color: color ?? toneColor }, style]} {...rest}>
      {children}
    </Text>
  );
};
