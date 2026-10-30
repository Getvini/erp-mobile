import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ProjectBudgetSummary, ProjectServiceBudget } from '@/services/paymentRequestService';
import { formatNumber, formatVND } from '@/utils/formatters';
import { getBudgetSummaryMetrics } from '@/utils/projectBudgetSummary';
import { BrandColors } from '@/constants/colors';

type Metrics = ReturnType<typeof getBudgetSummaryMetrics>;

function BudgetAmounts({ metrics }: { metrics: Metrics }) {
  return (
    <View className="gap-2">
      {[
        { label: 'Ngân sách hợp đồng', value: metrics.budget, tone: 'text-slate-900' },
        { label: 'Giá trị đề nghị', value: metrics.spent, tone: 'text-orange-800' },
        { label: 'Ngân sách còn lại', value: metrics.remaining, tone: metrics.isOverBudget ? 'text-red-700' : 'text-emerald-700' },
      ].map(({ label, value, tone }) => (
        <View key={label} className="flex-row flex-wrap justify-between gap-x-3 gap-y-1">
          <Text className="text-xs text-slate-600">{label}</Text>
          <Text className={`text-sm font-bold ${tone}`} style={{ fontVariant: ['tabular-nums'] }}>
            {value == null ? '—' : formatVND(value, 'VNĐ')}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ProjectServiceBudgetAmounts({ budget }: { budget: ProjectServiceBudget }) {
  const metrics = getBudgetSummaryMetrics(budget.budget, budget.spent, budget.remaining);
  return (
    <View className="gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <BudgetAmounts metrics={metrics} />
      {metrics.isOverBudget && <Text className="text-xs font-bold text-red-700">Vượt ngân sách</Text>}
    </View>
  );
}

interface Props {
  summary?: ProjectBudgetSummary | null;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRetry: () => void;
}

export default function ProjectBudgetSummaryCard({ summary, isLoading, isError, isFetching, onRetry }: Props) {
  const metrics = summary ? getBudgetSummaryMetrics(
    summary.totalProjectBudget, summary.totalProjectSpent,
    summary.remainingProjectBudget, summary.disbursementPercentage,
  ) : null;

  return (
    <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <View className="flex-row items-center gap-2">
        <View className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center mr-1">
          <Feather name="credit-card" size={16} color={BrandColors.primary} />
        </View>
        <Text className="flex-1 text-[15px] font-bold text-slate-900">Tài chính & Ngân sách</Text>
      </View>
      {isLoading ? (
        <View accessibilityLabel="Đang tải ngân sách" accessibilityState={{ busy: true }} className="gap-3">
          {[0, 1, 2].map((row) => <View key={row} className="h-6 rounded-lg bg-slate-100" />)}
        </View>
      ) : (
        <>
          {isError && (
            <View className="gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <Text accessibilityRole="alert" className="text-xs text-amber-800">
                {summary ? 'Chưa thể cập nhật ngân sách. Đang hiển thị dữ liệu đã tải.' : 'Không thể tải ngân sách dự án.'}
              </Text>
              <TouchableOpacity accessibilityRole="button" disabled={isFetching} onPress={onRetry}
                className="min-h-12 items-center justify-center rounded-xl border border-amber-300 px-3">
                <Text className="text-sm font-bold text-amber-900">{isFetching ? 'Đang tải…' : 'Thử lại'}</Text>
              </TouchableOpacity>
            </View>
          )}
          {metrics ? (
            <>
              <Text className={`text-xs font-bold ${metrics.isOverBudget ? 'text-red-700' : 'text-slate-600'}`}>
                {metrics.remaining == null ? 'Chưa đủ dữ liệu ngân sách' : metrics.isOverBudget ? 'Vượt ngân sách' : metrics.hasBudget ? 'Trong định mức' : 'Chưa có ngân sách được phân bổ'}
              </Text>
              <BudgetAmounts metrics={metrics} />
              <View className="gap-2 border-t border-slate-100 pt-3">
                <Text className="text-xs font-semibold text-slate-700">
                  Tỷ lệ sử dụng ngân sách: {metrics.percentage == null ? '—' : `${formatNumber(metrics.percentage)}%`}
                </Text>
                <View accessibilityRole="progressbar" accessibilityLabel="Tỷ lệ sử dụng ngân sách"
                  accessibilityValue={{ min: 0, max: 100, now: metrics.progress }}
                  className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <View className={`h-2 rounded-full ${metrics.isOverBudget ? 'bg-red-600' : 'bg-orange-500'}`}
                    style={{ width: `${metrics.progress}%` }} />
                </View>
              </View>
              <Text className="text-xs leading-5 text-slate-500">
                Giá trị đề nghị gồm các đề nghị thanh toán, tạm ứng chưa bị từ chối hoặc hủy; tạm ứng đã quyết toán dùng số quyết toán.
              </Text>
            </>
          ) : !isError && <Text className="text-sm text-slate-500">Chưa có dữ liệu ngân sách dự án.</Text>}
        </>
      )}
    </View>
  );
}
