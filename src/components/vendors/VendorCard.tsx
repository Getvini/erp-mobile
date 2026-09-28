import React from 'react';
import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { VendorItem, VENDOR_TYPE_LABELS, VendorType } from '@/services/vendorService';
import { BrandColors } from '@/constants/colors';

export interface VendorCardProps {
  vendor: VendorItem;
  onPress?: (vendor: VendorItem) => void;
}

/** Badge màu theo loại nhà cung cấp. */
const TYPE_BADGE_STYLES: Record<VendorType, { bg: string; text: string }> = {
  BUSINESS: { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600' },
  INDIVIDUAL: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-600' },
  KOL: { bg: 'bg-purple-50 border-purple-100', text: 'text-purple-600' },
  KOC: { bg: 'bg-amber-50 border-amber-100', text: 'text-amber-600' },
};

export const getVendorTypeLabel = (type?: string | null): string =>
  VENDOR_TYPE_LABELS[(type as VendorType) ?? 'BUSINESS'] ?? 'Doanh nghiệp';

/** Số hạng mục (Job) mà nhà cung cấp đang phụ trách. */
export const countVendorJobs = (vendor?: VendorItem | null): number => {
  const jobs = vendor?.vendorJobs;
  return Array.isArray(jobs) ? jobs.length : 0;
};

const openUrl = (url: string) => {
  try {
    Linking?.openURL?.(url);
  } catch {
    // Bỏ qua lỗi thiết bị không hỗ trợ tel:/mailto:
  }
};

export const handleVendorCall = (phone?: string | null) => {
  const value = (phone ?? '').trim();
  if (!value) {
    Alert.alert('Thông báo', 'Nhà cung cấp này chưa cập nhật số điện thoại.');
    return;
  }
  openUrl(`tel:${value}`);
};

export const handleVendorEmail = (email?: string | null) => {
  const value = (email ?? '').trim();
  if (!value) {
    Alert.alert('Thông báo', 'Nhà cung cấp này chưa cập nhật email liên hệ.');
    return;
  }
  openUrl(`mailto:${value}`);
};

/**
 * Thẻ nhà cung cấp trong danh sách: tên, badge loại, SĐT, email,
 * số hạng mục phụ trách + thao tác gọi/mail 1 chạm.
 */
export default function VendorCard({ vendor, onPress }: VendorCardProps) {
  const type = (vendor.type as VendorType) ?? 'BUSINESS';
  const badge = TYPE_BADGE_STYLES[type] ?? TYPE_BADGE_STYLES.BUSINESS;
  const jobCount = countVendorJobs(vendor);
  const initial = (vendor.name || 'N').charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      testID={`vendorCard-${vendor.id}`}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      onPress={() => onPress?.(vendor)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Nhà cung cấp ${vendor.name}`}
    >
      <View className="mb-2.5 flex-row items-center">
        <View className="mr-3 h-[42px] w-[42px] items-center justify-center rounded-xl border border-orange-100 bg-orange-50">
          <Text className="text-lg font-extrabold text-orange-600">{initial}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-slate-900" numberOfLines={1}>
            {vendor.name}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <View className={`rounded-lg border px-2 py-0.5 ${badge.bg}`}>
              <Text className={`text-[10px] font-bold ${badge.text}`}>{getVendorTypeLabel(type)}</Text>
            </View>
            <Text className="text-[11px] font-semibold text-slate-400">
              {jobCount} hạng mục phụ trách
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color="#CBD5E1" />
      </View>

      <View className="rounded-xl bg-slate-50 p-2.5">
        <View className="flex-row items-center gap-1.5">
          <Feather name="phone" size={13} color="#64748B" />
          <Text className="flex-1 text-xs text-slate-600" numberOfLines={1}>
            {vendor.phone?.trim() ? vendor.phone : 'Chưa cập nhật SĐT'}
          </Text>
        </View>
        <View className="mt-1.5 flex-row items-center gap-1.5">
          <Feather name="mail" size={13} color="#64748B" />
          <Text className="flex-1 text-xs text-slate-600" numberOfLines={1}>
            {vendor.email?.trim() ? vendor.email : 'Chưa cập nhật email'}
          </Text>
        </View>
      </View>

      <View className="mt-2.5 flex-row items-center gap-2 border-t border-slate-100 pt-2.5">
        <TouchableOpacity
          testID={`vendorCall-${vendor.id}`}
          className="min-h-[48px] flex-row items-center gap-1.5 rounded-lg bg-emerald-50 px-3"
          onPress={() => handleVendorCall(vendor.phone)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Gọi điện cho ${vendor.name}`}
        >
          <Feather name="phone-call" size={14} color={BrandColors.success} />
          <Text className="text-xs font-bold text-emerald-600">Gọi điện</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID={`vendorEmail-${vendor.id}`}
          className="min-h-[48px] flex-row items-center gap-1.5 rounded-lg bg-blue-50 px-3"
          onPress={() => handleVendorEmail(vendor.email)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Gửi email cho ${vendor.name}`}
        >
          <Feather name="mail" size={14} color={BrandColors.info} />
          <Text className="text-xs font-bold text-blue-600">Gửi mail</Text>
        </TouchableOpacity>

        {vendor.bankName ? (
          <View className="flex-1 flex-row items-center justify-end gap-1">
            <Feather name="credit-card" size={12} color="#94A3B8" />
            <Text className="text-[11px] font-semibold text-slate-400" numberOfLines={1}>
              {vendor.bankName}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
