import React, { memo, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  ReferralPartnerContract,
  ReferralPartnerStatistics,
} from '@/services/referralPartnerService';
import {
  getCommissionRateLabel,
  PARTNER_COMMISSION_STATUS_LABELS,
  sumPartnerCommission,
} from '@/utils/partnerCommission';
import { formatDateToDDMMYYYY, formatVND } from '@/utils/formatters';

interface PartnerCommissionTabProps {
  contracts: ReferralPartnerContract[];
  statistics?: ReferralPartnerStatistics | null;
  isLoading?: boolean;
  onPressContract?: (id: string) => void;
}

const STATUS_STYLES: Record<string, { text: string; bg: string; color: string }> = {
  PAID: { text: 'Đã thanh toán', bg: '#ECFDF5', color: '#047857' },
  PENDING: { text: 'Chưa thanh toán', bg: '#FFFBEB', color: '#B45309' },
  CANCELLED: { text: 'Hủy bỏ', bg: '#FEF2F2', color: '#B91C1C' },
};

const money = (value?: number | string | null) => formatVND(value ?? 0, 'VNĐ');

function SummaryCard({
  label,
  value,
  icon,
  bg,
  color,
}: {
  label: string;
  value: number | string | null | undefined;
  icon: React.ComponentProps<typeof Feather>['name'];
  bg: string;
  color: string;
}) {
  return (
    <View className="flex-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <View
        className="mb-2 h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: bg }}
      >
        <Feather name={icon} size={15} color={color} />
      </View>
      <Text className="text-[10px] font-semibold uppercase text-slate-400" numberOfLines={2}>
        {label}
      </Text>
      <Text className="mt-1 text-[13px] font-extrabold text-slate-900" numberOfLines={1}>
        {money(value)}
      </Text>
    </View>
  );
}

