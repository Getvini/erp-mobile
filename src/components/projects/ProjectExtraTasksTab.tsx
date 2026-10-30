import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { TaskDetail, TASK_STATUS_CONFIG } from '@/services/taskService';
import { BrandColors } from '@/constants/colors';
import { formatVND } from '@/utils/formatters';
import { getTaskDisplayName } from '@/utils/taskPolicy';
import { EmptyState } from '@/components/common/EmptyState';
import { ProjectTabHeader } from '@/components/projects/ProjectTabHeader';

/**
 * Tab "Công việc phát sinh" (P1.11) — mirror `ExtraTasksSection.jsx` của Web.
 * 4 thẻ thống kê: Tổng, Chờ giá, Có phí, Hỗ trợ (chỉ hiển thị số liệu thuần túy giống Web).
 */
const PRICING_LABELS: Record<string, string> = {
  PENDING: 'Chờ định giá',
  BILLABLE: 'Có phí',
  NON_BILLABLE: 'Hỗ trợ',
};

const PRICING_BADGE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#FFF7ED', color: '#C2410C' },
  BILLABLE: { bg: '#EFF6FF', color: '#1D4ED8' },
  NON_BILLABLE: { bg: '#FFFBEB', color: '#B45309' },
};

/** Suy ra trạng thái định giá — giống `getPricingStatus` của Web. */
const getPricingStatus = (task: TaskDetail): string => {
  const explicit = (task as any).pricingStatus;
  if (explicit) return explicit;
  if (task.status === 'AWAITING_PRICING') return 'PENDING';
  return 'NON_BILLABLE';
};

interface ProjectExtraTasksTabProps {
  tasks: TaskDetail[];
  isLoading?: boolean;
  projectId?: string;
}

export default function ProjectExtraTasksTab({
  tasks,
  isLoading = false,
}: ProjectExtraTasksTabProps) {
  const router = useRouter();

  const extraTasks = useMemo(() => {
    return tasks
      .filter((t) => Boolean(t.isExtraTask || (t as any).isExtra))
      .sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }));
  }, [tasks]);

  const summary = useMemo(
    () => ({
      total: extraTasks.length,
      pending: extraTasks.filter((t) => getPricingStatus(t) === 'PENDING').length,
      billable: extraTasks.filter((t) => getPricingStatus(t) === 'BILLABLE').length,
      support: extraTasks.filter((t) => getPricingStatus(t) === 'NON_BILLABLE').length,
    }),
    [extraTasks]
  );

  const summaryCards = [
    { label: 'Tổng', count: summary.total, color: '#334155' },
    { label: 'Chờ giá', count: summary.pending, color: '#C2410C' },
    { label: 'Có phí', count: summary.billable, color: '#1D4ED8' },
    { label: 'Hỗ trợ', count: summary.support, color: '#B45309' },
  ];

  const getStatusBadge = (status?: string) => {
    const config = TASK_STATUS_CONFIG[status || 'PENDING'];
    return {
      bg: config?.bg || '#F1F5F9',
      color: config?.color || '#64748B',
      label: config?.text || status || '—',
    };
  };

  if (isLoading) {
    return (
      <View className="items-center gap-3 py-10">
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text className="text-[13px] text-slate-500">Đang tải công việc phát sinh...</Text>
      </View>
    );
  }

  return (
    <View className="gap-3.5 p-4">
      {/* Header chuẩn hóa */}
      <ProjectTabHeader
        icon="alert-circle"
        title="Công việc phát sinh"
        subtitle={`Tổng cộng ${extraTasks.length} công việc ngoài hợp đồng`}
      />

      {/* Thẻ thống kê số liệu chuẩn Web (SummaryPill: hiển thị thuần túy, không phải nút bấm) */}
      <View className="flex-row items-center gap-2">
        {summaryCards.map((card) => (
          <View
            key={card.label}
            className="flex-1 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2"
          >
            <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {card.label}
            </Text>
            <Text className="mt-0.5 text-lg font-extrabold" style={{ color: card.color }}>
              {card.count}
            </Text>
          </View>
        ))}
      </View>

      {/* Danh sách công việc hoặc Empty State */}
      {extraTasks.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="Chưa có công việc phát sinh"
          description="Dự án chưa có công việc phát sinh nào ngoài phạm vi hợp đồng."
        />
      ) : (
        <View className="gap-2.5">
          {extraTasks.map((task) => {
            const pricingStatus = getPricingStatus(task);
            const pricingBadge = PRICING_BADGE[pricingStatus] || PRICING_BADGE.PENDING;
            const statusInfo = getStatusBadge(task.status);
            const cost = (task as any).cost ?? (task as any).job?.costPrice ?? 0;

            return (
              <View key={task.id} className="gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 flex-row items-center gap-1.5">
                    {task.code ? (
                      <View className="rounded bg-blue-50 px-1.5 py-0.5">
                        <Text className="text-[11px] font-bold text-primary">{task.code}</Text>
                      </View>
                    ) : null}
                    <View className="rounded-md px-2 py-[3px]" style={{ backgroundColor: statusInfo.bg }}>
                      <Text className="text-[10px] font-bold" style={{ color: statusInfo.color }}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>

                  <View className="rounded-md px-2 py-[3px]" style={{ backgroundColor: pricingBadge.bg }}>
                    <Text className="text-[10px] font-bold" style={{ color: pricingBadge.color }}>
                      {PRICING_LABELS[pricingStatus] || pricingStatus}
                    </Text>
                  </View>
                </View>

                <Text className="text-[13px] font-bold text-slate-950">{getTaskDisplayName(task)}</Text>
                {(task as any).job?.name ? (
                  <Text className="text-[11px] text-slate-500" numberOfLines={1}>
                    {(task as any).job.name}
                  </Text>
                ) : null}

                <View className="flex-row items-center gap-4">
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[10px] text-slate-400">Giá bán</Text>
                    <Text className="text-[12px] font-bold text-slate-800">
                      {formatVND((task as any).sellingPrice || 0)}
                    </Text>
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[10px] text-slate-400">Giá vốn</Text>
                    <Text className="text-[12px] font-semibold text-slate-600">{formatVND(cost)}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  className="h-10 flex-row items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 active:opacity-80"
                  onPress={() => router.push(`/tasks/${task.id}` as any)}
                >
                  <Feather name="external-link" size={14} color="#475569" />
                  <Text className="text-xs font-bold text-slate-600">Xem công việc</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
