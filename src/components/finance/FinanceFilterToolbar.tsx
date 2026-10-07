import React, { memo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptic from 'expo-haptics';
import { useFinanceStore } from '@/stores/useFinanceStore';

const PRESET_OPTIONS: Array<{ key: 'this_month' | 'last_month' | 'this_quarter' | 'all'; label: string }> = [
  { key: 'this_month', label: 'Tháng này' },
  { key: 'last_month', label: 'Tháng trước' },
  { key: 'this_quarter', label: 'Quý này' },
  { key: 'all', label: 'Tất cả' },
];

const DEBT_STATUS_OPTIONS: Array<{ key: 'ALL' | 'HAS_DEBT' | 'NO_DEBT'; label: string }> = [
  { key: 'ALL', label: 'Tất cả công nợ' },
  { key: 'HAS_DEBT', label: 'Còn nợ cần thu' },
  { key: 'NO_DEBT', label: 'Đã hoàn thành thu' },
];

export const FinanceFilterToolbar = memo(() => {
  const searchTerm = useFinanceStore((s) => s.searchTerm);
  const setSearchTerm = useFinanceStore((s) => s.setSearchTerm);
  const preset = useFinanceStore((s) => s.preset);
  const setPreset = useFinanceStore((s) => s.setPreset);
  const debtStatusFilter = useFinanceStore((s) => s.debtStatusFilter);
  const setDebtStatusFilter = useFinanceStore((s) => s.setDebtStatusFilter);
  const resetFilters = useFinanceStore((s) => s.resetFilters);

  return (
    <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-4 gap-3">
      {/* 1. Thanh Tìm kiếm Mã HĐ / Khách hàng */}
      <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
        <Feather name="search" size={16} color="#94A3B8" />
        <TextInput
          className="flex-1 ml-2 text-sm text-slate-900 p-0"
          placeholder="Tìm mã hợp đồng, khách hàng..."
          placeholderTextColor="#94A3B8"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm ? (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <Feather name="x-circle" size={16} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 2. Bộ lọc thời gian (Presets) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16 }}
        className="flex-row"
      >
        {PRESET_OPTIONS.map((opt) => {
          const isSelected = preset === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              activeOpacity={0.8}
              className={`shrink-0 px-3.5 py-1.5 rounded-lg border min-h-[32px] justify-center items-center mr-2 ${
                isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'
              }`}
              onPress={() => {
                Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Light);
                setPreset(opt.key);
              }}
            >
              <Text
                numberOfLines={1}
                className={`text-xs font-bold ${isSelected ? 'text-indigo-600' : 'text-slate-600'}`}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 3. Bộ lọc trạng thái công nợ & Reset */}
      <View className="flex-row items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 12 }}
          className="flex-1 flex-row"
        >
          {DEBT_STATUS_OPTIONS.map((opt) => {
            const isSelected = debtStatusFilter === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.8}
                className={`shrink-0 px-3 py-1.5 rounded-md border min-h-[30px] justify-center items-center mr-2 ${
                  isSelected ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'
                }`}
                onPress={() => {
                  Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Light);
                  setDebtStatusFilter(opt.key);
                }}
              >
                <Text
                  numberOfLines={1}
                  className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-slate-600'}`}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          className="flex-row items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-md min-h-[28px]"
          onPress={() => {
            Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Light);
            resetFilters();
          }}
        >
          <Feather name="rotate-ccw" size={12} color="#64748B" />
          <Text className="text-[11px] font-bold text-slate-600">Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

FinanceFilterToolbar.displayName = 'FinanceFilterToolbar';
export default FinanceFilterToolbar;