function PartnerCommissionTab({
  contracts,
  statistics,
  isLoading,
  onPressContract,
}: PartnerCommissionTabProps) {
  const contractList = useMemo(
    () => (Array.isArray(contracts) ? contracts.filter(Boolean) : []),
    [contracts],
  );

  // Tính toán thuần theo công thức backend (ReferralPartner.Service.ts:83-96)
  const summary = useMemo(() => sumPartnerCommission(contractList), [contractList]);

  const hasStatistics = Boolean(statistics);
  const totalCommission = hasStatistics ? statistics?.totalCommission : summary.total;
  const paidCommission = hasStatistics ? statistics?.paidCommission : summary.paid;
  const pendingCommission = hasStatistics ? statistics?.pendingCommission : summary.pending;

  if (isLoading) {
    return (
      <View className="gap-3">
        <View className="h-24 rounded-2xl bg-slate-200" />
        <View className="h-40 rounded-2xl bg-slate-200" />
      </View>
    );
  }

  const hasCommissionData =
    contractList.length > 0 ||
    Number(totalCommission || 0) !== 0 ||
    Number(paidCommission || 0) !== 0 ||
    Number(pendingCommission || 0) !== 0;

  if (!hasCommissionData) {
    return (
      <View className="items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12">
        <Feather name="dollar-sign" size={38} color="#CBD5E1" />
        <Text className="mt-3 text-sm font-bold text-slate-600">Chưa có dữ liệu hoa hồng</Text>
        <Text className="mt-1 text-center text-xs text-slate-400">
          Hoa hồng sẽ được ghi nhận khi đối tác này có hợp đồng được thiết lập tỷ lệ hoa hồng.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      {/* Tổng hợp hoa hồng từ API statistics */}
      <View className="flex-row gap-2.5">
        <SummaryCard
          label="Tổng hoa hồng"
          value={totalCommission}
          icon="pie-chart"
          bg="#FFF4EA"
          color="#F38820"
        />
        <SummaryCard
          label="Đã thanh toán"
          value={paidCommission}
          icon="check-circle"
          bg="#ECFDF5"
          color="#10B981"
        />
        <SummaryCard
          label="Chưa thanh toán"
          value={pendingCommission}
          icon="clock"
          bg="#FFFBEB"
          color="#F59E0B"
        />
      </View>

      {/* Bảng hoa hồng theo từng hợp đồng */}
      <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <View className="flex-row items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <Feather name="percent" size={14} color="#F38820" />
          <Text className="text-xs font-bold uppercase text-slate-500">
            Hoa hồng theo hợp đồng ({contractList.length})
          </Text>
        </View>

        {contractList.length === 0 ? (
          <View className="items-center px-6 py-8">
            <Text className="text-xs text-slate-400">
              Chưa có hợp đồng nào ghi nhận hoa hồng cho đối tác này.
            </Text>
          </View>
        ) : (
          contractList.map((contract, index) => {
            const status = contract.partnerCommissionStatus || 'PENDING';
            const statusStyle = STATUS_STYLES[status] || {
              text: PARTNER_COMMISSION_STATUS_LABELS[status] || status,
              bg: '#F1F5F9',
              color: '#475569',
            };

            return (
              <TouchableOpacity
                key={contract.id || `commission-${index}`}
                testID={`partnerCommissionRow-${contract.id}`}
                className={`px-4 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}
                onPress={() => contract.id && onPressContract?.(contract.id)}
                disabled={!onPressContract}
                activeOpacity={0.75}
                accessibilityRole={onPressContract ? 'button' : 'text'}
                accessibilityLabel={`Hợp đồng ${contract.contractCode || contract.id}`}
              >
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-[13px] font-bold text-slate-900" numberOfLines={1}>
                      {contract.contractCode || `#${contract.id}`}
                    </Text>
                    <Text className="mt-0.5 text-[11px] font-semibold text-slate-400">
                      Tỷ lệ: {getCommissionRateLabel(contract.partnerCommissionRate)}
                      {contract.signedDate
                        ? ` • Ký: ${formatDateToDDMMYYYY(contract.signedDate)}`
                        : ''}
                    </Text>
                  </View>

                  <View className="items-end">
                    <Text className="text-[13px] font-extrabold text-orange-600">
                      {money(contract.partnerCommission)}
                    </Text>
                    <View
                      className="mt-1 rounded-lg px-2 py-0.5"
                      style={{ backgroundColor: statusStyle.bg }}
                    >
                      <Text className="text-[10px] font-bold" style={{ color: statusStyle.color }}>
                        {statusStyle.text}
                      </Text>
                    </View>
                  </View>
                </View>

                {contract.partnerCommissionPaidAt ? (
                  <View className="mt-2 flex-row items-center gap-1.5">
                    <Feather name="calendar" size={11} color="#10B981" />
                    <Text className="text-[11px] font-semibold text-emerald-600">
                      Đã trả ngày {formatDateToDDMMYYYY(contract.partnerCommissionPaidAt)}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}

        {/* Tổng cộng theo danh sách hợp đồng (hàm thuần sumPartnerCommission) */}
        {contractList.length > 0 ? (
          <View className="border-t border-slate-200 bg-slate-50 px-4 py-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] font-bold uppercase text-slate-500">
                Cộng theo hợp đồng
              </Text>
              <Text className="text-[13px] font-extrabold text-slate-900">
                {money(summary.total)}
              </Text>
            </View>
            <View className="mt-1.5 flex-row flex-wrap gap-x-4 gap-y-1">
              <Text className="text-[11px] font-semibold text-emerald-600">
                Đã trả: {money(summary.paid)}
              </Text>
              <Text className="text-[11px] font-semibold text-amber-600">
                Chưa trả: {money(summary.pending)}
              </Text>
              {summary.cancelled !== 0 ? (
                <Text className="text-[11px] font-semibold text-red-600">
                  Hủy bỏ: {money(summary.cancelled)}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default memo(PartnerCommissionTab);
