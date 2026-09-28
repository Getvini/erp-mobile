import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptic from 'expo-haptics';
import { useUpsertVendorJobMutation } from '@/hooks/queries/useVendors';
import { useJobsQuery } from '@/hooks/queries/useJobs';
import { VendorJobItem } from '@/services/vendorService';
import { BrandColors } from '@/constants/colors';
import { formatNumberInput, formatVND, parseNumberInput } from '@/utils/formatters';

/** Hạng mục (Job) mẫu dùng cho bộ chọn — module Jobs thuộc subagent khác. */
export interface JobListItem {
  id: string;
  name?: string | null;
  code?: string | null;
  nickname?: string | null;
  unit?: string | null;
  costPrice?: number | string | null;
}

export interface VendorJobModalProps {
  visible: boolean;
  onClose: () => void;
  vendorId: string;
  vendorName?: string;
  /** Các jobId đã gán cho nhà cung cấp ⇒ loại khỏi danh sách chọn. */
  assignedJobIds?: string[];
  /** Có giá trị ⇒ chế độ sửa: khoá hạng mục, chỉ đổi đơn giá / ghi chú. */
  editingJob?: VendorJobItem | null;
  onSuccess?: () => void;
}

interface VendorJobSheetProps {
  onClose: () => void;
  vendorId: string;
  vendorName?: string;
  assignedJobIds?: string[];
  editingJob?: VendorJobItem | null;
  onSuccess?: () => void;
}

const toJobListItem = (job?: VendorJobItem | null): JobListItem | null => {
  if (!job?.job?.id) return null;
  return {
    id: job.job.id,
    name: job.job.name,
    code: job.job.code,
    nickname: job.job.nickname,
    unit: job.job.unit,
    costPrice: job.job.costPrice,
  };
};

/**
 * Bottom Sheet gán hạng mục cho nhà cung cấp:
 * (a) chọn hạng mục có sẵn (tìm kiếm, loại hạng mục đã gán)
 * (b) nhập đơn giá (mask dấu `.`) + ghi chú
 */
