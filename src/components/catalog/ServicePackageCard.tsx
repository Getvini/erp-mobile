import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ServicePackage } from '@/services/servicePackageService';
import { formatVND } from '@/utils/formatters';

interface ServicePackageCardProps {
  servicePackage: ServicePackage;
  onPress?: (servicePackage: ServicePackage) => void;
}

function ServicePackageCard({ servicePackage, onPress }: ServicePackageCardProps) {
  const serviceCount = Array.isArray(servicePackage.items) ? servicePackage.items.length : 0;
  const isActive = servicePackage.isActive !== false;

  return (
    <TouchableOpacity
      testID={`servicePackageCard-${servicePackage.id}`}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      onPress={() => onPress?.(servicePackage)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Gói dịch vụ ${servicePackage.name}`}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50">
          <Feather name="package" size={20} color="#2563EB" />
        </View>

        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-sm font-extrabold text-slate-900" numberOfLines={2}>
              {servicePackage.name}
            </Text>
            {isActive ? (
              <View className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1">
                <Text className="text-[10px] font-bold text-emerald-600">Đang bán</Text>
              </View>
            ) : (
              <View className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1">
                <Text className="text-[10px] font-bold text-slate-500">Đã ẩn</Text>
              </View>
            )}
          </View>

          {servicePackage.description ? (
            <Text className="mt-1 text-xs leading-[18px] text-slate-500" numberOfLines={2}>
              {servicePackage.description}
            </Text>
          ) : null}

          <View className="mt-2.5 flex-row items-center justify-between">
            <Text className="text-sm font-extrabold text-orange-600">
              {formatVND(servicePackage.price ?? 0)}
            </Text>
            <View className="flex-row items-center gap-1">
              <Feather name="layers" size={12} color="#64748B" />
              <Text className="text-[11px] font-semibold text-slate-500">
                {serviceCount} dịch vụ
              </Text>
            </View>
          </View>
        </View>

        <Feather name="chevron-right" size={18} color="#94A3B8" />
      </View>
    </TouchableOpacity>
  );
}

export default memo(ServicePackageCard);
