import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BrandColors } from '@/constants/colors';

export interface EmptyStateProps {
  icon?: keyof typeof Feather.glyphMap;
  iconSize?: number;
  iconColor?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Feather.glyphMap;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  iconSize = 40,
  iconColor = '#CBD5E1',
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  className = '',
}) => {
  return (
    <View className={`items-center justify-center py-12 px-4 gap-2.5 ${className}`}>
      <View className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 items-center justify-center mb-1">
        <Feather name={icon} size={iconSize} color={iconColor} />
      </View>
      <Text className="text-sm font-bold text-slate-700 text-center">{title}</Text>
      {description ? (
        <Text className="text-xs text-slate-400 text-center max-w-[280px] leading-4">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          className="mt-2 flex-row items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 active:opacity-85"
          onPress={onAction}
        >
          {actionIcon ? <Feather name={actionIcon} size={14} color="#FFFFFF" /> : null}
          <Text className="text-xs font-bold text-white">{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default EmptyState;