function VendorJobSheet({
  onClose,
  vendorId,
  vendorName,
  assignedJobIds,
  editingJob,
  onSuccess,
}: VendorJobSheetProps) {
  const isEditing = Boolean(editingJob?.id);
  const upsertVendorJobMutation = useUpsertVendorJobMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState<JobListItem | null>(() => toJobListItem(editingJob));
  const [priceInput, setPriceInput] = useState(() =>
    editingJob ? formatNumberInput(editingJob.price ?? 0) : '',
  );
  const [noteInput, setNoteInput] = useState(() => editingJob?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [dragY] = useState(() => new Animated.Value(0));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_evt, gesture) => {
          if (gesture.dy > 0) dragY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dy > 120) {
            Animated.timing(dragY, {
              toValue: 640,
              duration: 180,
              useNativeDriver: true,
            }).start(() => onClose());
            return;
          }
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [dragY, onClose],
  );

  const jobsQuery = useJobsQuery({}, { enabled: !isEditing });

  const availableJobs = useMemo(() => {
    const jobs = jobsQuery.data ?? [];
    const assigned = new Set(assignedJobIds ?? []);
    const keyword = searchQuery.trim().toLowerCase();

    return jobs
      .filter((job) => job?.id && !assigned.has(job.id))
      .filter((job) => {
        if (!keyword) return true;
        return (
          (job.name ?? '').toLowerCase().includes(keyword) ||
          (job.code ?? '').toLowerCase().includes(keyword) ||
          (job.nickname ?? '').toLowerCase().includes(keyword)
        );
      });
  }, [assignedJobIds, jobsQuery.data, searchQuery]);

  const selectedPrice = parseNumberInput(priceInput);
  const isSubmitting = upsertVendorJobMutation.isPending;

  const handleSubmit = async () => {
    if (!selectedJob?.id) {
      setError('Vui lòng chọn hạng mục cần gán.');
      return;
    }
    if (!priceInput.trim()) {
      setError('Vui lòng nhập đơn giá cho nhà cung cấp.');
      return;
    }
    if (selectedPrice <= 0) {
      setError('Đơn giá phải lớn hơn 0.');
      return;
    }

    setError(null);
    try {
      await Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Medium);
      await upsertVendorJobMutation.mutateAsync({
        id: vendorId,
        jobId: selectedJob.id,
        price: selectedPrice,
        note: noteInput.trim(),
      });
      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
      Alert.alert(
        'Thành công',
        isEditing ? 'Đã cập nhật phân công hạng mục.' : 'Đã gán hạng mục cho nhà cung cấp.',
      );
      onSuccess?.();
      onClose();
    } catch (err: any) {
      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert('Lỗi', err?.message || 'Không thể lưu phân công hạng mục.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 justify-end bg-slate-900/50"
    >
      <Animated.View
        style={{ transform: [{ translateY: dragY }] }}
        className="max-h-[90%] rounded-t-[24px] border-t border-slate-200 bg-white"
      >
        <View {...panResponder.panHandlers} className="items-center pt-3">
          <View className="h-1.5 w-12 rounded-full bg-slate-300" />
        </View>

        <View className="flex-row items-center justify-between border-b border-slate-100 px-5 pb-3 pt-2">
          <View className="flex-1">
            <Text className="text-lg font-bold text-slate-900">
              {isEditing ? 'Sửa hạng mục phụ trách' : 'Gán hạng mục phụ trách'}
            </Text>
            {vendorName ? (
              <Text className="text-xs text-slate-500" numberOfLines={1}>
                {vendorName}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Đóng biểu mẫu gán hạng mục"
          >
            <Feather name="x" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          contentContainerClassName="px-5 pt-4 pb-6 gap-4"
        >
          {/* (a) Chọn hạng mục có sẵn */}
          <View>
            <Text className="mb-1.5 text-xs font-bold text-slate-700">Hạng mục phụ trách</Text>

            {isEditing && selectedJob ? (
              <View className="rounded-xl border border-orange-100 bg-orange-50 p-3">
                <Text className="text-sm font-bold text-slate-800">
                  {selectedJob.code ? `${selectedJob.code} · ` : ''}
                  {selectedJob.name || 'Hạng mục'}
                </Text>
                <Text className="mt-0.5 text-[11px] text-slate-500">
                  Hạng mục đã gán — chỉ có thể sửa đơn giá và ghi chú.
                </Text>
              </View>
            ) : (
              <>
                <View className="flex-row items-center rounded-xl bg-slate-100 px-3">
                  <Feather name="search" size={16} color="#94A3B8" />
                  <TextInput
                    testID="vendorJobSearchInput"
                    className="ml-2 h-[48px] flex-1 text-sm text-slate-900"
                    placeholder="Tìm theo mã hoặc tên hạng mục..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10}>
                      <Feather name="x" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {jobsQuery.isLoading ? (
                  <View className="items-center py-6">
                    <ActivityIndicator color={BrandColors.primary} />
                    <Text className="mt-2 text-xs text-slate-400">Đang tải danh sách hạng mục...</Text>
                  </View>
                ) : jobsQuery.isError ? (
                  <View className="items-center py-6">
                    <Feather name="wifi-off" size={26} color={BrandColors.error} />
                    <Text className="mt-2 text-xs font-semibold text-slate-600">
                      Không tải được danh sách hạng mục.
                    </Text>
                    <TouchableOpacity
                      className="mt-2 min-h-[44px] justify-center rounded-xl bg-primary px-4"
                      onPress={() => jobsQuery.refetch()}
                    >
                      <Text className="text-xs font-bold text-white">Thử lại</Text>
                    </TouchableOpacity>
                  </View>
                ) : availableJobs.length === 0 ? (
                  <View className="items-center py-6">
                    <Feather name="inbox" size={26} color="#CBD5E1" />
                    <Text className="mt-2 text-center text-xs text-slate-400">
                      {jobsQuery.data && jobsQuery.data.length > 0
                        ? 'Tất cả hạng mục đã được gán cho nhà cung cấp này.'
                        : 'Hệ thống chưa có hạng mục nào.'}
                    </Text>
                  </View>
                ) : (
                  <View className="mt-2 rounded-xl border border-slate-200 bg-white p-1.5">
                    <ScrollView nestedScrollEnabled className="max-h-[220px]">
                      {availableJobs.map((job) => {
                        const isActive = selectedJob?.id === job.id;
                        return (
                          <TouchableOpacity
                            key={job.id}
                            testID={`vendorJobOption-${job.id}`}
                            className={`min-h-[48px] justify-center rounded-lg px-3 ${
                              isActive ? 'bg-orange-50' : ''
                            }`}
                            onPress={() => {
                              setSelectedJob(job);
                              setError(null);
                            }}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isActive }}
                          >
                            <Text
                              className={`text-sm ${
                                isActive ? 'font-bold text-orange-600' : 'font-semibold text-slate-700'
                              }`}
                              numberOfLines={1}
                            >
                              {job.code ? `${job.code} · ` : ''}
                              {job.name || 'Hạng mục chưa đặt tên'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </>
            )}
          </View>

          {/* (b) Đơn giá + ghi chú */}
          <View>
            <Text className="mb-1.5 text-xs font-bold text-slate-700">
              Đơn giá nhà cung cấp <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              testID="vendorJobPriceInput"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-bold text-slate-900"
              placeholder="0"
              keyboardType="number-pad"
              placeholderTextColor="#94A3B8"
              value={priceInput}
              onChangeText={(value) => {
                setPriceInput(formatNumberInput(value));
                setError(null);
              }}
            />
            <Text className="mt-1 text-[11px] text-slate-400">
              {selectedPrice > 0
                ? formatVND(selectedPrice, 'VNĐ')
                : 'Giá vốn hạng mục = đơn giá thấp nhất của các nhà cung cấp.'}
            </Text>
          </View>

          <View>
            <Text className="mb-1.5 text-xs font-bold text-slate-700">Ghi chú</Text>
            <TextInput
              testID="vendorJobNoteInput"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
              placeholder="VD: Bao gồm VAT, thời gian hoàn thành 3 ngày..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              value={noteInput}
              onChangeText={setNoteInput}
            />
          </View>

          {error ? <Text className="text-xs font-semibold text-red-500">{error}</Text> : null}
        </ScrollView>

        <View className="border-t border-slate-100 px-5 pb-6 pt-3">
          <TouchableOpacity
            testID="vendorJobSubmitButton"
            className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl bg-primary"
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="check" size={18} color="#FFFFFF" />
                <Text className="text-sm font-extrabold text-white">
                  {isEditing ? 'Lưu thay đổi' : 'Gán hạng mục'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

/**
 * Sheet chỉ được mount khi mở ⇒ state (đơn giá/ghi chú/hạng mục đang sửa) luôn
 * được khởi tạo mới từ props, không cần effect reset state.
 */
export default function VendorJobModal({ visible, ...sheetProps }: VendorJobModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={sheetProps.onClose}>
      {visible ? <VendorJobSheet {...sheetProps} /> : null}
    </Modal>
  );
}
