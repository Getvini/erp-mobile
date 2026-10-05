import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface GridNavButtonProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export default function GridNavButton({ icon, label, onPress, disabled }: GridNavButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      className={`w-10 h-10 items-center justify-center rounded-lg border border-border bg-surface ${disabled ? 'opacity-40' : ''}`}
    >
      <Feather name={icon} size={18} color="#475569" />
    </TouchableOpacity>
  );
}
