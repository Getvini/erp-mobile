import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TaskItem } from '@/services/dashboardService';
import { BrandColors } from '@/constants/colors';

interface ReviewQueueWidgetProps {
  tasks: TaskItem[];
  onTaskPress?: (task: TaskItem) => void;
  onViewAll?: () => void;
}

export const ReviewQueueWidget: React.FC<ReviewQueueWidgetProps> = ({
  tasks,
  onTaskPress,
  onViewAll,
}) => {
  if (!tasks || tasks.length === 0) {
    return null;
  }

  return (
    <View className="bg-surface rounded-[18px] p-4 border border-border mb-4">
      <View className="flex-row justify-between items-center mb-3.5">
        <View className="flex-row items-center gap-2">
          <View className="w-2 h-2 rounded-full bg-amber-500" />
          <Text className="text-[15px] font-bold text-text-primary">Hàng đợi xét duyệt ({tasks.length})</Text>
        </View>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-xs font-semibold text-primary">Xem tất cả</Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="gap-2.5">
        {tasks?.length === 0 ? (
          <Text className="text-sm text-text-secondary">Không có công việc cần xét duyệt</Text>
        ) : (
          tasks.slice(0, 4).map((task) => (
            <TouchableOpacity
              key={task.id}
              className="flex-row items-center p-3 rounded-xl bg-background border border-slate-100"
              onPress={() => onTaskPress && onTaskPress(task)}
              activeOpacity={0.7}
            >
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5 mb-1">
                  <View className="bg-amber-100 px-1.5 py-0.5 rounded-sm">
                    <Text className="text-[10px] font-bold text-amber-700">Chờ duyệt</Text>
                  </View>
                  {task.code && <Text className="text-[11px] font-semibold text-text-secondary">#{task.code}</Text>}
                </View>
                <Text className="text-xs font-semibold text-text-primary leading-5 mb-1.5" numberOfLines={2}>
                  {task.name}
                </Text>
                <View className="flex-row items-center flex-wrap gap-3">
                  {task.project?.name && (
                    <View className="flex-row items-center gap-1">
                      <Feather name="folder" size={12} color="#64748B" />
                      <Text className="text-[11px] text-text-secondary max-w-[140px]" numberOfLines={1}>
                        {task.project.name}
                      </Text>
                    </View>
                  )}
                  {task.assignee?.fullName && (
                    <View className="flex-row items-center gap-1">
                      <Feather name="user" size={12} color="#64748B" />
                      <Text className="text-[11px] text-text-secondary max-w-[140px]" numberOfLines={1}>
                        {task.assignee.fullName}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View className="ml-2">
                <Feather name="chevron-right" size={18} color="#94A3B8" />
              </View>
            </TouchableOpacity>
          )))
        }
      </View>
    </View>
  );
};
