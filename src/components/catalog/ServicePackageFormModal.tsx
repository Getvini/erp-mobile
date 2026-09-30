import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptic from 'expo-haptics';
import { useServicesQuery } from '@/hooks/queries/useServices';
import {
  useCreateServicePackageMutation,
  useUpdateServicePackageMutation,
} from '@/hooks/queries/useServicePackages';
import { ServiceItem } from '@/services/catalogService';
import {
  ServicePackage,
  ServicePackageItemPayload,
} from '@/services/servicePackageService';
import { BrandColors } from '@/constants/colors';
import { formatNumberInput, formatVND, parseNumberInput } from '@/utils/formatters';

interface ServicePackageFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Có giá trị ⇒ chế độ Sửa; `null`/`undefined` ⇒ chế độ Thêm mới. */
  servicePackage?: ServicePackage | null;
}

interface PackageItemRow {
  /** Key cục bộ — `item.id` của backend đổi mỗi lần PUT nên không dùng làm key. */
  key: string;
  serviceId: string;
  quantityText: string;
}

let rowKeySeed = 0;
const nextRowKey = () => {
  rowKeySeed += 1;
  return `pkg-row-${rowKeySeed}`;
};

const createEmptyRow = (): PackageItemRow => ({
  key: nextRowKey(),
  serviceId: '',
  quantityText: '1',
});

function toNumberOrOne(text: string): number {
  const parsed = parseNumberInput(text);
  return parsed > 0 ? parsed : 1;
}

