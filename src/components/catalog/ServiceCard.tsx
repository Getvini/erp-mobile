import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ServiceItem } from '@/services/catalogService';
import { formatVND } from '@/utils/formatters';

interface ServiceCardProps {
  service: ServiceItem;
  onPress?: (service: ServiceItem) => void;
  onLongPress?: (service: ServiceItem) => void;
  /** Bật chế độ chọn nhiều (hiện ô tick bên trái). */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (service: ServiceItem) => void;
}

function ServiceCard({
  service,
  onPress,
  onLongPress,
  selectable = false,
  selected = false,
  onToggleSelect,
}: ServiceCardProps) {
  const jobCount = Array.isArray(service.serviceJobs) ? service.serviceJobs.length : 0;

  const handlePress = () => {
    if (selectable) {
      onToggleSelect?.(service);
      return;
    }
    onPress?.(service);
  };

  return (
    <TouchableOpacity
      testID={`serviceCard-${service.id}`}
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        selected ? 'border-primary bg-primary-light' : 'border-slate-200'
      }`}
      onPress={handlePress}
      onLongPress={onLongPress ? () => onLongPress(service) : undefined}
      delayLongPress={280}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Dịch vụ ${service.name}`}
    >
      <View className="flex-row items-start gap-3">
        {selectable ? (
          <View
            className={`mt-0.5 h-6 w-6 items-center justify-center rounded-lg border-2 ${
              selected ? 'border-primary bg-primary' : 'border-slate-300 bg-white'
            }`}
          >
            {selected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
          </View>
        ) : (
          <View className="h-11 w-11 items-center justify-center rounded-xl border border-orange-100 bg-primary-light">
            <Feather name={service.isAI ? 'cpu' : 'briefcase'} size={20} color="#F38820" />
          </View>
        )}

        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-sm font-extrabold text-slate-900" numberOfLines={2}>
              {service.name}
            </Text>
            {service.isAI ? (
              <View className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1">
                <Text className="text-[10px] font-bold text-violet-600">AI</Text>
              </View>
            ) : null}
          </View>

          <Text className="mt-1 text-[11px] font-semibold text-slate-400">
            {service.code ? `#${service.code}` : `#${service.id.slice(0, 8)}`}
            {service.unit ? ` • Đơn vị: ${service.unit}` : ''}
          </Text>

          <View className="mt-2.5 flex-row items-center justify-between">
            <Text className="text-sm font-extrabold text-orange-600">
              {formatVND(service.costPrice ?? 0)}
            </Text>
            <View className="flex-row items-center gap-1">
              <Feather name="layers" size={12} color="#64748B" />
              <Text className="text-[11px] font-semibold text-slate-500">
                {jobCount} hạng mục
              </Text>
            </View>
          </View>
        </View>

        {!selectable ? <Feather name="chevron-right" size={18} color="#94A3B8" /> : null}
      </View>
    </TouchableOpacity>
  );
}

export default memo(ServiceCard);
