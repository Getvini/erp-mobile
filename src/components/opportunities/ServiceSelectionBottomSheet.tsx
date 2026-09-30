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
import { formatVNDFull } from '@/utils/formatters';

export interface ServiceSelectionItem {
  id: string;
  name: string;
  costPrice?: number;
  description?: string;
}

interface ServiceSelectionBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  services: ServiceSelectionItem[];
  selectedServiceId?: string;
  onSelectService: (serviceId: string) => void;
}

export function ServiceSelectionBottomSheet({
  visible,
  onClose,
  title = 'Chọn Dịch Vụ Lẻ',
  services = [],
  selectedServiceId,
  onSelectService,
}: ServiceSelectionBottomSheetProps) {
  const [search, setSearch] = useState('');

  const filteredServices = services.filter((serv) =>
    (serv.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (serviceId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelectService(serviceId);
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
              <Text className="text-base font-extrabold text-text-primary">{title}</Text>
              <Text className="text-xs text-slate-500 font-medium mt-0.5">
                Danh sách dịch vụ đơn lẻ Getvini
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
              placeholder="Tìm tên dịch vụ..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Services List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
          >
            {/* Clear option */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleSelect('')}
              className={`p-3.5 rounded-2xl border ${
                !selectedServiceId ? 'border-primary bg-orange-50/50' : 'border-border bg-surface'
              }`}
            >
              <Text className="text-xs font-bold text-slate-500">-- Chưa chọn dịch vụ --</Text>
            </TouchableOpacity>

            {filteredServices.length === 0 ? (
              <View className="py-8 items-center justify-center gap-2">
                <Feather name="layers" size={32} color="#CBD5E1" />
                <Text className="text-xs text-slate-400 font-medium">
                  Không tìm thấy dịch vụ phù hợp
                </Text>
              </View>
            ) : (
              filteredServices.map((serv) => {
                const isSelected = selectedServiceId === serv.id;
                return (
                  <TouchableOpacity
                    key={serv.id}
                    activeOpacity={0.8}
                    onPress={() => handleSelect(serv.id)}
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
                          {serv.name}
                        </Text>
                        {serv.description ? (
                          <Text className="text-xs text-slate-500 mt-1" numberOfLines={2}>
                            {serv.description}
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

                    {serv.costPrice ? (
                      <View className="mt-2.5 pt-2 border-t border-slate-100 flex-row justify-between items-center">
                        <Text className="text-[11px] text-slate-400 font-medium">Giá vốn định mức</Text>
                        <Text className="text-xs font-bold text-primary">
                          {formatVNDFull(serv.costPrice)}
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
