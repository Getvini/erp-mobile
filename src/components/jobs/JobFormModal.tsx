import React, { useState } from 'react';
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
import {
  CreateJobPayload,
  findJobByCode,
  isJobCriteriaChanged,
  Job,
  JOB_CATEGORY_OPTIONS,
  JOB_DUPLICATE_CODE_MESSAGE,
  JOB_PERFORMER_TYPE_OPTIONS,
  JobCriteriaInput,
  JobPerformerType,
} from '@/services/jobService';
import {
  useCreateJobMutation,
  useJobsQuery,
  useSyncJobCriteriasMutation,
  useUpdateJobMutation,
} from '@/hooks/queries/useJobs';
import { BrandColors } from '@/constants/colors';
import { formatNumberInput, parseNumberInput } from '@/utils/formatters';
import JobCriteriaEditor from './JobCriteriaEditor';

interface JobFormModalProps {
  visible: boolean;
  /** Có `job` ⇒ chế độ Sửa (PATCH + sync tiêu chí riêng), không có ⇒ chế độ Tạo. */
  job?: Job | null;
  onClose: () => void;
  onSuccess?: (job: Job | null) => void;
}

const NICKNAME_MAX_LENGTH = 120;

/** DB decimal (scale 3) → mask hiển thị tiền VND. `Number("100.000") = 100` đúng ngữ nghĩa numeric. */
const toMoneyMask = (value?: number | string | null): string => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) return '';
  return formatNumberInput(String(Math.round(parsed)));
};

const toHoursText = (value?: number | string | null): string => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  return String(parsed);
};

