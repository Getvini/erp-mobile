import React, { useState, useMemo, memo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface SelectPackageModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (pkg: any) => void;
  packageTemplates: any[];
  selectedPackageNames: Set<string>;
}

export const SelectPackageModal = memo<SelectPackageModalProps>(({
  visible,
  onClose,
  onSelect,
  packageTemplates,
  selectedPackageNames,
}) => {
  const [search, setSearch] = useState('');

  const filteredPackageTemplates = useMemo(() => {
    return packageTemplates.filter(
      (p) =>
        !selectedPackageNames.has(p.name) &&
        (search.trim() === '' || p.name?.toLowerCase().includes(search.toLowerCase()))
    );
  }, [packageTemplates, selectedPackageNames, search]);

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  const handleSelect = (pkg: any) => {
    setSearch('');
    onSelect(pkg);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[80%] rounded-t-[20px] bg-white p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-bold text-slate-900">Chọn gói mẫu thêm vào</Text>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View className="mb-3 flex-row items-center gap-2 rounded-[10px] bg-slate-100 px-3 py-2">
            <Feather name="search" size={16} color="#94A3B8" />
            <TextInput
              className="flex-1 p-0 text-sm text-slate-900"
              placeholder="Tìm kiếm gói dịch vụ..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <FlatList
            data={filteredPackageTemplates}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="flex-row items-center justify-between border-b border-slate-100 py-3"
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-900">{item.name}</Text>
                  <Text className="mt-0.5 text-xs text-slate-500">
                    Gồm {(item.items || []).length} dịch vụ con
                  </Text>
                </View>
                <Feather name="plus" size={18} color="#2563EB" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View className="items-center justify-center py-8">
                <Text className="text-[13px] text-slate-400">Không có gói dịch vụ phù hợp</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
});

SelectPackageModal.displayName = 'SelectPackageModal';
export default SelectPackageModal;
