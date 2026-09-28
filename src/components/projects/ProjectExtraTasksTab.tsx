import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { TaskDetail, TASK_STATUS_CONFIG } from '@/services/taskService';
import { BrandColors } from '@/constants/colors';
import { formatVND } from '@/utils/formatters';

/**
 * Tab "Công việc phát sinh" (P1.11) — mirror `ExtraTasksSection.jsx` của Web.
 * Nhóm theo trạng thái định giá: Chờ định giá / Có phí (BILLABLE) / Hỗ trợ (NON_BILLABLE).
 */
type PricingFilter = 'ALL' | 'PENDING' | 'BILLABLE' | 'NON_BILLABLE';

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
  projectId,
}: ProjectExtraTasksTabProps) {
  const router = useRouter();
  const [pricingFilter, setPricingFilter] = useState<PricingFilter>('ALL');

  const extraTasks = useMemo(() => {
    return tasks
      .filter((t) => Boolean(t.isExtraTask || (t as any).isExtra))
      .sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }));
  }, [tasks]);

  const summary = useMemo(
    () => ({
      total: extraTasks.length,
      PENDING: extraTasks.filter((t) => getPricingStatus(t) === 'PENDING').length,
      BILLABLE: extraTasks.filter((t) => getPricingStatus(t) === 'BILLABLE').length,
      NON_BILLABLE: extraTasks.filter((t) => getPricingStatus(t) === 'NON_BILLABLE').length,
    }),
    [extraTasks]
  );

  const displayedTasks = useMemo(
    () =>
      pricingFilter === 'ALL'
        ? extraTasks
        : extraTasks.filter((t) => getPricingStatus(t) === pricingFilter),
    [extraTasks, pricingFilter]
  );

  const pills: Array<{ key: PricingFilter; label: string; count: number; color: string }> = [
    { key: 'ALL', label: 'Tổng', count: summary.total, color: '#334155' },
    { key: 'PENDING', label: 'Chờ định giá', count: summary.PENDING, color: '#C2410C' },
    { key: 'BILLABLE', label: 'Có phí', count: summary.BILLABLE, color: '#1D4ED8' },
    { key: 'NON_BILLABLE', label: 'Hỗ trợ', count: summary.NON_BILLABLE, color: '#B45309' },
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
    <View className="gap-3 p-4">
      <View className="flex-row items-center gap-2.5">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-orange-50">
          <Feather name="alert-circle" size={20} color={BrandColors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-slate-950">Công việc phát sinh</Text>
          <Text className="text-xs text-slate-500">
            Danh sách công việc ngoài phạm vi ban đầu của dự án.
          </Text>
        </View>
      </View>

      {/* Filter pills */}
      <View className="flex-row flex-wrap gap-2">
        {pills.map((pill) => {
          const isActive = pricingFilter === pill.key;
          return (
            <TouchableOpacity
              key={pill.key}
              className={`min-h-[48px] flex-row items-center gap-2 rounded-xl border px-3 ${
                isActive ? 'border-primary bg-orange-50' : 'border-slate-200 bg-white'
              }`}
              onPress={() => setPricingFilter(pill.key)}
              activeOpacity={0.8}
            >
              <Text
                className={`text-xs ${isActive ? 'font-bold text-primary' : 'font-semibold text-slate-500'}`}
              >
                {pill.label}
              </Text>
              <View
                className={`rounded-full px-2 py-0.5 ${isActive ? 'bg-orange-100' : 'bg-slate-100'}`}
              >
                <Text
                  className={`text-[10px] font-bold ${isActive ? 'text-primary' : 'text-slate-500'}`}
                >
                  {pill.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {extraTasks.length === 0 ? (
        <View className="items-center justify-center gap-2 py-10">
          <Feather name="file-text" size={40} color="#CBD5E1" />
          <Text className="text-[15px] font-bold text-slate-600">Chưa có công việc phát sinh</Text>
          <Text className="max-w-[260px] text-center text-[13px] text-slate-400">
            Dự án chưa có công việc phát sinh nào ngoài phạm vi hợp đồng.
          </Text>
        </View>
      ) : displayedTasks.length === 0 ? (
        <View className="items-center justify-center gap-2 py-10">
          <Feather name="filter" size={36} color="#CBD5E1" />
          <Text className="text-[13px] text-slate-400">
            Không có công việc phát sinh ở nhóm này.
          </Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {displayedTasks.map((task) => {
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

                <Text className="text-[13px] font-bold text-slate-950">{task.name}</Text>
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
                  className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50"
                  onPress={() => router.push(`/tasks/${task.id}` as any)}
                  activeOpacity={0.8}
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