export default function ServicePackageFormModal({
  visible,
  onClose,
  onSuccess,
  servicePackage,
}: ServicePackageFormModalProps) {
  const isEditMode = Boolean(servicePackage?.id);
  const createMutation = useCreateServicePackageMutation();
  const updateMutation = useUpdateServicePackageMutation();

  // ⚠️ Component KHÔNG tự reset state bằng useEffect (tránh cascading render).
  // Màn hình cha truyền `key` mới mỗi lần mở sheet ⇒ state khởi tạo trực tiếp từ prop.
  const [name, setName] = useState(servicePackage?.name ?? '');
  const [description, setDescription] = useState(servicePackage?.description ?? '');
  const [isActive, setIsActive] = useState(servicePackage?.isActive !== false);
  const [rows, setRows] = useState<PackageItemRow[]>(() => {
    const items = Array.isArray(servicePackage?.items) ? servicePackage.items : [];
    return items.length > 0
      ? items.map((item) => ({
          key: nextRowKey(),
          serviceId: item.serviceId ?? '',
          quantityText: formatNumberInput(Number(item.defaultQuantity || 1)),
        }))
      : [createEmptyRow()];
  });
  const [openPickerKey, setOpenPickerKey] = useState<string | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: services = [], isLoading: isLoadingServices } = useServicesQuery();

  const serviceById = useMemo(() => {
    const map = new Map<string, ServiceItem>();
    services.forEach((service) => map.set(service.id, service));
    (servicePackage?.items ?? []).forEach((item) => {
      if (item.service) map.set(item.serviceId, item.service);
    });
    return map;
  }, [services, servicePackage]);

  const filteredServices = useCallback(
    (excludeRowKey: string) => {
      const usedByOtherRows = new Set(
        rows.filter((row) => row.key !== excludeRowKey && row.serviceId).map((row) => row.serviceId),
      );
      const keyword = serviceSearch.trim().toLowerCase();
      return services.filter((service) => {
        if (usedByOtherRows.has(service.id)) return false;
        if (!keyword) return true;
        return (
          (service.name || '').toLowerCase().includes(keyword) ||
          (service.code || '').toLowerCase().includes(keyword)
        );
      });
    },
    [rows, serviceSearch, services],
  );

  const handleToggleQuantityInput = useCallback((key: string, text: string) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, quantityText: formatNumberInput(text) } : row)),
    );
  }, []);

  const handleSelectService = useCallback((rowKey: string, serviceId: string) => {
    setRows((prev) => prev.map((row) => (row.key === rowKey ? { ...row, serviceId } : row)));
    setOpenPickerKey(null);
    setServiceSearch('');
  }, []);

  const handleAddRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow()]);
  }, []);

  const handleRemoveRow = useCallback((key: string) => {
    setRows((prev) => {
      const next = prev.filter((row) => row.key !== key);
      return next.length > 0 ? next : [createEmptyRow()];
    });
  }, []);

  const packagePreviewPrice = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const service = serviceById.get(row.serviceId);
        return sum + Number(service?.costPrice || 0) * toNumberOrOne(row.quantityText);
      }, 0),
    [rows, serviceById],
  );

  const submit = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Lỗi nhập liệu', 'Vui lòng nhập tên gói dịch vụ.');
      return;
    }

    const validRows = rows.filter((row) => row.serviceId);
    if (validRows.length === 0) {
      Alert.alert('Lỗi nhập liệu', 'Vui lòng chọn ít nhất 1 dịch vụ cho gói.');
      return;
    }

    const duplicated = validRows
      .map((row) => row.serviceId)
      .filter((serviceId, index, list) => list.indexOf(serviceId) !== index);
    if (duplicated.length > 0) {
      Alert.alert('Lỗi nhập liệu', 'Mỗi dịch vụ chỉ được xuất hiện một lần trong gói.');
      return;
    }

    const items: ServicePackageItemPayload[] = validRows.map((row) => ({
      serviceId: row.serviceId,
      defaultQuantity: Number(toNumberOrOne(row.quantityText)),
    }));

    setIsSubmitting(true);
    try {
      if (isEditMode && servicePackage) {
        await updateMutation.mutateAsync({
          id: servicePackage.id,
          name: trimmedName,
          description: description.trim(),
          isActive,
          items,
        });
      } else {
        await createMutation.mutateAsync({
          name: trimmedName,
          description: description.trim() || undefined,
          items,
        });
      }

      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert(
        isEditMode ? 'Không thể cập nhật gói dịch vụ' : 'Không thể tạo gói dịch vụ',
        error?.message || 'Vui lòng kiểm tra dữ liệu và thử lại.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    createMutation,
    description,
    isActive,
    isEditMode,
    name,
    onClose,
    onSuccess,
    rows,
    servicePackage,
    updateMutation,
  ]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="max-h-[90%] rounded-t-3xl border-t border-slate-200 bg-white shadow-xl">
          {/* Header */}
          <View className="mb-4 flex-row items-center justify-between border-b border-slate-100 px-5 pb-3 pt-5">
            <View className="flex-row items-center gap-2">
              <View className="h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50">
                <Feather name="package" size={18} color="#2563EB" />
              </View>
              <Text className="text-lg font-bold text-slate-900">
                {isEditMode ? 'Sửa gói dịch vụ' : 'Thêm gói dịch vụ'}
              </Text>
            </View>
            <TouchableOpacity
              className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerClassName="gap-3.5 px-5 pb-6"
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            <View>
              <Text className="mb-1.5 text-xs font-bold text-slate-700">
                Tên gói dịch vụ <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                testID="servicePackageNameInput"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
                placeholder="VD: Gói sản xuất video trọn gói"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View>
              <Text className="mb-1.5 text-xs font-bold text-slate-700">Mô tả</Text>
              <TextInput
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
                placeholder="Mô tả ngắn về gói dịch vụ"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* Bộ chọn dịch vụ trong gói */}
            <View className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <View className="mb-2.5 flex-row items-center justify-between">
                <Text className="text-xs font-bold text-slate-700">Dịch vụ trong gói</Text>
                <Text className="text-xs font-bold text-orange-600">
                  {formatVND(packagePreviewPrice)}
                </Text>
              </View>

              {rows.map((row, index) => {
                const selectedService = serviceById.get(row.serviceId);
                const isPickerOpen = openPickerKey === row.key;

                return (
                  <View key={row.key} className="mb-2.5 rounded-xl border border-slate-200 bg-white p-3">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="text-[10px] font-bold uppercase text-slate-400">
                        Dịch vụ #{index + 1}
                      </Text>
                      <TouchableOpacity
                        className="h-9 w-9 items-center justify-center rounded-lg bg-red-50"
                        onPress={() => handleRemoveRow(row.key)}
                        accessibilityRole="button"
                        accessibilityLabel="Xóa dòng dịch vụ"
                      >
                        <Feather name="trash-2" size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      className={`mt-2 min-h-[48px] flex-row items-center justify-between rounded-xl border px-3 ${
                        selectedService ? 'border-slate-200 bg-slate-50' : 'border-orange-300 bg-orange-50'
                      }`}
                      onPress={() => {
                        const nextKey = isPickerOpen ? null : row.key;
                        setOpenPickerKey(nextKey);
                        setServiceSearch('');
                      }}
                      activeOpacity={0.8}
                    >
                      <View className="flex-1 pr-2">
                        <Text
                          className={`text-sm ${
                            selectedService ? 'font-semibold text-slate-800' : 'italic text-slate-400'
                          }`}
                          numberOfLines={1}
                        >
                          {selectedService?.name || 'Chọn dịch vụ'}
                        </Text>
                        {selectedService ? (
                          <Text className="text-[11px] text-slate-400">
                            {selectedService.code ? `#${selectedService.code} • ` : ''}
                            {formatVND(selectedService.costPrice ?? 0)}
                          </Text>
                        ) : null}
                      </View>
                      <Feather
                        name={isPickerOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="#64748B"
                      />
                    </TouchableOpacity>

                    {isPickerOpen ? (
                      <View className="mt-2 rounded-xl border border-slate-200 bg-white p-2.5">
                        <View className="mb-2 h-[44px] flex-row items-center gap-2 rounded-xl bg-slate-100 px-3">
                          <Feather name="search" size={16} color="#94A3B8" />
                          <TextInput
                            className="flex-1 text-sm text-slate-900"
                            placeholder="Tìm theo tên hoặc mã dịch vụ..."
                            placeholderTextColor="#94A3B8"
                            value={serviceSearch}
                            onChangeText={setServiceSearch}
                          />
                        </View>

                        {isLoadingServices ? (
                          <View className="items-center py-4">
                            <ActivityIndicator size="small" color={BrandColors.primary} />
                          </View>
                        ) : filteredServices(row.key).length === 0 ? (
                          <Text className="py-3 text-center text-[11px] italic text-slate-400">
                            Không có dịch vụ nào phù hợp.
                          </Text>
                        ) : (
                          <ScrollView
                            className="max-h-[200px]"
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled={true}
                            showsVerticalScrollIndicator={false}
                          >
                            {filteredServices(row.key)
                              .slice(0, 40)
                              .map((service) => (
                                <TouchableOpacity
                                  key={service.id}
                                  className="min-h-[48px] flex-row items-center justify-between border-b border-slate-100 px-1"
                                  onPress={() => handleSelectService(row.key, service.id)}
                                  activeOpacity={0.75}
                                >
                                  <View className="flex-1 pr-2">
                                    <Text
                                      className="text-xs font-semibold text-slate-800"
                                      numberOfLines={1}
                                    >
                                      {service.name}
                                    </Text>
                                    <Text className="text-[11px] text-slate-400">
                                      {service.code ? `#${service.code} • ` : ''}
                                      {formatVND(service.costPrice ?? 0)}
                                    </Text>
                                  </View>
                                  <Feather name="check-circle" size={17} color="#F38820" />
                                </TouchableOpacity>
                              ))}
                          </ScrollView>
                        )}
                      </View>
                    ) : null}

                    <View className="mt-2.5 flex-row items-center justify-between gap-2">
                      <View className="flex-1">
                        <Text className="mb-1 text-[10px] font-bold uppercase text-slate-400">
                          Số lượng mặc định
                        </Text>
                        <TextInput
                          className="h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900"
                          keyboardType="numeric"
                          value={row.quantityText}
                          onChangeText={(text) => handleToggleQuantityInput(row.key, text)}
                        />
                      </View>
                      <View className="items-end">
                        <Text className="mb-1 text-[10px] font-bold uppercase text-slate-400">
                          Thành tiền
                        </Text>
                        <Text className="text-sm font-bold text-slate-700">
                          {formatVND(
                            Number(selectedService?.costPrice || 0) *
                              toNumberOrOne(row.quantityText),
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity
                className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-primary bg-white"
                onPress={handleAddRow}
                activeOpacity={0.8}
              >
                <Feather name="plus" size={16} color="#F38820" />
                <Text className="text-sm font-bold text-primary">Thêm dòng dịch vụ</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer */}
          <View className="flex-row gap-3 border-t border-slate-100 px-5 py-3.5">
            <TouchableOpacity
              className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-slate-100 py-3.5"
              onPress={onClose}
            >
              <Text className="text-sm font-bold text-slate-600">Hủy bỏ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="submitServicePackageButton"
              className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-primary py-3.5"
              onPress={submit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-sm font-bold text-white">
                  {isEditMode ? 'Lưu thay đổi' : 'Lưu gói dịch vụ'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
