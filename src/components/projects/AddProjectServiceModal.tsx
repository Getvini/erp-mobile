import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useServicesQuery } from '@/hooks/queries/useServices';
import { useServicePackagesQuery } from '@/hooks/queries/useServicePackages';
import { useCreateProjectServiceAddendumMutation } from '@/hooks/queries/useProjects';
import type { ProjectDetailItem } from '@/services/projectService';
import type { ServiceItem } from '@/services/catalogService';
import type { ServicePackage } from '@/services/servicePackageService';
import { formatNumber, formatVND } from '@/utils/formatters';
import {
  createPackageDrafts,
  createServiceDraft,
  getAddServiceBlockReason,
  getDraftTotals,
  getPackageDraftPrice,
  ProjectServiceDraft,
  toProjectServiceItems,
  updateDraftPackagePrice,
  updatePackageQuantity,
  validateProjectServiceDrafts,
} from '@/utils/projectServiceAddendum';
import ProjectServiceDraftCard, {
  ProjectPackageDraftCard,
} from '@/components/projects/ProjectServiceDraftCard';
import { SelectPackageModal, SelectServiceModal } from '@/components/quotations';

// A request identifier, kept for the lifetime of this form, including retries.
const createRequestKey = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 3) | 8).toString(16);
  });

type DisplayRow =
  | {
      type: 'package';
      key: string;
      packageKey: string;
      packageName: string;
      packageQuantity: string;
      items: ProjectServiceDraft[];
    }
  | {
      type: 'standalone';
      key: string;
      item: ProjectServiceDraft;
    };

