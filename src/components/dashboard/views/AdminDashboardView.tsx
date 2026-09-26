import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatCard } from '../StatCard';
import { ReviewQueueWidget } from '../ReviewQueueWidget';
import { HotProjectsWidget } from '../HotProjectsWidget';
import { AdminMetrics, TaskItem } from '@/services/dashboardService';
import { BrandColors } from '@/constants/colors';
import { formatVND } from '@/utils/formatters';

interface AdminDashboardViewProps {
  adminMetrics?: AdminMetrics;
  reviewTasks: TaskItem[];
  teamLeadProjects?: any[];
  onTaskPress?: (task: TaskItem) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  adminMetrics,
  reviewTasks,
  teamLeadProjects = [],
  onTaskPress,
}) => {
  const router = useRouter();

  const formatMoney = (val?: number) => {
    if (!val) return '0 ₫';
    if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)} Tỷ`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)} Tr`;
    return formatVND(val);
  };

  const activeProjects =
    adminMetrics?.currentProjects && adminMetrics.currentProjects.length > 0
      ? adminMetrics.currentProjects
      : teamLeadProjects;

  const activeProjectsCount =
    adminMetrics?.currentProjects?.length ?? adminMetrics?.activeProjects ?? teamLeadProjects.length ?? 0;

  return (
    <View className="gap-4">
      {/* 4 Core Admin Executive Metrics */}
      <View className="flex-row flex-wrap justify-between gap-2.5">
        <StatCard
          title="Doanh thu ký"
          value={formatMoney(adminMetrics?.totalRevenue)}
          subtitle="Hợp đồng kỳ này"
          icon="dollar-sign"
          color={BrandColors.primary}
          bgColor="#FFF7ED"
          onPress={() => router.push('/finance' as any)}
        />
        <StatCard
          title="Dự án đang chạy"
          value={activeProjectsCount}
          subtitle="Tiến độ hoạt động"
          icon="folder"
          color="#3B82F6"
          bgColor="#EFF6FF"
          onPress={() => router.push('/projects' as any)}
        />
        <StatCard
          title="Khách hàng mới"
          value={adminMetrics?.newCustomers ?? 0}
          subtitle="Kỳ báo cáo"
          icon="users"
          color="#10B981"
          bgColor="#ECFDF5"
          onPress={() => router.push('/customers' as any)}
        />
        <StatCard
          title="Công nợ cần thu"
          value={formatMoney(adminMetrics?.totalDebt)}
          subtitle="Chờ thanh toán"
          icon="alert-circle"
          color="#F59E0B"
          bgColor="#FFFBEB"
          onPress={() => router.push('/finance' as any)}
        />
      </View>

      {/* Review Queue (Items needing approval) */}
      <ReviewQueueWidget
        tasks={reviewTasks}
        onTaskPress={onTaskPress}
        onViewAll={() => router.push('/tasks' as any)}
      />

      {/* Hot Projects Progress List */}
      <HotProjectsWidget
        projects={activeProjects}
        onProjectPress={(proj) => router.push(`/projects/${proj.id}` as any)}
        onViewAll={() => router.push('/projects' as any)}
      />
    </View>
  );
};
