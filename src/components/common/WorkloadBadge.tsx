import React from 'react';
import { View, Text } from 'react-native';
import {
  WorkloadInfo,
  getWorkloadColor,
  getWorkloadDisplayPercent,
  formatWorkloadLabel,
} from '@/utils/workload';

interface WorkloadBadgeProps {
  workload?: WorkloadInfo | null;
}

export const WorkloadBadge: React.FC<WorkloadBadgeProps> = ({ workload }) => {
  if (!workload && workload !== (0 as any)) return null;

  const displayPercent = getWorkloadDisplayPercent(workload);
  const bgColor = getWorkloadColor(displayPercent);
  const label = formatWorkloadLabel(workload);

  return (
    <View
      className="shrink-0 rounded-full px-2 py-0.5 items-center justify-center shadow-xs"
      style={{ backgroundColor: bgColor }}
    >
      <Text className="text-[10px] font-extrabold text-white">{label}</Text>
    </View>
  );
};