export default function AddProjectServiceModal({
  project,
  role,
  onClose,
}: {
  project: ProjectDetailItem;
  role?: string;
  onClose: () => void;
}) {
  const defaultName = `${project.name || 'Dự án'} - Phụ lục bổ sung dịch vụ`;
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ProjectServiceDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isFinancialExpanded, setIsFinancialExpanded] = useState(true);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);

  const submittingRef = useRef(false);
  const [requestKey] = useState(createRequestKey);

  const services = useServicesQuery();
  const packages = useServicePackagesQuery();
  const mutation = useCreateProjectServiceAddendumMutation();

  const blockReason = getAddServiceBlockReason(
    role,
    project.status,
    Boolean((project as ProjectDetailItem & { isOnHold?: boolean }).isOnHold)
  );

  const locked = submitting || Boolean(blockReason);
  const loading = services.isPending || packages.isPending;
  const loadError = services.isError || packages.isError;
  const totals = useMemo(() => getDraftTotals(items), [items]);
  const dirty = items.length > 0 || name !== defaultName || description !== '';

  const close = () => {
    if (submittingRef.current) return;
    if (!dirty) {
      onClose();
      return;
    }
    Alert.alert('Bỏ thay đổi?', 'Dữ liệu phụ lục dịch vụ chưa được lưu.', [
      { text: 'Tiếp tục nhập', style: 'cancel' },
      { text: 'Bỏ thay đổi', style: 'destructive', onPress: onClose },
    ]);
  };

  const updateItem = useCallback(
    (key: string, patch: Partial<ProjectServiceDraft>) => {
      if (locked) return;
      setItems((previous) =>
        previous.map((item) => {
          if (item.key !== key) return item;
          if (
            patch.budget !== undefined &&
            services.data?.find((entry) => String(entry.id) === String(item.service.id))
              ?.isBudget !== true
          ) {
            return item;
          }
          return { ...item, ...patch };
        })
      );
    },
    [locked, services.data]
  );

  const handleSelectService = (service: ServiceItem) => {
    if (locked || !service) return;
    setItems((previous) =>
      previous.some((item) => !item.packageKey && String(item.service.id) === String(service.id))
        ? previous
        : [...previous, createServiceDraft(service)]
    );
    setShowServiceModal(false);
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  const handleSelectPackage = (template: ServicePackage) => {
    if (locked || !template) return;
    if (items.some((item) => item.packageName === template.name)) {
      Alert.alert('Thông báo', `Gói "${template.name}" đã có trong phụ lục`);
      return;
    }
    const rows = createPackageDrafts(
      template,
      services.data || [],
      `new-package-${template.id}-${Date.now()}`
    );
    if (!rows.length) {
      Alert.alert('Thông báo', 'Gói dịch vụ chưa có hạng mục con');
      return;
    }
    setItems((previous) => [...previous, ...rows]);
    setShowPackageModal(false);
    setError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  const selectedServiceIds = useMemo(() => {
    return new Set(
      items.filter((item) => !item.packageKey).map((item) => String(item.service.id))
    );
  }, [items]);

  // Group items by package or standalone
  const displayRows = useMemo<DisplayRow[]>(() => {
    const pkgMap = new Map<
      string,
      {
        packageKey: string;
        packageName: string;
        packageQuantity: string;
        items: ProjectServiceDraft[];
      }
    >();
    const standalones: ProjectServiceDraft[] = [];

    for (const item of items) {
      if (item.packageKey) {
        if (!pkgMap.has(item.packageKey)) {
          pkgMap.set(item.packageKey, {
            packageKey: item.packageKey,
            packageName: item.packageName || 'Gói dịch vụ',
            packageQuantity: item.packageQuantity || '1',
            items: [],
          });
        }
        pkgMap.get(item.packageKey)!.items.push(item);
      } else {
        standalones.push(item);
      }
    }

    const rows: DisplayRow[] = [];
    for (const pkg of pkgMap.values()) {
      rows.push({
        type: 'package',
        key: `pkg-${pkg.packageKey}`,
        ...pkg,
      });
    }

    for (const item of standalones) {
      rows.push({
        type: 'standalone',
        key: item.key,
        item,
      });
    }

    return rows;
  }, [items]);

  const submit = async () => {
    if (submittingRef.current) return;
    const validation =
      blockReason ||
      validateProjectServiceDrafts(
        items.map((item) => ({
          ...item,
          service:
            services.data?.find((entry) => String(entry.id) === String(item.service.id)) ||
            item.service,
        }))
      );
    if (validation) {
      setError(validation);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      await mutation.mutateAsync({
        projectId: project.id,
        idempotencyKey: requestKey,
        payload: { name, description, items: toProjectServiceItems(items) },
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Alert.alert('Thành công', 'Đã tạo phụ lục bổ sung dịch vụ');
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Có lỗi xảy ra khi tạo phụ lục bổ sung dịch vụ'
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const renderRow = useCallback(
    ({ item }: { item: DisplayRow }) => {
      if (item.type === 'package') {
        const packagePrice = getPackageDraftPrice(items, item.packageKey);
        return (
          <ProjectPackageDraftCard
            packageKey={item.packageKey}
            packageName={item.packageName}
            packageQuantity={item.packageQuantity}
            packagePrice={packagePrice}
            items={item.items}
            disabled={locked}
            onUpdateQuantity={(qty) =>
              setItems((prev) => updatePackageQuantity(prev, item.packageKey, qty))
            }
            onUpdatePackagePrice={(price) =>
              setItems((prev) => updateDraftPackagePrice(prev, item.packageKey, price))
            }
            onUpdateChildItem={updateItem}
            onRemovePackage={() =>
              setItems((prev) => prev.filter((entry) => entry.packageKey !== item.packageKey))
            }
          />
        );
      }

      return (
        <ProjectServiceDraftCard
          item={{
            ...item.item,
            service:
              services.data?.find((entry) => String(entry.id) === String(item.item.service.id)) ||
              item.item.service,
          }}
          disabled={locked}
          onChange={(patch) => updateItem(item.item.key, patch)}
          onRemove={() => setItems((prev) => prev.filter((entry) => entry.key !== item.item.key))}
        />
      );
    },
    [items, locked, services.data, updateItem]
  );

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView className="flex-1 bg-slate-50">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-2xs">
            <View className="flex-1 mr-3">
              <Text className="text-base font-bold text-slate-900">Thêm dịch vụ vào dự án</Text>
              <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>
                {project.name || 'Dự án'}
              </Text>
            </View>
            <TouchableOpacity
              disabled={submitting}
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"
              activeOpacity={0.7}
            >
              <Feather name="x" size={20} color="#475569" />
            </TouchableOpacity>
          </View>

          {/* Block Reason Alert (if blocked) */}
          {blockReason && (
            <View className="flex-row items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3">
              <Feather name="alert-triangle" size={16} color="#D97706" />
              <Text className="flex-1 text-xs font-semibold text-amber-800">{blockReason}</Text>
            </View>
          )}

          {/* Loading / Error States */}
          {loading ? (
            <View className="flex-1 items-center justify-center gap-3 p-6">
              <ActivityIndicator size="large" color="#F38820" />
              <Text className="text-sm text-slate-500">Đang tải danh mục dịch vụ...</Text>
            </View>
          ) : loadError ? (
            <View className="flex-1 items-center justify-center gap-3 p-6">
              <Feather name="alert-circle" size={32} color="#DC2626" />
              <Text className="text-center text-sm text-slate-700">
                Có lỗi xảy ra khi tải danh sách dịch vụ hoặc gói mẫu.
              </Text>
              <TouchableOpacity
                className="mt-2 rounded-xl bg-[#F38820] px-5 py-2.5 active:opacity-80"
                onPress={() => {
                  void services.refetch();
                  void packages.refetch();
                }}
              >
                <Text className="font-bold text-white">Thử lại</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={displayRows}
              keyExtractor={(row) => row.key}
              renderItem={renderRow}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
              ListHeaderComponent={
                <View className="mb-4 gap-3">
                  {/* Basic Form Card */}
                  <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                    <View className="flex-row items-center gap-2 mb-3">
                      <Feather name="file-text" size={15} color="#F38820" />
                      <Text className="text-xs font-bold text-slate-700 tracking-wider uppercase">
                        Thông tin phụ lục bổ sung
                      </Text>
                    </View>

                    <View className="gap-1 mb-3">
                      <Text className="text-xs font-semibold text-slate-600">
                        Tên phụ lục <Text className="text-rose-500">*</Text>
                      </Text>
                      <TextInput
                        accessibilityLabel="Tên phụ lục"
                        value={name}
                        onChangeText={setName}
                        editable={!locked}
                        placeholder="Nhập tên phụ lục bổ sung..."
                        placeholderTextColor="#94A3B8"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900"
                      />
                    </View>

                    <View className="gap-1">
                      <Text className="text-xs font-semibold text-slate-600">Mô tả / Ghi chú</Text>
                      <TextInput
                        accessibilityLabel="Mô tả"
                        value={description}
                        onChangeText={setDescription}
                        editable={!locked}
                        multiline
                        textAlignVertical="top"
                        placeholder="Ghi chú thêm về lý do bổ sung, điều khoản nghiệm thu..."
                        placeholderTextColor="#94A3B8"
                        className="min-h-[72px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900"
                      />
                    </View>
                  </View>

                  {/* Quick Action Buttons */}
                  <View className="flex-row gap-2.5">
                    <TouchableOpacity
                      disabled={locked}
                      onPress={() => setShowServiceModal(true)}
                      activeOpacity={0.7}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/80 py-3 shadow-2xs"
                    >
                      <Feather name="plus-circle" size={15} color="#2563EB" />
                      <Text className="text-xs font-bold text-blue-700">+ Thêm dịch vụ lẻ</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      disabled={locked}
                      onPress={() => setShowPackageModal(true)}
                      activeOpacity={0.7}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-[#FDCB9E] bg-[#FFF7ED] py-3 shadow-2xs"
                    >
                      <Feather name="package" size={15} color="#D97010" />
                      <Text className="text-xs font-bold text-[#D97010]">+ Thêm gói mẫu</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              }
              ListEmptyComponent={
                <View className="items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 my-2">
                  <View className="h-16 w-16 items-center justify-center rounded-full bg-[#FFF7ED] border border-[#FDCB9E] mb-3">
                    <Feather name="layers" size={28} color="#F38820" />
                  </View>
                  <Text className="text-base font-bold text-slate-800 text-center">
                    Chưa có dịch vụ nào
                  </Text>
                  <Text className="mt-1 text-xs text-slate-500 text-center px-4 leading-4">
                    Chọn dịch vụ lẻ hoặc gói dịch vụ mẫu để thêm vào danh sách bổ sung cho dự án.
                  </Text>
                  <View className="mt-4 flex-row gap-2.5">
                    <TouchableOpacity
                      disabled={locked}
                      onPress={() => setShowServiceModal(true)}
                      className="flex-row items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 active:opacity-70"
                    >
                      <Feather name="plus" size={14} color="#2563EB" />
                      <Text className="text-xs font-bold text-blue-700">Dịch vụ lẻ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={locked}
                      onPress={() => setShowPackageModal(true)}
                      className="flex-row items-center gap-1.5 rounded-xl border border-[#FDCB9E] bg-[#FFF7ED] px-3.5 py-2 active:opacity-70"
                    >
                      <Feather name="package" size={14} color="#D97010" />
                      <Text className="text-xs font-bold text-[#D97010]">Gói mẫu</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              }
            />
          )}

          {/* Sticky Bottom Financial Summary Bar */}
          <View className="border-t border-slate-200 bg-white p-4 shadow-lg">
            {/* Collapsible toggle for financial breakdown */}
            {items.length > 0 && (
              <TouchableOpacity
                onPress={() => setIsFinancialExpanded((prev) => !prev)}
                className="flex-row items-center justify-between pb-2"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-1.5">
                  <Feather name="pie-chart" size={14} color="#64748B" />
                  <Text className="text-xs font-bold text-slate-600">
                    Chi tiết tài chính ({items.length} mục)
                  </Text>
                </View>
                <Feather
                  name={isFinancialExpanded ? 'chevron-down' : 'chevron-up'}
                  size={16}
                  color="#64748B"
                />
              </TouchableOpacity>
            )}

            {/* Financial Grid (Collapsible) */}
            {items.length > 0 && isFinancialExpanded && (
              <View className="mb-2.5 gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-slate-500">
                    Tổng chi phí (Vốn):{' '}
                    <Text className="font-semibold text-slate-700">
                      {formatVND(totals.cost.toFixed())}
                    </Text>
                  </Text>
                  <Text className="text-xs text-slate-500">
                    Ngân sách:{' '}
                    <Text className="font-semibold text-slate-700">
                      {formatVND(totals.budget.toFixed())}
                    </Text>
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-slate-500">
                    Tổng giá bán:{' '}
                    <Text className="font-semibold text-slate-700">
                      {formatVND(totals.revenue.toFixed())}
                    </Text>
                  </Text>
                  <Text className="text-xs text-slate-500">
                    Lợi nhuận:{' '}
                    <Text
                      className={`font-semibold ${totals.profit.lt(0) ? 'text-rose-600' : 'text-emerald-600'}`}
                    >
                      {formatVND(totals.profit.toFixed())} ({formatNumber(totals.margin.toDecimalPlaces(1).toFixed())}%)
                    </Text>
                  </Text>
                </View>

                <View className="flex-row items-center justify-between border-t border-slate-200/50 pt-1">
                  <Text className="text-xs text-slate-500">Thuế VAT (8%):</Text>
                  <Text className="text-xs font-semibold text-slate-700">
                    {formatVND(totals.vat.toFixed())}
                  </Text>
                </View>
              </View>
            )}

            {/* Grand Total Row */}
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Tổng cộng (có VAT 8%):
              </Text>
              <Text className="text-lg font-extrabold text-[#F38820]">
                {formatVND(totals.totalWithVat.toFixed())}
              </Text>
            </View>

            {/* Error Message Alert */}
            {error && (
              <View className="mb-2.5 flex-row items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2">
                <Feather name="alert-circle" size={15} color="#DC2626" />
                <Text accessibilityRole="alert" className="flex-1 text-xs font-medium text-rose-700">
                  {error}
                </Text>
              </View>
            )}

            {/* Primary Action Button */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Tạo phụ lục bổ sung dịch vụ"
              disabled={locked || !items.length || loading || loadError}
              onPress={submit}
              className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl bg-[#F38820] px-4 shadow-sm active:opacity-90 ${
                locked || !items.length || loading || loadError ? 'opacity-50' : ''
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Feather name="check-circle" size={18} color="#fff" />
              )}
              <Text className="font-bold text-white text-sm">
                {submitting ? 'Đang tạo phụ lục...' : 'Tạo phụ lục bổ sung dịch vụ'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Select Service BottomSheet Modal */}
      <SelectServiceModal
        visible={showServiceModal}
        onClose={() => setShowServiceModal(false)}
        onSelect={handleSelectService}
        availableServices={services.data || []}
        selectedServiceIds={selectedServiceIds}
      />

      {/* Select Package BottomSheet Modal */}
      <SelectPackageModal
        visible={showPackageModal}
        onClose={() => setShowPackageModal(false)}
        onSelect={handleSelectPackage}
        packageTemplates={packages.data || []}
      />
    </Modal>
  );
}