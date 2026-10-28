import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors } from '@/constants/colors';

export type ButtonVariant = 'primary' | 'soft' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps {
  title?: string;
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  enableHaptics?: boolean;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

/**
 * Standard AppButton component aligned with Getvini ERP Mobile Design System
 * - Supports variants: primary (solid brand orange #F38820 + white text #ffffff)
 *                     soft (pastel orange #fff0c2 + dark amber text #9A3412 + #C2540A border)
 *                     secondary | danger | ghost
 * - Mobile standard thumb-zone minimum height: 48px
 * - Standard border radius: 10px (rounded-md)
 * - Built-in Haptics feedback with opt-out
 */
export const AppButton: React.FC<AppButtonProps> = ({
  title,
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  enableHaptics = true,
  leadingIcon,
  trailingIcon,
  onPress,
  style,
  textStyle,
  accessibilityLabel,
}) => {
  const isBusy = Boolean(loading);
  const isDisabled = Boolean(disabled || isBusy);

  const handlePress = () => {
    if (isDisabled) return;
    if (enableHaptics) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Safe fallback in environments without native haptics
      }
    }
    onPress?.();
  };

  const getContainerStyle = (): ViewStyle => {
    const base: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10, // Mobile rounded.md
      minHeight: size === 'sm' ? 38 : size === 'lg' ? 52 : 48,
      paddingHorizontal: size === 'sm' ? 14 : size === 'lg' ? 24 : 18,
      alignSelf: fullWidth ? 'stretch' : 'auto',
    };

    if (isDisabled) {
      return {
        ...base,
        backgroundColor: BrandColors.disabledBg,
        borderWidth: 1,
        borderColor: BrandColors.disabledBg,
        opacity: 0.7,
      };
    }

    switch (variant) {
      case 'primary':
        return {
          ...base,
          backgroundColor: BrandColors.primary, // #F38820
          shadowColor: BrandColors.primary,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.2,
          shadowRadius: 2,
          elevation: 1,
        };
      case 'soft':
        return {
          ...base,
          backgroundColor: BrandColors.primarySoft, // Cam nhạt #fff0c2
          borderWidth: 1,
          borderColor: BrandColors.primarySoftBorder, // Viền #C2540A
          shadowColor: BrandColors.primarySoftBorder,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 1,
        };
      case 'secondary':
        return {
          ...base,
          backgroundColor: BrandColors.surface,
          borderWidth: 1,
          borderColor: BrandColors.borderControl,
        };
      case 'danger':
        return {
          ...base,
          backgroundColor: BrandColors.dangerStrong,
        };
      case 'ghost':
        return {
          ...base,
          backgroundColor: 'transparent',
        };
      default:
        return base;
    }
  };

  const getTextColor = (): string => {
    if (isDisabled) return BrandColors.disabledText;
    switch (variant) {
      case 'primary':
        return BrandColors.onPrimary; // #ffffff
      case 'soft':
        return BrandColors.primaryOnSoft; // #9A3412
      case 'secondary':
        return BrandColors.textPrimary; // #1f1f1f
      case 'danger':
        return BrandColors.onPrimary; // #ffffff
      case 'ghost':
        return BrandColors.primaryAction; // #F38820
      default:
        return BrandColors.onPrimary;
    }
  };

  const textColor = getTextColor();
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 15;
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 20 : 18;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handlePress}
      disabled={isDisabled}
      accessible={true}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: isBusy }}
      accessibilityLabel={accessibilityLabel || (typeof title === 'string' ? title : undefined)}
      style={[getContainerStyle(), style]}
    >
      {isBusy ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {leadingIcon && (
            <Ionicons
              name={leadingIcon}
              size={iconSize}
              color={textColor}
              style={{ marginRight: 8 }}
            />
          )}

          {title ? (
            <Text
              style={[
                styles.text,
                { color: textColor, fontSize },
                textStyle,
              ]}
            >
              {title}
            </Text>
          ) : (
            children
          )}

          {trailingIcon && (
            <Ionicons
              name={trailingIcon}
              size={iconSize}
              color={textColor}
              style={{ marginLeft: 8 }}
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
