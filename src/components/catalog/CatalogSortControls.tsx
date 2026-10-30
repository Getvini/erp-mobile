import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import type { CatalogSort } from '@/utils/catalogSorting';
export default function CatalogSortControls({ options, value, onChange }: {
  options: { key: string; label: string }[]; value: CatalogSort; onChange: (value: CatalogSort) => void;
}) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
    {options.map((option) => <TouchableOpacity key={option.key} accessibilityRole="button" accessibilityState={{ selected: value.key === option.key }} accessibilityLabel={'Sắp xếp theo ' + option.label + (value.key === option.key ? (value.direction === 'asc' ? ', tăng dần' : ', giảm dần') : '')} onPress={() => onChange({ key: option.key, direction: value.key === option.key && value.direction === 'asc' ? 'desc' : 'asc' })} className={'min-h-[48px] justify-center px-3 rounded-xl border ' + (value.key === option.key ? 'border-primary bg-orange-50' : 'border-slate-200 bg-white')}><Text className="text-xs text-slate-700">{option.label}{value.key === option.key ? value.direction === 'asc' ? ' ↑' : ' ↓' : ''}</Text></TouchableOpacity>)}
  </ScrollView>;
}