/** Chỉ cho phép số thập phân với 1 dấu chấm (đơn vị GIỜ). */
const sanitizeDecimalInput = (value: string): string => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, '')}`;
};

function CheckboxRow({
  label,
  description,
  value,
  onToggle,
  disabled = false,
}: {
  label: string;
  description?: string;
  value: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      className={
        'flex-row items-center gap-3 rounded-xl border px-3 min-h-[48px] ' +
        (disabled ? 'border-[#E2E8F0] bg-[#F8FAFC] opacity-60' : 'border-[#E2E8F0] bg-white')
      }
      onPress={() => onToggle(!value)}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View
        className={
          'w-5 h-5 rounded-md border items-center justify-center ' +
          (value ? 'bg-primary border-primary' : 'bg-white border-[#CBD5E1]')
        }
      >
        {value ? <Feather name="check" size={13} color="#FFFFFF" /> : null}
      </View>
      <View className="flex-1 py-2">
        <Text className="text-[13px] font-semibold text-[#334155]">{label}</Text>
        {description ? <Text className="text-[11px] text-[#94A3B8] mt-0.5">{description}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Bottom sheet Tạo / Sửa HẠNG MỤC CÔNG VIỆC (Jobs).
 *
 * ⚠️ POST /jobs DEDUPE theo `code`: nếu trùng, backend trả về job CŨ và KHÔNG tạo mới
 * ⇒ form cảnh báo trước khi gửi và thông báo "Mã hạng mục đã tồn tại, đã dùng hạng mục có sẵn".
 * ⚠️ PATCH /jobs/:id KHÔNG nhận `criteria` ⇒ khi tiêu chí thay đổi phải gọi riêng
 * useSyncJobCriteriasMutation (giữ `id` cũ để tránh soft-delete & tạo lại).
 *
 * `Modal` của RN unmount children khi `visible = false` ⇒ `JobFormSheet` được khởi tạo lại
 * từ props mỗi lần mở (không cần effect reset state).
 */
export default function JobFormModal({ visible, job, onClose, onSuccess }: JobFormModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <JobFormSheet
        key={job?.id || 'create-job'}
        job={job || null}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  );
}

function JobFormSheet({
  job,
  onClose,
  onSuccess,
}: {
  job: Job | null;
  onClose: () => void;
  onSuccess?: (job: Job | null) => void;
}) {
  const isEditing = Boolean(job?.id);

  const createMutation = useCreateJobMutation();
  const updateMutation = useUpdateJobMutation();
  const syncCriteriaMutation = useSyncJobCriteriasMutation();
  const { data: allJobs } = useJobsQuery();

  const [name, setName] = useState<string>(() => job?.name || '');
  const [code, setCode] = useState<string>(() => job?.code || '');
  const [nickname, setNickname] = useState<string>(() => job?.nickname || '');
  const [costPrice, setCostPrice] = useState<string>(() => toMoneyMask(job?.costPrice));
  const [vinicoin, setVinicoin] = useState<string>(() => toMoneyMask(job?.vinicoin));
  const [hours, setHours] = useState<string>(() => toHoursText(job?.timeToComplete));
  const [unit, setUnit] = useState<string>(() => job?.unit || '');
  const [categories, setCategories] = useState<string[]>(() =>
    Array.isArray(job?.categories) ? (job?.categories as string[]) : []
  );
  const [performerType, setPerformerType] = useState<JobPerformerType>(() =>
    job?.defaultPerformerType === 'VENDOR' ? 'VENDOR' : 'INTERNAL'
  );
  const [isBriefVideo, setIsBriefVideo] = useState<boolean>(() => Boolean(job?.isBriefVideo));
  const [isQuotationItem, setIsQuotationItem] = useState<boolean>(() => job?.isQuotationItem !== false);
  // isAiRelated là trạng thái "cha" (giống Web): true khi isBriefVideo=true HOẶC isQuotationItem=false khi edit.
  const [isAiRelated, setIsAiRelated] = useState<boolean>(
    () => Boolean(job?.isBriefVideo) || job?.isQuotationItem === false
  );
  const [criteria, setCriteria] = useState<JobCriteriaInput[]>(() =>
    (Array.isArray(job?.criteria) ? job?.criteria || [] : []).map((item) => ({
      id: item.id,
      name: item.name || '',
      description: item.description || '',
    }))
  );
  const [showCriteriaErrors, setShowCriteriaErrors] = useState(false);

  const isSubmitting =
    createMutation.isPending || updateMutation.isPending || syncCriteriaMutation.isPending;

  const handleToggleCategory = (value: string) => {
    setCategories((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleToggleBriefVideo = (next: boolean) => {
    setIsBriefVideo(next);
  };

  const handleAiRelatedChange = (next: boolean) => {
    setIsAiRelated(next);
    if (!next) {
      // Bỏ tick cha → reset về mặc định (giống Web)
      setIsBriefVideo(false);
      setIsQuotationItem(true);
    }
  };

  const validate = (): boolean => {
    if (!name.trim()) {
      Alert.alert('Lỗi nhập liệu', 'Tên hạng mục là bắt buộc.');
      return false;
    }
    if (!code.trim()) {
      Alert.alert('Lỗi nhập liệu', 'Mã hạng mục là bắt buộc.');
      return false;
    }
    if (nickname.trim().length > NICKNAME_MAX_LENGTH) {
      Alert.alert('Lỗi nhập liệu', `Biệt danh không được vượt quá ${NICKNAME_MAX_LENGTH} ký tự.`);
      return false;
    }
    if (criteria.some((item) => !String(item.name || '').trim())) {
      setShowCriteriaErrors(true);
      Alert.alert('Lỗi nhập liệu', 'Tên tiêu chí đánh giá không được để trống.');
      return false;
    }
    return true;
  };

  const buildPayload = (): CreateJobPayload => {
    const parsedHours = Number(hours);
    return {
      name: name.trim(),
      code: code.trim(),
      nickname: nickname.trim() || null,
      costPrice: parseNumberInput(costPrice),
      vinicoin: parseNumberInput(vinicoin),
      timeToComplete: hours.trim() && Number.isFinite(parsedHours) ? parsedHours : 0,
      unit: unit.trim() || null,
      categories,
      isBriefVideo: isAiRelated ? isBriefVideo : false,
      isQuotationItem: isAiRelated ? isQuotationItem : true,
      defaultPerformerType: performerType,
    };
  };

  const submitCreate = async (idsBeforeSubmit: Set<string>) => {
    const payload: CreateJobPayload = { ...buildPayload(), criteria };
    try {
      const created = await createMutation.mutateAsync(payload);
      const isDeduped = Boolean(created?.id && idsBeforeSubmit.has(created.id));

      Alert.alert(
        isDeduped ? 'Mã hạng mục đã tồn tại' : 'Thành công',
        isDeduped ? JOB_DUPLICATE_CODE_MESSAGE : `Đã tạo hạng mục công việc "${payload.name}".`
      );
      onSuccess?.(created || null);
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi tạo hạng mục', err?.message || 'Không thể tạo hạng mục. Vui lòng thử lại.');
    }
  };

  const handleCreate = () => {
    const jobs = allJobs || [];
    // Chụp danh sách id TRƯỚC khi gửi: backend trả về job CŨ nếu trùng `code`.
    const idsBeforeSubmit = new Set(jobs.map((item) => item.id));
    const duplicated = findJobByCode(jobs, code);

    if (duplicated) {
      Alert.alert(
        'Mã hạng mục đã tồn tại',
        `Mã "${code.trim()}" đã thuộc hạng mục "${duplicated.name}". Hệ thống sẽ dùng hạng mục có sẵn và KHÔNG tạo mới (tiêu chí vừa nhập sẽ không được lưu).`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Dùng hạng mục có sẵn',
            onPress: () => {
              void submitCreate(idsBeforeSubmit);
            },
          },
        ]
      );
      return;
    }

    void submitCreate(idsBeforeSubmit);
  };

  const submitUpdate = async () => {
    if (!job?.id) return;
    const jobId = job.id;

    try {
      await updateMutation.mutateAsync({ id: jobId, ...buildPayload() });

      if (isJobCriteriaChanged(job.criteria, criteria)) {
        await syncCriteriaMutation.mutateAsync({ jobId, criteria });
      }

      Alert.alert('Thành công', 'Đã cập nhật hạng mục công việc.');
      onSuccess?.(null);
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi cập nhật', err?.message || 'Không thể cập nhật hạng mục. Vui lòng thử lại.');
    }
  };

  const handleSubmit = () => {
    if (!validate()) return;
    if (isEditing) {
      void submitUpdate();
    } else {
      handleCreate();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-slate-900/50 justify-end"
    >
      <View className="bg-white rounded-t-[24px] max-h-[90%] w-full">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
          <View className="flex-row items-center gap-2 flex-1">
            <View className="w-9 h-9 rounded-xl bg-[#FFF4EA] items-center justify-center border border-[#FDCB9E]">
              <Feather name="briefcase" size={18} color={BrandColors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-[#0F172A]">
                {isEditing ? 'Chỉnh Sửa Hạng Mục' : 'Thêm Hạng Mục Công Việc'}
              </Text>
              <Text className="text-[11px] text-[#64748B] mt-0.5">
                Hạng mục công việc & tiêu chí đánh giá
              </Text>
            </View>
          </View>

          <TouchableOpacity
            className="w-12 h-12 rounded-xl bg-[#F1F5F9] items-center justify-center"
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityLabel="Đóng"
          >
            <Feather name="x" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingBottom: 28, gap: 14 }}
        >
          {/* Tên hạng mục */}
          <View>
            <Text className="text-xs font-bold text-[#334155] mb-1.5">
              Tên hạng mục <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 text-sm text-[#0F172A] min-h-[48px]"
              placeholder="Ví dụ: Quay phim chính, Edit video..."
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Mã hạng mục */}
          <View>
            <Text className="text-xs font-bold text-[#334155] mb-1.5">
              Mã hạng mục <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 text-sm text-[#0F172A] min-h-[48px]"
              placeholder="Ví dụ: VID, DES..."
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              value={code}
              onChangeText={setCode}
            />
            <Text className="text-[11px] text-[#94A3B8] mt-1">
              Mã dùng để nhận diện hạng mục. Nếu mã đã tồn tại, hệ thống dùng hạng mục có sẵn.
            </Text>
          </View>

          {/* Biệt danh */}
          <View>
            <Text className="text-xs font-bold text-[#334155] mb-1.5">Biệt danh</Text>
            <TextInput
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 text-sm text-[#0F172A] min-h-[48px]"
              placeholder="Ví dụ: video"
              placeholderTextColor="#94A3B8"
              maxLength={NICKNAME_MAX_LENGTH}
              value={nickname}
              onChangeText={setNickname}
            />
          </View>

          {/* Giá vốn */}
          <View>
            <Text className="text-xs font-bold text-[#334155] mb-1.5">Giá vốn (1 đơn vị)</Text>
            <TextInput
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 text-sm text-[#0F172A] min-h-[48px]"
              placeholder="0"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={costPrice}
              onChangeText={(value) => setCostPrice(formatNumberInput(value))}
            />
            <Text className="text-[11px] text-[#94A3B8] mt-1">{`${costPrice || 0} VNĐ`}</Text>
          </View>

          {/* Vinicoin */}
          <View>
            <Text className="text-xs font-bold text-[#334155] mb-1.5">Vinicoin</Text>
            <TextInput
              className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 text-sm text-[#0F172A] min-h-[48px]"
              placeholder="0"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={vinicoin}
              onChangeText={(value) => setVinicoin(formatNumberInput(value))}
            />
            <Text className="text-[11px] text-[#94A3B8] mt-1">
              Thưởng nội bộ cho người thực hiện, không tham gia tính giá vốn.
            </Text>
          </View>

          <View className="flex-row gap-3">
            {/* Thời gian hoàn thành */}
            <View className="flex-1">
              <Text className="text-xs font-bold text-[#334155] mb-1.5">Thời gian (giờ)</Text>
              <TextInput
                className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 text-sm text-[#0F172A] min-h-[48px]"
                placeholder="0"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={hours}
                onChangeText={(value) => setHours(sanitizeDecimalInput(value))}
              />
            </View>

            {/* Đơn vị */}
            <View className="flex-1">
              <Text className="text-xs font-bold text-[#334155] mb-1.5">Đơn vị</Text>
              <TextInput
                className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3.5 text-sm text-[#0F172A] min-h-[48px]"
                placeholder="Video, Bài..."
                placeholderTextColor="#94A3B8"
                value={unit}
                onChangeText={setUnit}
              />
            </View>
          </View>

          {/* Người thực hiện mặc định */}
          <View>
            <Text className="text-xs font-bold text-[#334155] mb-1.5">Người thực hiện mặc định</Text>
            <View className="flex-row gap-2">
              {JOB_PERFORMER_TYPE_OPTIONS.map((option) => {
                const isActive = performerType === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    className={
                      'flex-1 items-center justify-center rounded-xl border min-h-[48px] ' +
                      (isActive ? 'bg-primary border-primary' : 'bg-[#F8FAFC] border-[#E2E8F0]')
                    }
                    onPress={() => setPerformerType(option.value)}
                    activeOpacity={0.85}
                  >
                    <Text
                      className={
                        'text-[13px] font-bold ' + (isActive ? 'text-white' : 'text-[#64748B]')
                      }
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Category multi-select */}
          <View>
            <Text className="text-xs font-bold text-[#334155] mb-2 uppercase">Category</Text>
            <View className="flex-row flex-wrap gap-2">
              {JOB_CATEGORY_OPTIONS.map((option) => {
                const isChecked = categories.includes(option.value);
                return (
                  <TouchableOpacity
                    key={option.value}
                    className={
                      'flex-row items-center gap-2 rounded-xl border px-3 py-2 min-h-[48px] ' +
                      (isChecked ? 'bg-[#FFF4EA] border-[#FDCB9E]' : 'bg-white border-[#E2E8F0]')
                    }
                    onPress={() => handleToggleCategory(option.value)}
                    activeOpacity={0.8}
                  >
                    <View
                      className={
                        'w-4 h-4 rounded border items-center justify-center ' +
                        (isChecked ? 'bg-primary border-primary' : 'bg-white border-[#CBD5E1]')
                      }
                    >
                      {isChecked ? <Feather name="check" size={11} color="#FFFFFF" /> : null}
                    </View>
                    <Text
                      className={
                        'text-[13px] font-semibold ' + (isChecked ? 'text-primary' : 'text-[#475569]')
                      }
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {categories.length === 0 ? (
              <Text className="text-[11px] italic text-[#94A3B8] mt-1.5">Chưa xác định category</Text>
            ) : null}
          </View>

          {/* Cờ AI / báo giá */}
          <View className="gap-2">
            {/* Checkbox cha: giống Web - tick cha mới hiện 2 checkbox con */}
            <CheckboxRow
              label="Công việc liên quan tới AI"
              value={isAiRelated}
              onToggle={handleAiRelatedChange}
            />
            {isAiRelated ? (
              <View className="gap-2 pl-4">
                <CheckboxRow
                  label="Yêu cầu nhập brief video"
                  value={isBriefVideo}
                  onToggle={handleToggleBriefVideo}
                />
                <CheckboxRow
                  label="Được tính vào giá vốn dịch vụ"
                  value={isQuotationItem}
                  onToggle={setIsQuotationItem}
                />
              </View>
            ) : null}
          </View>

          {/* Tiêu chí đánh giá */}
          <JobCriteriaEditor
            criteria={criteria}
            onChange={setCriteria}
            showErrors={showCriteriaErrors}
          />
        </ScrollView>

        {/* Footer */}
        <View className="flex-row gap-3 px-5 py-4 border-t border-[#F1F5F9]">
          <TouchableOpacity
            className="flex-1 items-center justify-center rounded-xl bg-[#F1F5F9] min-h-[48px]"
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text className="text-sm font-bold text-[#64748B]">Hủy bỏ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 items-center justify-center rounded-xl bg-primary min-h-[48px]"
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-sm font-bold text-white">
                {isEditing ? 'Lưu thay đổi' : 'Tạo hạng mục'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
