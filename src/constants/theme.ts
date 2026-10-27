/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1f1f1f',
    background: '#ffffff',
    backgroundElement: '#fafafa',
    backgroundSelected: '#fff8e0',
    textSecondary: '#4a4a4a',
    textMuted: '#6a6a6a',
    primary: '#F38820',
    primaryHover: '#DB7414',
    primaryPressed: '#C96A10',
    primaryText: '#ffffff',
    primaryAction: '#F38820',
    primaryDark: '#D97210',
    primarySoft: '#fff0c2',
    primarySoftHover: '#ffe295',
    primarySoftPressed: '#ffd06a',
    primaryOnSoft: '#9A3412',
    primarySoftBorder: '#C2540A',
    primarySoftBorderPressed: '#A84608',
    tint: '#F38820',
    border: '#e5e5e5',
    borderControl: '#8a8a8a',
    card: '#ffffff',
  },
  dark: {
    text: '#F8FAFC',
    background: '#0B0F17',
    backgroundElement: '#1E293B',
    backgroundSelected: '#2A1B0E',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    primary: '#F38820',
    primaryHover: '#DB7414',
    primaryPressed: '#C96A10',
    primaryText: '#ffffff',
    primaryAction: '#F38820',
    primaryDark: '#D97210',
    primarySoft: '#fff0c2',
    primarySoftHover: '#ffe295',
    primarySoftPressed: '#ffd06a',
    primaryOnSoft: '#9A3412',
    primarySoftBorder: '#C2540A',
    primarySoftBorderPressed: '#A84608',
    tint: '#F38820',
    border: '#334155',
    borderControl: '#7C8BA1',
    card: '#161F30',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
