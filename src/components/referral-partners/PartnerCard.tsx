import React, { memo, useCallback } from 'react';
import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ReferralPartnerItem } from '@/services/referralPartnerService';
import { getPartnerTypeLabel } from '@/utils/partnerCommission';

interface PartnerCardProps {
  partner: ReferralPartnerItem;
  onPress: (id: string) => void;
}

function PartnerCard({ partner, onPress }: PartnerCardProps) {
  const typeLabel = getPartnerTypeLabel(partner.type) || 'Chưa xác định';
  const isIndividual = partner.type === 'INDIVIDUAL';
  const opportunityCount = partner.opportunities?.length || 0;
  const contractCount = partner.contracts?.length || 0;

  const handleCall = useCallback(() => {
    if (!partner.phone) {
      Alert.alert('Thông báo', 'Đối tác này chưa cập nhật số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${partner.phone}`);
  }, [partner.phone]);

  const handleEmail = useCallback(() => {
    if (!partner.email) {
      Alert.alert('Thông báo', 'Đối tác này chưa cập nhật email liên hệ.');
      return;
    }
    Linking.openURL(`mailto:${partner.email}`);
  }, [partner.email]);

  return (
    <TouchableOpacity
      testID={`partnerCard-${partner.id}`}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      onPress={() => onPress(partner.id)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Xem chi tiết đối tác ${partner.name}`}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-[42px] w-[42px] items-center justify-center rounded-xl border border-orange-100 bg-orange-50">
          <Text className="text-lg font-extrabold text-orange-600">
            {(partner.name || 'Đ').charAt(0).toUpperCase()}
          </Text>
        </View>

        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-[15px] font-bold text-slate-900" numberOfLines={2}>
              {partner.name}
            </Text>
            <View
              className={`rounded-lg border px-2 py-1 ${
                isIndividual ? 'border-emerald-100 bg-emerald-50' : 'border-orange-100 bg-orange-50'
              }`}
            >
              <Text
                className={`text-[10px] font-bold ${
                  isIndividual ? 'text-emerald-700' : 'text-orange-700'
                }`}
              >
                {typeLabel}
              </Text>
            </View>
          </View>

          <View className="mt-2 gap-1.5">
            <View className="flex-row items-center gap-1.5">
              <Feather name="phone" size={12} color="#10B981" />
              <Text className="text-xs text-slate-600" numberOfLines={1}>
                {partner.phone || 'Chưa có SĐT'}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Feather name="mail" size={12} color="#3B82F6" />
              <Text className="text-xs text-slate-600" numberOfLines={1}>
                {partner.email || 'Chưa có email'}
              </Text>
            </View>
          </View>
        </View>

        <Feather name="chevron-right" size={18} color="#94A3B8" />
      </View>

      <View className="mt-3 flex-row items-center justify-between border-t border-slate-100 pt-2.5">
        <Text className="text-[11px] font-semibold text-slate-500">
          {opportunityCount} cơ hội · {contractCount} hợp đồng
        </Text>

        <View className="flex-row items-center gap-2">
          {partner.phone ? (
            <TouchableOpacity
              className="min-h-[48px] flex-row items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5"
              onPress={handleCall}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Gọi điện cho ${partner.name}`}
            >
              <Feather name="phone" size={14} color="#10B981" />
              <Text className="text-xs font-bold text-emerald-600">Gọi</Text>
            </TouchableOpacity>
          ) : null}

          {partner.email ? (
            <TouchableOpacity
              className="min-h-[48px] flex-row items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5"
              onPress={handleEmail}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Gửi email cho ${partner.name}`}
            >
              <Feather name="mail" size={14} color="#3B82F6" />
              <Text className="text-xs font-bold text-blue-600">Mail</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default memo(PartnerCard);
