import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BrandColors } from '@/constants/colors';
import {
  ContractAddendum,
  ADDENDUM_STATUS_CONFIG,
  ADDENDUM_TYPE_LABELS,
} from '@/services/contractAddendumService';
import { formatVNDFull, formatDateToDDMMYYYY } from '@/utils/formatters';
import AddendumDetailModal from './AddendumDetailModal';

export interface ContractAddendumsTabProps {
  contractId: string;
  /** Dữ liệu lấy từ `contract.addendums` của GET /contracts/:id (KHÔNG gọi API list riêng). */
  addendums: ContractAddendum[];
  /** Role hiện tại (đã uppercase) — RBAC duyệt / gửi lại / sửa giá. */
  role?: string;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  isRefreshing?: boolean;
  onRetry?: () => void;
  onRefresh?: () => void;
}

const getItems = (addendum: ContractAddendum) => {
  const raw = (addendum as any)?.selectedItems ?? addendum?.services ?? [];
  return Array.isArray(raw) ? raw : [];
};

/**
 * Tab "Phụ lục" của màn chi tiết hợp đồng (P1.9).
 * Mirror erp-UI/src/pages/Contracts/ContractDetailPage/ContractAddendums.jsx.
 * Đủ 4 trạng thái: Loading / Empty / Error + retry / Success.
 */
export function ContractAddendumsTab({
  contractId,
  addendums,
  role,
  isLoading = false,
  isError = false,
  errorMessage,
  isRefreshing = false,
  onRetry,
  onRefresh,
}: ContractAddendumsTabProps) {
  const [selectedAddendum, setSelectedAddendum] = useState<ContractAddendum | null>(null);

  const renderItem = useCallback(
    ({ item }: { item: ContractAddendum }) => {
      const status = String(item.status || '');
      const statusConfig = ADDENDUM_STATUS_CONFIG[status] || {
        text: status || 'Chưa xác định',
        color: '#475569',
        bg: '#F1F5F9',
        border: '#E2E8F0',
      };
      const typeLabel = item.type ? ADDENDUM_TYPE_LABELS[String(item.type)] : '';
      const itemCount = getItems(item).length;

      return (
        <View className="bg-white rounded-[14px] border border-slate-100 shadow-sm p-[14px] gap-[10px]">
          <View className="flex-row flex-wrap items-center gap-[6px]">
            <View
              style={{ backgroundColor: statusConfig.bg, borderColor: statusConfig.border }}
              className="px-[8px] py-[2px] rounded-full border"
            >
              <Text
                style={{ color: statusConfig.color }}
                className="text-[10px] font-black uppercase tracking-[0.4px]"
              >
                {statusConfig.text}
              </Text>
            </View>

            {!!item.monthKey && (
              <View className="bg-slate-100 px-[8px] py-[2px] rounded-full">
                <Text className="text-[10px] font-black text-slate-600">{item.monthKey}</Text>
              </View>
            )}

            {!!typeLabel && (
              <View className="bg-[#EFF6FF] px-[8px] py-[2px] rounded-full">
                <Text className="text-[10px] font-black text-[#1D4ED8]">{typeLabel}</Text>
              </View>
            )}
          </View>

          <View className="flex-row items-start gap-[10px]">
            <View
              style={{ backgroundColor: '#F3E8FF' }}
              className="w-[40px] h-[40px] rounded-[11px] items-center justify-center"
            >
              <Feather name="file-text" size={19} color="#9333EA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text className="text-[15px] font-extrabold text-slate-900">
                {item.name || 'Phụ lục hợp đồng'}
              </Text>
              <View className="flex-row flex-wrap items-center gap-[10px] mt-[5px]">
                <View className="flex-row items-center gap-[4px]">
                  <Feather name="calendar" size={12} color="#94A3B8" />
                  <Text className="text-[11px] text-slate-500">
                    {formatDateToDDMMYYYY(item.createdAt, '—')}
                  </Text>
                </View>
                <Text className="text-[11px] text-slate-500">{itemCount} dịch vụ</Text>
              </View>
            </View>
          </View>

          <View className="flex-row items-center justify-between gap-[10px] pt-[10px] border-t border-t-slate-50">
            <View style={{ flex: 1 }}>
              <Text className="text-[10px] font-bold uppercase tracking-[0.5px] text-slate-400">
                Giá trị
              </Text>
              <Text className="text-[15px] font-black text-[#1D4ED8]">
                {formatVNDFull(Number(item.sellingPrice || 0))}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setSelectedAddendum(item)}
              activeOpacity={0.8}
              className="min-h-[48px] flex-row items-center gap-[6px] px-[14px] rounded-[12px] bg-[#F3E8FF] border border-[#E9D5FF]"
            >
              <Feather name="eye" size={15} color="#7E22CE" />
              <Text className="text-[13px] font-bold text-[#7E22CE]">Chi tiết</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [],
  );

  // 1. Loading
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-[10px] p-[24px]">
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text className="text-[12px] text-slate-500">Đang tải danh sách phụ lục...</Text>
      </View>
    );
  }

  // 2. Error + retry
  if (isError) {
    return (
      <View className="flex-1 items-center justify-center gap-[10px] p-[24px]">
        <Feather name="alert-circle" size={40} color="#EF4444" />
        <Text className="text-[14px] font-bold text-slate-800">
          Không tải được danh sách phụ lục
        </Text>
        <Text className="text-[12px] text-slate-500 text-center">
          {errorMessage || 'Vui lòng kiểm tra kết nối và thử lại.'}
        </Text>
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.8}
          className="mt-[4px] min-h-[48px] flex-row items-center gap-[6px] px-[18px] rounded-[12px] bg-[#F38820]"
        >
          <Feather name="refresh-cw" size={15} color="#FFFFFF" />
          <Text className="text-[14px] font-bold text-white">Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 3. Empty + 4. Success (FlatList)
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={addendums}
        keyExtractor={(item, index) => String(item.id || `addendum-${index}`)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[BrandColors.primary]}
              tintColor={BrandColors.primary}
            />
          ) : undefined
        }
        ListEmptyComponent={
          <View className="items-center justify-center gap-[8px] p-[40px] bg-white rounded-[14px] border border-dashed border-slate-200">
            <Feather name="file-plus" size={26} color="#CBD5E1" />
            <Text className="text-[13px] italic text-slate-500">Chưa có phụ lục nào</Text>
          </View>
        }
      />

      <AddendumDetailModal
        visible={!!selectedAddendum}
        addendum={selectedAddendum}
        contractId={contractId}
        role={role}
        onClose={() => setSelectedAddendum(null)}
      />
    </View>
  );
}

export default ContractAddendumsTab;
