import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { colors } from '../theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// One icon family, drawn in the app's own colours, instead of system emoji.
export function Icon({ name, size = 20, color = colors.primary }: { name: IconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

// Face icons for voice tone and for how an elderly person says they feel.
export const TONE_ICON: Record<string, IconName> = {
  happy: 'emoticon-excited-outline',
  calm: 'emoticon-happy-outline',
  neutral: 'emoticon-neutral-outline',
  stressed: 'emoticon-confused-outline',
  angry: 'emoticon-angry-outline',
};

export const MOOD_ICON: Record<string, IconName> = {
  good: 'emoticon-happy-outline',
  okay: 'emoticon-neutral-outline',
  unwell: 'emoticon-sad-outline',
};
