import React from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { OpportunityItem } from '@/services/opportunityService';
import { formatVND } from '@/utils/formatters';

interface OpportunityCardProps {
  item: OpportunityItem;
  onPress: () => void;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = React.memo(({ item, onPress }) => {
  const customerName = item.customer?.name || item.leadName || 'Chưa xác định';
  const isLead = !item.customer && !!item.leadName;
  const phoneNumber = item.customer?.phone || item.leadPhone;

  // Format currency with standard thousand separators
  const formatMoney = (val?: number) => formatVND(val);

  // Status mapping
  const getStatusMeta = (status: string) => {
    switch (status) {
      case 'OPEN':
        return { label: 'Mới tạo', color: '#64748B', bg: '#F1F5F9' };
      case 'PENDING_OPP_APPROVAL':
        return { label: 'Đang chờ duyệt', color: '#D97706', bg: '#FEF3C7' };
      case 'OPP_REJECTED':
        return { label: 'Không duyệt', color: '#DC2626', bg: '#FEE2E2' };
      case 'OPP_APPROVED':
        return { label: 'Đã duyệt cơ hội', color: '#059669', bg: '#D1FAE5' };
      case 'QUOTATION':
        return { label: 'Báo giá', color: '#4F46E5', bg: '#EEF2FF' };
      case 'QUOTATION_DRAFTING':
        return { label: 'Đang làm báo giá', color: '#2563EB', bg: '#DBEAFE' };
      case 'PENDING_QUOTE_APPROVAL':
        return { label: 'Chờ duyệt báo giá', color: '#EA580C', bg: '#FFEDD5' };
      case 'QUOTE_APPROVED':
        return { label: 'Báo giá đã duyệt', color: '#0D9488', bg: '#CCFBF1' };
      case 'CONTRACT_CREATED':
        return { label: 'Đang làm hợp đồng', color: '#7C3AED', bg: '#EDE9FE' };
      case 'CONTRACT_APPROVED':
        return { label: 'Đã tạo hợp đồng', color: '#16A34A', bg: '#DCFCE7' };
      case 'PROJECT_ASSIGNED':
        return { label: 'Đã giao dự án', color: '#4F46E5', bg: '#EEF2FF' };
      case 'IMPLEMENTATION':
        return { label: 'Đang triển khai', color: '#0284C7', bg: '#E0F2FE' };
      case 'COMPLETED':
        return { label: 'Hoàn thành', color: '#16A34A', bg: '#DCFCE7' };
      case 'CANCELLED':
        return { label: 'Đã hủy', color: '#DC2626', bg: '#FEE2E2' };
      default:
        return { label: status, color: '#64748B', bg: '#F1F5F9' };
    }
  };

  // Priority mapping
  const getPriorityMeta = (priority?: string) => {
    switch (priority) {
      case 'URGENT':
        return { label: 'Gấp', color: '#EF4444' };
      case 'HIGH':
        return { label: 'Cao', color: '#F97316' };
      case 'MEDIUM':
        return { label: 'Trung bình', color: '#3B82F6' };
      case 'LOW':
        return { label: 'Thấp', color: '#6B7280' };
      default:
        return null;
    }
  };

  const statusMeta = getStatusMeta(item.status);
  const priorityMeta = getPriorityMeta(item.priority);
  const chance = item.successChance ?? 0;

  const handleCall = () => {
    if (!phoneNumber) {
      Alert.alert('Không có SĐT', 'Cơ hội này chưa cập nhật số điện thoại liên hệ.');
      return;
    }
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Lỗi', 'Không thể kích hoạt cuộc gọi.');
    });
  };

  return (
    <TouchableOpacity
      className="bg-surface rounded-[18px] p-4 mx-4 mb-3 border border-border shadow-xs"
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Top Header Row: Code, Priority, Status */}
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-xs font-extrabold text-text-primary tracking-wider">{item.opportunityCode || 'OPP'}</Text>
          {priorityMeta && (
            <View className="px-1.5 py-0.5 rounded-md border" style={{ borderColor: priorityMeta.color }}>
              <Text className="text-[10px] font-bold" style={{ color: priorityMeta.color }}>
                {priorityMeta.label}
              </Text>
            </View>
          )}
        </View>

        <View className="px-2 py-0.5 rounded-lg" style={{ backgroundColor: statusMeta.bg }}>
          <Text className="text-[11px] font-bold" style={{ color: statusMeta.color }}>
            {statusMeta.label}
          </Text>
        </View>
      </View>

      {/* Opportunity Name */}
      <Text className="text-base font-extrabold text-slate-800 leading-6 mb-1.5" numberOfLines={2}>
        {item.name}
      </Text>

      {/* Customer / Lead Info */}
      <View className="flex-row items-center gap-1.5 mb-3.5">
        <Ionicons
          name={isLead ? 'person-outline' : 'business-outline'}
          size={15}
          color="#64748B"
        />
        <Text className="text-xs text-text-secondary font-semibold flex-1" numberOfLines={1}>
          {customerName}
        </Text>
        {isLead && (
          <View className="bg-amber-100 px-1.5 py-0.5 rounded-md">
            <Text className="text-[10px] font-bold text-amber-700">Lead</Text>
          </View>
        )}
      </View>

      {/* Financials & Chance Metrics */}
      <View className="flex-row bg-background rounded-xl p-3 gap-3 mb-3">
        <View className="flex-1">
          <Text className="text-[11px] text-text-muted font-semibold mb-0.5">Doanh thu kỳ vọng</Text>
          <Text className="text-[15px] font-extrabold text-primary">{formatMoney(item.expectedRevenue)}</Text>
        </View>

        <View className="flex-1">
          <View className="flex-row justify-between items-center">
            <Text className="text-[11px] text-text-muted font-semibold">Khả năng thành công</Text>
            <Text className="text-xs font-extrabold text-slate-700">{chance}%</Text>
          </View>
          <View className="h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, chance))}%`,
                backgroundColor:
                  chance >= 70 ? '#10B981' : chance >= 40 ? '#F59E0B' : '#94A3B8',
              }}
            />
          </View>
        </View>
      </View>

      {/* Card Footer: Date & Quick Actions */}
      <View className="flex-row justify-between items-center pt-1">
        <View className="flex-row items-center gap-1">
          <Feather name="clock" size={13} color="#94A3B8" />
          <Text className="text-[11px] text-text-muted font-medium">
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : 'Mới'}
          </Text>
        </View>

        <View className="flex-row items-center gap-2.5">
          {phoneNumber ? (
            <TouchableOpacity
              className="flex-row items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200"
              onPress={handleCall}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="phone-call" size={14} color="#10B981" />
              <Text className="text-[11px] font-bold text-emerald-600">Gọi</Text>
            </TouchableOpacity>
          ) : null}

          <View className="w-[26px] h-[26px] rounded-full bg-slate-100 justify-center items-center">
            <Feather name="chevron-right" size={16} color="#94A3B8" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default OpportunityCard;
