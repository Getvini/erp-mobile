import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatCard } from '@/components/dashboard/StatCard';
import { TodayTasksWidget } from '@/components/dashboard/TodayTasksWidget';
import { HotProjectsWidget } from '@/components/dashboard/HotProjectsWidget';
import { MemberMetrics, TaskItem } from '@/services/dashboardService';
import { BrandColors } from '@/constants/colors';

interface MemberDashboardViewProps {
  memberMetrics?: MemberMetrics;
  todayTasks: TaskItem[];
  onTaskPress?: (task: TaskItem) => void;
}

export const MemberDashboardView: React.FC<MemberDashboardViewProps> = ({
  memberMetrics,
  todayTasks,
  onTaskPress,
}) => {
  const router = useRouter();

  const participatingProjects = memberMetrics?.participatingProjects || [];

  return (
    <View className="gap-4">
      {/* Member Key Metrics */}
      <View className="flex-row flex-wrap justify-between gap-2.5">
        <StatCard
          title="Việc cần làm"
          value={memberMetrics?.doingCount ?? todayTasks.length ?? 0}
          subtitle="Đang thực hiện"
          icon="clock"
          color="#3B82F6"
          bgColor="#EFF6FF"
          onPress={() => router.push('/tasks' as any)}
        />
        <StatCard
          title="Việc hoàn thành"
          value={memberMetrics?.completedCount ?? 0}
          subtitle="Đã nghiệm thu"
          icon="check-circle"
          color="#10B981"
          bgColor="#ECFDF5"
          onPress={() => router.push('/tasks' as any)}
        />
        <StatCard
          title="Cần sửa / Vi phạm"
          value={(memberMetrics?.reworkCount ?? 0) + (memberMetrics?.violationCount ?? 0)}
          subtitle="Nhiệm vụ trả về"
          icon="alert-triangle"
          color="#EF4444"
          bgColor="#FEF2F2"
          onPress={() => router.push('/tasks' as any)}
        />
        <StatCard
          title="Thưởng Vinicoin"
          value={`${memberMetrics?.vinicoin ?? 0} VNC`}
          subtitle="Điểm tích lũy"
          icon="award"
          color={BrandColors.primary}
          bgColor="#FFF7ED"
        />
      </View>

      {/* Today Tasks List for Member */}
      <TodayTasksWidget
        tasks={todayTasks}
        onTaskPress={onTaskPress}
        onViewAll={() => router.push('/tasks' as any)}
      />

      {/* Projects Participating */}
      <HotProjectsWidget
        projects={participatingProjects}
        onProjectPress={(proj) => router.push(`/projects/${proj.id}` as any)}
        onViewAll={() => router.push('/projects' as any)}
      />
    </View>
  );
};
