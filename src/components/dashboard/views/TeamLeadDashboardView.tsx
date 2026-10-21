import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatCard } from '@/components/dashboard/StatCard';
import { ReviewQueueWidget } from '@/components/dashboard/ReviewQueueWidget';
import { HotProjectsWidget } from '@/components/dashboard/HotProjectsWidget';
import { TaskItem, TeamLeadProject } from '@/services/dashboardService';
import { BrandColors } from '@/constants/colors';

interface TeamLeadDashboardViewProps {
  teamLeadProjects: TeamLeadProject[];
  reviewTasks: TaskItem[];
  todayTasks: TaskItem[];
  onTaskPress?: (task: TaskItem) => void;
}

export const TeamLeadDashboardView: React.FC<TeamLeadDashboardViewProps> = ({
  teamLeadProjects,
  reviewTasks,
  todayTasks,
  onTaskPress,
}) => {
  const router = useRouter();

  return (
    <View className="gap-4">
      {/* 3 Team Lead Metrics */}
      <View className="flex-row flex-wrap justify-between gap-2.5">
        <StatCard
          title="Dự án team"
          value={teamLeadProjects.length}
          subtitle="Đang quản lý"
          icon="folder"
          color="#3B82F6"
          bgColor="#EFF6FF"
          onPress={() => router.push('/projects' as any)}
        />
        <StatCard
          title="Cần phê duyệt"
          value={reviewTasks.length}
          subtitle="Nhiệm vụ chờ duyệt"
          icon="check-square"
          color={BrandColors.primary}
          bgColor="#FFF7ED"
          onPress={() => router.push('/tasks' as any)}
        />
        <StatCard
          title="Việc phân công"
          value={todayTasks.length}
          subtitle="Tiến độ nhiệm vụ"
          icon="calendar"
          color="#10B981"
          bgColor="#ECFDF5"
          onPress={() => router.push('/tasks' as any)}
        />
      </View>

      {/* Review Queue (Awaiting review by Team Lead) */}
      <ReviewQueueWidget
        tasks={reviewTasks}
        onTaskPress={onTaskPress}
        onViewAll={() => router.push('/tasks' as any)}
      />

      {/* Team Lead Managed Projects */}
      <HotProjectsWidget
        projects={teamLeadProjects}
        onProjectPress={(proj) => router.push(`/projects/${proj.id}` as any)}
        onViewAll={() => router.push('/projects' as any)}
      />
    </View>
  );
};
