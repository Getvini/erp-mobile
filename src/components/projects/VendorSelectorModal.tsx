import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandColors } from '@/constants/colors';
import {
  VendorItem,
  VendorType,
  VENDOR_TYPE_LABELS,
} from '@/services/vendorService';

export interface VendorSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  vendors: VendorItem[];
  selectedVendorId: string;
  onSelect: (vendorId: string) => void;
  jobTitle?: string;
}

const TYPE_BADGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  BUSINESS: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  INDIVIDUAL: { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
  KOL: { bg: '#FAF5FF', text: '#7E22CE', border: '#E9D5FF' },
  KOC: { bg: '#FFF7ED', text: '#C2410C', border: '#FFEDD5' },
};

export default function VendorSelectorModal({
  visible,
  onClose,
  vendors,
  selectedVendorId,
  onSelect,
  jobTitle,
}: VendorSelectorModalProps) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');

  // Extract distinct vendor types present in the provided list
  const availableTypeFilters = useMemo(() => {
    const typeSet = new Set<string>();
    vendors.forEach((vendor) => {
      if (vendor.type && VENDOR_TYPE_LABELS[vendor.type as VendorType]) {
        typeSet.add(vendor.type);
      }
    });
    return Array.from(typeSet);
  }, [vendors]);

  // Count by type for badges on filter chips
  const getTypeCount = (type: string) => {
    if (type === 'ALL') return vendors.length;
    return vendors.filter((v) => v.type === type).length;
  };

  // Filter and sort vendors
  const filteredAndSortedVendors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // 1. Filter
    const filtered = vendors.filter((vendor) => {
      if (!vendor?.id) return false;

      // Filter by type chip
      if (selectedTypeFilter !== 'ALL') {
        if (vendor.type !== selectedTypeFilter) {
          return false;
        }
      }

      // Filter by search query (name, phone, email, taxId, type label)
      if (q) {
        const nameMatch = (vendor.name || '').toLowerCase().includes(q);
        const phoneMatch = (vendor.phone || '').toLowerCase().includes(q);
        const emailMatch = (vendor.email || '').toLowerCase().includes(q);
        const taxMatch = (vendor.taxId || '').toLowerCase().includes(q);
        const typeLabel = vendor.type
          ? (VENDOR_TYPE_LABELS[vendor.type as VendorType] || '')
          : '';
        const typeMatch = typeLabel.toLowerCase().includes(q);

        if (!nameMatch && !phoneMatch && !emailMatch && !taxMatch && !typeMatch) {
          return false;
        }
      }

      return true;
    });

    // 2. Sort:
    //  - Selected vendor first
    //  - Alphabetical A-Z
    return [...filtered].sort((a, b) => {
      if (a.id === selectedVendorId) return -1;
      if (b.id === selectedVendorId) return 1;

      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB, 'vi');
    });
  }, [vendors, searchQuery, selectedTypeFilter, selectedVendorId]);

  const handleSelectVendor = (vendorId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(vendorId);
    onClose();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedTypeFilter('ALL');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-900/60 justify-end">
        <View
          className="bg-white rounded-t-[28px] max-h-[88%] p-5 pb-6 gap-3"
          style={{ paddingBottom: Math.max(insets.bottom, 20) }}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center pb-3 border-b border-slate-100">
            <View className="flex-1">
              <Text className="text-base font-bold text-slate-900">
                Chọn đối tác Vendor
              </Text>
              <Text className="text-xs text-slate-500 mt-0.5">
                {vendors.length} đối tác phù hợp{jobTitle ? ` cho ${jobTitle}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="p-1.5 rounded-full bg-slate-100"
              activeOpacity={0.7}
              accessibilityLabel="Đóng bộ chọn vendor"
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 gap-2">
            <Feather name="search" size={16} color="#94A3B8" />
            <TextInput
              className="flex-1 text-xs text-slate-900 p-0"
              placeholder="Tìm theo tên, SĐT, email, mã số thuế..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <Feather name="x-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Type Filter Chips */}
          {availableTypeFilters.length > 0 && (
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
              >
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedTypeFilter('ALL');
                  }}
                  activeOpacity={0.7}
                  className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                    selectedTypeFilter === 'ALL'
                      ? 'bg-primary border-primary'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      selectedTypeFilter === 'ALL' ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    Tất cả
                  </Text>
                  <View
                    className={`px-1.5 py-0.5 rounded-full ${
                      selectedTypeFilter === 'ALL' ? 'bg-orange-600' : 'bg-slate-200'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        selectedTypeFilter === 'ALL' ? 'text-white' : 'text-slate-500'
                      }`}
                    >
                      {getTypeCount('ALL')}
                    </Text>
                  </View>
                </TouchableOpacity>

                {availableTypeFilters.map((typeKey) => {
                  const isSelected = selectedTypeFilter === typeKey;
                  const label = VENDOR_TYPE_LABELS[typeKey as VendorType] || typeKey;
                  const count = getTypeCount(typeKey);
                  return (
                    <TouchableOpacity
                      key={typeKey}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedTypeFilter(typeKey);
                      }}
                      activeOpacity={0.7}
                      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          isSelected ? 'text-white' : 'text-slate-600'
                        }`}
                      >
                        {label}
                      </Text>
                      <View
                        className={`px-1.5 py-0.5 rounded-full ${
                          isSelected ? 'bg-orange-600' : 'bg-slate-200'
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-bold ${
                            isSelected ? 'text-white' : 'text-slate-500'
                          }`}
                        >
                          {count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Vendors List */}
          {filteredAndSortedVendors.length === 0 ? (
            <View className="py-8 items-center justify-center gap-2">
              <View className="w-12 h-12 rounded-full bg-slate-100 justify-center items-center">
                <Feather name="slash" size={22} color="#94A3B8" />
              </View>
              <Text className="text-xs font-medium text-slate-500 text-center">
                Không tìm thấy vendor phù hợp với điều kiện lọc.
              </Text>
              {(searchQuery || selectedTypeFilter !== 'ALL') && (
                <TouchableOpacity
                  onPress={handleResetFilters}
                  className="mt-1 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200"
                  activeOpacity={0.7}
                >
                  <Text className="text-xs font-bold text-primary">
                    Xóa bộ lọc tìm kiếm
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredAndSortedVendors}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
              renderItem={({ item }) => {
                const isSelected = selectedVendorId === item.id;
                const typeLabel = item.type
                  ? (VENDOR_TYPE_LABELS[item.type as VendorType] || item.type)
                  : '';
                const typeColor = item.type
                  ? TYPE_BADGE_COLORS[item.type] || {
                      bg: '#F1F5F9',
                      text: '#475569',
                      border: '#E2E8F0',
                    }
                  : null;

                const iconName =
                  item.type === 'BUSINESS'
                    ? 'briefcase'
                    : item.type === 'KOL' || item.type === 'KOC'
                    ? 'star'
                    : 'user';

                return (
                  <TouchableOpacity
                    className={`flex-row items-center gap-3 p-3 border rounded-xl ${
                      isSelected
                        ? 'border-primary bg-orange-50/60'
                        : 'border-slate-200 bg-white'
                    }`}
                    onPress={() => handleSelectVendor(item.id)}
                    activeOpacity={0.7}
                  >
                    {/* Icon / Avatar */}
                    <View
                      className={`w-9 h-9 rounded-full justify-center items-center ${
                        isSelected ? 'bg-orange-100' : 'bg-slate-100'
                      }`}
                    >
                      {item.type === 'BUSINESS' ? (
                        <MaterialCommunityIcons
                          name="office-building"
                          size={18}
                          color={isSelected ? BrandColors.primary : '#64748B'}
                        />
                      ) : (
                        <Feather
                          name={iconName as any}
                          size={16}
                          color={isSelected ? BrandColors.primary : '#64748B'}
                        />
                      )}
                    </View>

                    {/* Vendor Info */}
                    <View className="flex-1 justify-center min-w-0">
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        <Text
                          className={`text-[13px] font-bold ${
                            isSelected ? 'text-slate-900' : 'text-slate-800'
                          }`}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>

                        {typeLabel && typeColor ? (
                          <View
                            className="px-1.5 py-0.5 rounded border"
                            style={{
                              backgroundColor: typeColor.bg,
                              borderColor: typeColor.border,
                            }}
                          >
                            <Text
                              className="text-[10px] font-bold"
                              style={{ color: typeColor.text }}
                            >
                              {typeLabel}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Phone & Tax details */}
                      <View className="flex-row items-center gap-2 mt-0.5">
                        {item.phone ? (
                          <Text
                            className="text-[11px] font-medium text-slate-500"
                            numberOfLines={1}
                          >
                            {item.phone}
                          </Text>
                        ) : null}
                        {item.taxId ? (
                          <Text
                            className="text-[11px] text-slate-400"
                            numberOfLines={1}
                          >
                            MST: {item.taxId}
                          </Text>
                        ) : null}
                        {!item.phone && !item.taxId ? (
                          <Text className="text-[11px] text-slate-400 italic">
                            Đối tác Vendor
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Selection Indicator */}
                    <View className="flex-row items-center gap-1.5">
                      {isSelected ? (
                        <>
                          <Text className="text-[11px] font-bold text-primary">
                            Đang chọn
                          </Text>
                          <Feather
                            name="check-circle"
                            size={18}
                            color={BrandColors.primary}
                          />
                        </>
                      ) : (
                        <Feather name="circle" size={18} color="#CBD5E1" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
