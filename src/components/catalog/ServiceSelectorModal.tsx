import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useServicesQuery } from '@/hooks/queries/useServices';
import { useServicePackagesQuery } from '@/hooks/queries/useServicePackages';
import { ServiceItem } from '@/services/catalogService';
import { ServicePackage } from '@/services/servicePackageService';
import { BrandColors } from '@/constants/colors';
import {
  SelectedCatalogItem,
  computePackagePrice,
  expandPackageTemplate,
  getRecommendedSellingPrice,
  toStandaloneCatalogItem,
} from '@/utils/catalogPricing';
import { formatVND } from '@/utils/formatters';

/**
 * Bottom sheet chọn nhanh dịch vụ / gói dịch vụ niêm yết.
 *
 * ⚠️ Component này KHÔNG tồn tại ở Web (chỉ có trong docs kế hoạch P2) — tự thiết kế
 * theo chuẩn Getvini. Dùng cho luồng lập Báo giá / Cơ hội.
 */

type SelectorTab = 'SERVICE' | 'PACKAGE';

interface ServiceSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (items: SelectedCatalogItem[]) => void;
  /** Mặc định `true` — cho phép chọn nhiều dịch vụ lẻ. */
  multiple?: boolean;
  /** Dịch vụ đã có sẵn (VD: đã nằm trong báo giá) — sẽ bị ẩn khỏi danh sách chọn. */
  excludeServiceIds?: string[];
  title?: string;
}

const TABS: { key: SelectorTab; label: string }[] = [
  { key: 'SERVICE', label: 'Dịch vụ lẻ' },
  { key: 'PACKAGE', label: 'Gói dịch vụ' },
];

