import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MonthlyReconciliation } from '@/services/paymentDashboardService';
import { formatDateToDDMMYYYY, formatNumber, formatVND } from '@/utils/formatters';
import { getCashflowStatusBadge } from '@/utils/cashflowHelper';

interface MonthCashflowDetailModalProps {
  visible: boolean;
  onClose: () => void;
  monthData: MonthlyReconciliation | null;
  year: number;
}

export function MonthCashflowDetailModal({
  visible,
  onClose,
  monthData,
  year,
}: MonthCashflowDetailModalProps) {
  const insets = useSafeAreaInsets();

  if (!monthData) return null;

  const planned = Number(monthData.planned || 0);
  const paid = Number(monthData.paid || monthData.cashPaid || 0);
  const unpaid = Number(monthData.unpaid || Math.max(0, planned - paid));
  const rate = planned > 0 ? Math.min(100, (paid / planned) * 100) : paid > 0 ? 100 : 0;

  const breakdown = monthData.breakdown || {};
  const onTime = Number(breakdown.onTime || 0);
  const overdue = Number(breakdown.overdue || 0);
  const prepaid = Number(breakdown.prepaid || 0);
  const details = breakdown.details || [];

  const statusBadge = getCashflowStatusBadge({
    planned,
    paid,
    unpaid,
    overdue,
    prepaid,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <View
          className="max-h-[88%] rounded-t-[32px] bg-white px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 20) }}
        >
          {/* Handle bar */}
          <View className="mb-3 h-1.5 w-12 self-center rounded-full bg-slate-300" />

          {/* Header */}
          <View className="flex-row items-start justify-between border-b border-slate-100 pb-4">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-orange-100">
                <Feather name="calendar" size={22} color="#F38820" />
              </View>
              <View>
                <Text className="text-lg font-extrabold text-slate-900">
                  Dòng tiền thực thu
                </Text>
                <Text className="text-xs font-semibold text-slate-500">
                  Tháng {monthData.month} / Niên độ {year}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"
            >
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="mt-4">
            {/* KPI Banner */}
            <View className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Trạng thái tháng
                  </Text>
                  <View
                    className={`rounded-lg border px-2.5 py-1 ${statusBadge.bg} ${statusBadge.border}`}
                  >
                    <Text className={`text-[11px] font-extrabold ${statusBadge.text}`}>
                      {statusBadge.label}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm font-extrabold text-primary">
                  {formatNumber(rate.toFixed(1))}% thực thu
                </Text>
              </View>

              {/* Progress bar */}
              <View className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <View
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${rate}%` }}
                />
              </View>

              {/* 3 Metrics */}
              <View className="mt-4 flex-row justify-between border-t border-slate-200/60 pt-3">
                <View>
                  <Text className="text-[11px] text-slate-500">Kế hoạch</Text>
                  <Text className="mt-0.5 text-sm font-extrabold text-slate-800">
                    {formatVND(planned)}
                  </Text>
                </View>
                <View>
                  <Text className="text-[11px] text-slate-500">Đã thực thu</Text>
                  <Text className="mt-0.5 text-sm font-extrabold text-emerald-700">
                    {formatVND(paid)}
                  </Text>
                </View>
                <View>
                  <Text className="text-[11px] text-slate-500">Còn lại</Text>
                  <Text className="mt-0.5 text-sm font-extrabold text-orange-600">
                    {formatVND(unpaid)}
                  </Text>
                </View>
              </View>
            </View>

            {/* 3 Cards: Phân bổ nguồn tiền */}
            <Text className="mt-5 mb-2.5 text-xs font-black uppercase tracking-wider text-slate-500">
              Phân bổ nguồn tiền thực thu
            </Text>
            <View className="gap-2.5">
              {/* Đúng kỳ */}
              <View className="flex-row items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5">
                <View className="flex-row items-center gap-3">
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                    <Feather name="check-circle" size={17} color="#059669" />
                  </View>
                  <View>
                    <Text className="text-xs font-extrabold text-emerald-900">
                      Thu đúng kỳ hạn
                    </Text>
                    <Text className="text-[10px] text-emerald-700">
                      Đợt thanh toán có hạn trong tháng {monthData.month}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm font-extrabold text-emerald-700">
                  {formatVND(onTime)}
                </Text>
              </View>

              {/* Nợ cũ */}
              <View className="flex-row items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 p-3.5">
                <View className="flex-row items-center gap-3">
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                    <Feather name="clock" size={17} color="#D97706" />
                  </View>
                  <View>
                    <Text className="text-xs font-extrabold text-amber-900">
                      Thu hồi nợ cũ
                    </Text>
                    <Text className="text-[10px] text-amber-700">
                      Đợt thanh toán quá hạn từ các tháng trước
                    </Text>
                  </View>
                </View>
                <Text className="text-sm font-extrabold text-amber-700">
                  {formatVND(overdue)}
                </Text>
              </View>

              {/* Thu trước */}
              <View className="flex-row items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 p-3.5">
                <View className="flex-row items-center gap-3">
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                    <Feather name="arrow-up-right" size={17} color="#2563EB" />
                  </View>
                  <View>
                    <Text className="text-xs font-extrabold text-blue-900">
                      Thu trước kỳ hạn
                    </Text>
                    <Text className="text-[10px] text-blue-700">
                      Khách hàng thanh toán trước hạn các đợt sau
                    </Text>
                  </View>
                </View>
                <Text className="text-sm font-extrabold text-blue-700">
                  {formatVND(prepaid)}
                </Text>
              </View>
            </View>

            {/* Chi tiết từng khoản thanh toán */}
            <View className="mt-5 mb-2 flex-row items-center justify-between">
              <Text className="text-xs font-black uppercase tracking-wider text-slate-500">
                Đối soát các khoản thực thu ({details.length})
              </Text>
            </View>

            {details.length === 0 ? (
              <View className="my-3 items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
                <Feather name="inbox" size={32} color="#94A3B8" />
                <Text className="mt-2 text-xs font-bold text-slate-500">
                  Không có khoản tiền nào phát sinh trong tháng này
                </Text>
              </View>
            ) : (
              <View className="mb-4 gap-2.5">
                {details.map((item: any, idx: number) => {
                  const isOverdue = item.type === 'OVERDUE';
                  const isPrepaid = item.type === 'PREPAID';
                  const typeLabel = isOverdue
                    ? 'Nợ cũ'
                    : isPrepaid
                    ? 'Thu trước'
                    : 'Đúng kỳ';
                  const typeBadgeClass = isOverdue
                    ? 'bg-amber-100 text-amber-800'
                    : isPrepaid
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-emerald-100 text-emerald-800';

                  return (
                    <View
                      key={item.id || `payment-${idx}`}
                      className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-xs font-extrabold text-orange-600">
                            {item.contractCode || 'HĐ #—'}
                          </Text>
                          <Text
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${typeBadgeClass}`}
                          >
                            {typeLabel}
                          </Text>
                        </View>
                        <Text className="text-sm font-black text-emerald-700">
                          +{formatVND(item.amount)}
                        </Text>
                      </View>

                      <Text
                        numberOfLines={1}
                        className="mt-1 text-xs font-bold text-slate-800"
                      >
                        {item.projectName || 'Dự án'}
                      </Text>

                      <View className="mt-2 flex-row items-center justify-between border-t border-slate-100 pt-2 text-slate-400">
                        <Text className="text-[11px] text-slate-500">
                          {item.customerName || 'Khách hàng'}
                        </Text>
                        <Text className="text-[10px] font-semibold text-slate-500">
                          Ngày thu: {formatDateToDDMMYYYY(item.paymentDate)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Action button */}
          <TouchableOpacity
            onPress={onClose}
            className="mt-2 h-12 items-center justify-center rounded-xl bg-slate-900"
          >
            <Text className="font-extrabold text-white">Đóng</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
export default MonthCashflowDetailModal;
