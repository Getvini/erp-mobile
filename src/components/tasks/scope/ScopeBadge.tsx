import React from 'react';
import { Text, View } from 'react-native';

export type ScopeBadgeTone = 'blue' | 'amber' | 'violet' | 'slate';

const TONE_BG: Record<ScopeBadgeTone, string> = {
  blue: '#2563eb',
  amber: '#d97706',
  violet: '#7c3aed',
  slate: '#64748b',
};

interface ScopeBadgeProps {
  children: string;
  tone?: ScopeBadgeTone;
}

export default function ScopeBadge({ children, tone = 'blue' }: ScopeBadgeProps) {
  return (
    <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: TONE_BG[tone] }}>
      <Text className="text-[10px] font-bold text-white">{children}</Text>
    </View>
  );
}
