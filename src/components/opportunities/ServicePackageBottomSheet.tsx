import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { formatVND } from '@/utils/formatters';

export interface ServicePackageItem {
  id: string;
  name: string;
  description?: string;
  price?: number;
  servicesCount?: number;
}

interface ServicePackageBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  packages: ServicePackageItem[];
  selectedPackageId?: string;
  onSelectPackage: (pkg: ServicePackageItem) => void;
}

export function ServicePackageBottomSheet({
  visible,
  onClose,
  packages = [],
  selectedPackageId,
  onSelectPackage,
}: ServicePackageBottomSheetProps) {
  const [search, setSearch] = useState('');

  const filteredPackages = packages.filter((pkg) =>
    (pkg.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (pkg: ServicePackageItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectPackage(pkg);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-slate-900/50 justify-end" onPress={onClose}>
        <Pressable
          className="bg-surface rounded-t-[24px] max-h-[85%] px-5 pt-4 pb-8"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Draggable Handle Indicator Bar */}
          <View className="items-center mb-3">
            <View className="w-12 h-1.5 rounded-full bg-slate-300" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-border">
            <View>
              <Text className="text-base font-extrabold text-text-primary">
                Chọn Gói Dịch Vụ
              </Text>
              <Text className="text-xs text-slate-500 font-medium mt-0.5">
                Danh sách gói dịch vụ tiêu chuẩn Getvini
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 items-center justify-center"
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="flex-row items-center bg-background rounded-xl border border-border px-3.5 h-11 my-3">
            <Feather name="search" size={16} color="#94A3B8" />
            <TextInput
              className="flex-1 ml-2 text-xs text-text-primary"
              placeholder="Tìm tên gói dịch vụ..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Packages List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
          >
            {filteredPackages.length === 0 ? (
              <View className="py-8 items-center justify-center gap-2">
                <Feather name="package" size={32} color="#CBD5E1" />
                <Text className="text-xs text-slate-400 font-medium">
                  Không tìm thấy gói dịch vụ phù hợp
                </Text>
              </View>
            ) : (
              filteredPackages.map((pkg) => {
                const isSelected = selectedPackageId === pkg.id;
                return (
                  <TouchableOpacity
                    key={pkg.id}
                    activeOpacity={0.8}
                    onPress={() => handleSelect(pkg)}
                    className={`p-4 rounded-2xl border ${
                      isSelected
                        ? 'border-primary bg-orange-50/50'
                        : 'border-border bg-surface'
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 mr-3">
                        <Text
                          className={`text-sm ${
                            isSelected ? 'font-extrabold text-primary' : 'font-bold text-text-primary'
                          }`}
                        >
                          {pkg.name}
                        </Text>
                        {pkg.description ? (
                          <Text className="text-xs text-slate-500 mt-1" numberOfLines={2}>
                            {pkg.description}
                          </Text>
                        ) : null}
                      </View>
                      {isSelected ? (
                        <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                          <Feather name="check" size={14} color="#FFFFFF" />
                        </View>
                      ) : (
                        <Feather name="chevron-right" size={18} color="#94A3B8" />
                      )}
                    </View>

                    {pkg.price ? (
                      <View className="mt-2.5 pt-2 border-t border-slate-100 flex-row justify-between items-center">
                        <Text className="text-[11px] text-slate-400 font-medium">Đơn giá định mức</Text>
                        <Text className="text-xs font-bold text-primary">
                          {formatVND(pkg.price)}
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