export default function ServiceSelectorModal({
  visible,
  onClose,
  onConfirm,
  multiple = true,
  excludeServiceIds,
  title = 'Chọn dịch vụ niêm yết',
}: ServiceSelectorModalProps) {
  // ⚠️ Component KHÔNG tự reset state bằng useEffect (tránh cascading render).
  // Màn hình cha truyền `key` mới mỗi lần mở sheet ⇒ mỗi lần mở là instance mới.
  const [activeTab, setActiveTab] = useState<SelectorTab>('SERVICE');
  const [search, setSearch] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  const {
    data: services = [],
    isLoading: isLoadingServices,
    isError: isServicesError,
    error: servicesError,
    refetch: refetchServices,
  } = useServicesQuery();

  const {
    data: servicePackages = [],
    isLoading: isLoadingPackages,
    isError: isPackagesError,
    error: packagesError,
    refetch: refetchPackages,
  } = useServicePackagesQuery();

  const excludedIds = useMemo(
    () => new Set((excludeServiceIds ?? []).filter(Boolean)),
    [excludeServiceIds],
  );

  const selectableServices = useMemo(
    () => services.filter((service) => !excludedIds.has(service.id)),
    [excludedIds, services],
  );

  const filteredServices = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return selectableServices;
    return selectableServices.filter(
      (service) =>
        (service.name || '').toLowerCase().includes(keyword) ||
        (service.code || '').toLowerCase().includes(keyword),
    );
  }, [search, selectableServices]);

  const selectedPackage = useMemo<ServicePackage | null>(
    () => servicePackages.find((pkg) => pkg.id === selectedPackageId) ?? null,
    [selectedPackageId, servicePackages],
  );

  const packagePreviewItems = useMemo(
    () => (selectedPackage ? expandPackageTemplate(selectedPackage) : []),
    [selectedPackage],
  );

  // Tổng giá vốn dùng đúng công thức backend trên `items` gốc của gói.
  const packagesTotalCost = useMemo(
    () => computePackagePrice(selectedPackage?.items ?? []),
    [selectedPackage],
  );

  const handleToggleService = useCallback(
    (service: ServiceItem) => {
      setSelectedPackageId(null);
      setSelectedServiceIds((prev) => {
        if (prev.includes(service.id)) {
          return prev.filter((id) => id !== service.id);
        }
        return multiple ? [...prev, service.id] : [service.id];
      });
    },
    [multiple],
  );

  const handleSelectPackage = useCallback((servicePackage: ServicePackage) => {
    setSelectedPackageId((prev) => (prev === servicePackage.id ? null : servicePackage.id));
    setSelectedServiceIds([]);
  }, []);

  const handleConfirm = useCallback(() => {
    if (activeTab === 'PACKAGE') {
      if (!selectedPackage) {
        Alert.alert('Chưa chọn gói', 'Vui lòng chọn một gói dịch vụ mẫu để tiếp tục.');
        return;
      }
      const items = expandPackageTemplate(selectedPackage);
      if (items.length === 0) {
        Alert.alert('Gói rỗng', 'Gói dịch vụ này chưa có dịch vụ nào để thêm.');
        return;
      }
      onConfirm(items);
      onClose();
      return;
    }

    if (selectedServiceIds.length === 0) {
      Alert.alert('Chưa chọn dịch vụ', 'Vui lòng chọn ít nhất một dịch vụ để tiếp tục.');
      return;
    }

    const items = selectedServiceIds
      .map((serviceId) => selectableServices.find((service) => service.id === serviceId))
      .filter((service): service is ServiceItem => Boolean(service))
      .map((service) => toStandaloneCatalogItem(service));

    if (items.length === 0) return;
    onConfirm(items);
    onClose();
  }, [activeTab, onClose, onConfirm, selectableServices, selectedPackage, selectedServiceIds]);

  const hasSelection =
    activeTab === 'PACKAGE' ? Boolean(selectedPackage) : selectedServiceIds.length > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/55">
        <View className="max-h-[88%] rounded-t-3xl border-t border-slate-200 bg-white shadow-xl">
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-slate-100 px-5 pb-3 pt-5">
            <View className="flex-1 pr-3">
              <Text className="text-lg font-bold text-slate-900">{title}</Text>
              <Text className="mt-0.5 text-xs text-slate-500">
                {multiple
                  ? 'Có thể chọn nhiều dịch vụ hoặc 1 gói dịch vụ mẫu'
                  : 'Chọn 1 dịch vụ hoặc 1 gói dịch vụ mẫu'}
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

          {/* Tabs */}
          <View className="flex-row gap-2 px-5 pt-3">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  className={`min-h-[44px] flex-1 items-center justify-center rounded-xl border ${
                    isActive ? 'border-primary bg-primary' : 'border-slate-200 bg-slate-100'
                  }`}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    className={`text-sm ${
                      isActive ? 'font-bold text-white' : 'font-semibold text-slate-600'
                    }`}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            className="mt-3"
            contentContainerClassName="px-5 pb-5 gap-2.5"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'SERVICE' ? (
              <>
                <View className="mb-1 h-[48px] flex-row items-center gap-2 rounded-xl bg-slate-100 px-3">
                  <Feather name="search" size={18} color="#94A3B8" />
                  <TextInput
                    className="flex-1 text-sm text-slate-900"
                    placeholder="Tìm theo tên hoặc mã dịch vụ..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                  />
                  {search.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearch('')}>
                      <Feather name="x" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {isLoadingServices ? (
                  <View className="items-center py-10">
                    <ActivityIndicator color={BrandColors.primary} />
                    <Text className="mt-2 text-xs text-slate-500">Đang tải dịch vụ...</Text>
                  </View>
                ) : isServicesError ? (
                  <View className="items-center gap-2 py-10">
                    <Feather name="wifi-off" size={32} color="#EF4444" />
                    <Text className="text-sm font-bold text-slate-700">
                      Không tải được danh mục dịch vụ
                    </Text>
                    <Text className="text-center text-xs text-slate-500">
                      {servicesError instanceof Error ? servicesError.message : 'Vui lòng thử lại.'}
                    </Text>
                    <TouchableOpacity
                      className="mt-1 min-h-[48px] justify-center rounded-xl bg-primary px-5"
                      onPress={() => refetchServices()}
                    >
                      <Text className="text-sm font-bold text-white">Thử lại</Text>
                    </TouchableOpacity>
                  </View>
                ) : filteredServices.length === 0 ? (
                  <View className="items-center gap-2 py-10">
                    <Feather name="inbox" size={32} color="#CBD5E1" />
                    <Text className="text-sm font-bold text-slate-600">Không có dịch vụ phù hợp</Text>
                  </View>
                ) : (
                  filteredServices.map((service) => {
                    const isSelected = selectedServiceIds.includes(service.id);
                    return (
                      <TouchableOpacity
                        key={service.id}
                        className={`flex-row items-center gap-3 rounded-2xl border bg-white p-3.5 ${
                          isSelected ? 'border-primary bg-primary-light' : 'border-slate-200'
                        }`}
                        onPress={() => handleToggleService(service)}
                        activeOpacity={0.8}
                      >
                        <View
                          className={`h-6 w-6 items-center justify-center rounded-lg border-2 ${
                            isSelected ? 'border-primary bg-primary' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                        </View>

                        <View className="flex-1">
                          <View className="flex-row items-center gap-2">
                            <Text
                              className="flex-1 text-sm font-bold text-slate-900"
                              numberOfLines={1}
                            >
                              {service.name}
                            </Text>
                            {service.isAI ? (
                              <View className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5">
                                <Text className="text-[9px] font-bold text-violet-600">AI</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text className="mt-0.5 text-[11px] font-semibold text-slate-400">
                            {service.code ? `#${service.code}` : `#${service.id.slice(0, 8)}`}
                            {service.unit ? ` • ${service.unit}` : ''}
                          </Text>
                          <View className="mt-1.5 flex-row items-center gap-3">
                            <Text className="text-xs font-bold text-orange-600">
                              Vốn: {formatVND(service.costPrice ?? 0)}
                            </Text>
                            <Text className="text-xs font-semibold text-emerald-600">
                              Đề xuất: {formatVND(getRecommendedSellingPrice(service.costPrice))}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </>
            ) : (
              <>
                {isLoadingPackages ? (
                  <View className="items-center py-10">
                    <ActivityIndicator color={BrandColors.primary} />
                    <Text className="mt-2 text-xs text-slate-500">Đang tải gói dịch vụ...</Text>
                  </View>
                ) : isPackagesError ? (
                  <View className="items-center gap-2 py-10">
                    <Feather name="wifi-off" size={32} color="#EF4444" />
                    <Text className="text-sm font-bold text-slate-700">
                      Không tải được gói dịch vụ
                    </Text>
                    <Text className="text-center text-xs text-slate-500">
                      {packagesError instanceof Error ? packagesError.message : 'Vui lòng thử lại.'}
                    </Text>
                    <TouchableOpacity
                      className="mt-1 min-h-[48px] justify-center rounded-xl bg-primary px-5"
                      onPress={() => refetchPackages()}
                    >
                      <Text className="text-sm font-bold text-white">Thử lại</Text>
                    </TouchableOpacity>
                  </View>
                ) : servicePackages.length === 0 ? (
                  <View className="items-center gap-2 py-10">
                    <Feather name="package" size={32} color="#CBD5E1" />
                    <Text className="text-sm font-bold text-slate-600">
                      Chưa có gói dịch vụ mẫu nào
                    </Text>
                    <Text className="max-w-[260px] text-center text-xs text-slate-400">
                      Hãy tạo gói dịch vụ trong phân hệ Gói dịch vụ niêm yết trước.
                    </Text>
                  </View>
                ) : (
                  servicePackages.map((servicePackage) => {
                    const isSelected = selectedPackageId === servicePackage.id;
                    const previewItems = expandPackageTemplate(servicePackage);
                    const totalCost = computePackagePrice(servicePackage.items ?? []);

                    return (
                      <View
                        key={servicePackage.id}
                        className={`overflow-hidden rounded-2xl border bg-white ${
                          isSelected ? 'border-primary' : 'border-slate-200'
                        }`}
                      >
                        <TouchableOpacity
                          className={`flex-row items-start gap-3 p-3.5 ${
                            isSelected ? 'bg-primary-light' : ''
                          }`}
                          onPress={() => handleSelectPackage(servicePackage)}
                          activeOpacity={0.8}
                        >
                          <View
                            className={`mt-0.5 h-6 w-6 items-center justify-center rounded-full border-2 ${
                              isSelected ? 'border-primary bg-primary' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected ? (
                              <Feather name="check" size={12} color="#FFFFFF" />
                            ) : null}
                          </View>

                          <View className="flex-1">
                            <Text className="text-sm font-bold text-slate-900" numberOfLines={2}>
                              {servicePackage.name}
                            </Text>
                            {servicePackage.description ? (
                              <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={2}>
                                {servicePackage.description}
                              </Text>
                            ) : null}
                            <View className="mt-1.5 flex-row items-center gap-3">
                              <Text className="text-xs font-bold text-orange-600">
                                Tổng vốn: {formatVND(totalCost)}
                              </Text>
                              <Text className="text-[11px] font-semibold text-slate-500">
                                {previewItems.length} dịch vụ
                              </Text>
                            </View>
                          </View>

                          <Feather
                            name={isSelected ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color="#94A3B8"
                          />
                        </TouchableOpacity>

                        {isSelected ? (
                          <View className="border-t border-slate-100 bg-slate-50 p-3.5">
                            <Text className="mb-2 text-[10px] font-bold uppercase text-slate-400">
                              Dịch vụ con trong gói
                            </Text>

                            {previewItems.length === 0 ? (
                              <Text className="text-[11px] italic text-slate-400">
                                Gói này chưa có dịch vụ con.
                              </Text>
                            ) : (
                              previewItems.map((item, index) => {
                                const isExcluded = excludedIds.has(item.serviceId);
                                return (
                                  <View
                                    key={`${item.serviceId}-${index}`}
                                    className="flex-row items-center justify-between border-b border-slate-100 py-2 last:border-b-0"
                                  >
                                    <View className="flex-1 pr-2">
                                      <Text
                                        className={`text-xs font-semibold ${
                                          isExcluded ? 'text-slate-400' : 'text-slate-800'
                                        }`}
                                        numberOfLines={1}
                                      >
                                        {item.serviceName || 'Dịch vụ'}
                                        {isExcluded ? ' (đã có)' : ''}
                                      </Text>
                                      <Text className="text-[11px] text-slate-400">
                                        SL: {String(item.quantity ?? 1)} •{' '}
                                        {formatVND(item.costPrice)}
                                      </Text>
                                    </View>
                                    <Text className="text-xs font-bold text-slate-700">
                                      {formatVND(
                                        Number(item.costPrice || 0) * Number(item.quantity || 0),
                                      )}
                                    </Text>
                                  </View>
                                );
                              })
                            )}

                            <View className="mt-2 flex-row items-center justify-between border-t border-slate-200 pt-2">
                              <Text className="text-xs font-bold text-slate-600">
                                Tổng giá vốn gói
                              </Text>
                              <Text className="text-sm font-extrabold text-orange-600">
                                {formatVND(packagesTotalCost)}
                              </Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </>
            )}
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
              testID="confirmServiceSelectionButton"
              className={`min-h-[48px] flex-1 items-center justify-center rounded-xl py-3.5 ${
                hasSelection ? 'bg-primary' : 'bg-slate-300'
              }`}
              onPress={handleConfirm}
              disabled={!hasSelection}
              activeOpacity={0.85}
            >
              <Text className="text-sm font-bold text-white">
                {activeTab === 'PACKAGE' && selectedPackage
                  ? `Thêm gói (${packagePreviewItems.length})`
                  : `Xác nhận (${selectedServiceIds.length})`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
