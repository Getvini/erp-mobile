import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BrandColors } from '@/constants/colors';

export interface ProjectTabHeaderProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Feather.glyphMap;
  onAction?: () => void;
  actionDisabled?: boolean;
  extraAction?: React.ReactNode;
  className?: string;
}

export const ProjectTabHeader: React.FC<ProjectTabHeaderProps> = ({
  icon,
  title,
  subtitle,
  actionLabel,
  actionIcon = 'plus',
  onAction,
  actionDisabled = false,
  extraAction,
  className = '',
}) => {
  return (
    <View className={`flex-row items-center justify-between gap-2.5 pb-1 ${className}`}>
      <View className="flex-1 flex-row items-center gap-2.5">
        <View className="h-10 w-10 items-center justify-center rounded-xl border border-orange-100 bg-orange-50">
          <Feather name={icon} size={18} color={BrandColors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-slate-950" numberOfLines={1}>
            {title}
          </Text>
          <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        {extraAction}

        {actionLabel && onAction && (
          <TouchableOpacity
            className={`h-10 flex-row items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 active:opacity-85 ${
              actionDisabled ? 'opacity-50' : ''
            }`}
            disabled={actionDisabled}
            onPress={onAction}
            accessibilityRole="button"
          >
            {actionIcon && <Feather name={actionIcon} size={14} color="#FFFFFF" />}
            <Text className="text-xs font-bold text-white" numberOfLines={1}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default ProjectTabHeader;

