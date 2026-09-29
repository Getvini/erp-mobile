import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import JobFormModal from '@/components/jobs/JobFormModal';
import { BrandColors } from '@/constants/colors';
import {
  useDeleteJobMutation,
  useJobCriteriasQuery,
  useJobDetailQuery,
} from '@/hooks/queries/useJobs';
import {
  Job,
  JobCriteria,
  JOB_CATEGORY_COLORS,
  JOB_CATEGORY_LABELS,
  JOB_PERFORMER_TYPE_LABELS,
  toJobNumber,
} from '@/services/jobService';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatDateToDDMMYYYY, formatVND } from '@/utils/formatters';
import { canAccessJobs, canManageJobs, isManagementRole } from '@/utils/rbac';

const DEFAULT_CATEGORY_COLOR = { color: '#475569', bg: '#F1F5F9', border: '#E2E8F0' };

/**
 * Chi tiết HẠNG MỤC CÔNG VIỆC — `/jobs/[id]`.
 * Gồm: thông tin hạng mục, tiêu chí đánh giá (tick chọn cho nghiệm thu QC),
 * dịch vụ đang dùng (`serviceJobs[].service`) và nhà cung cấp (`vendorJobs[]`).
 *
 * ⚠️ Sửa/Xóa chỉ cho ADMIN/BOD (chuẩn Web `JobDetailPage.jsx:37`).
 */
export default function JobDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const jobId = String(params.id || '');

  const user = useAuthStore((state) => state.user);
  const isAuthLoading = useAuthStore((state) => state.isLoading);

  const [isEditVisible, setIsEditVisible] = useState(false);
  const [passedCriteriaIds, setPassedCriteriaIds] = useState<string[]>([]);

  const hasAccess = canAccessJobs(user?.role);
  const canWrite = canManageJobs(user?.role) && isManagementRole(user?.role);

  const {
    data: job,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useJobDetailQuery(jobId);
  const { data: criterias } = useJobCriteriasQuery(jobId);
  const deleteMutation = useDeleteJobMutation();

  const criteriaList: JobCriteria[] = useMemo(() => {
    if (Array.isArray(criterias) && criterias.length > 0) return criterias;
    return Array.isArray(job?.criteria) ? (job?.criteria as JobCriteria[]) : [];
  }, [criterias, job]);

  const serviceLinks = useMemo(
    () => (Array.isArray(job?.serviceJobs) ? job?.serviceJobs || [] : []),
    [job]
  );
  const vendorLinks = useMemo(
    () => (Array.isArray(job?.vendorJobs) ? job?.vendorJobs || [] : []),
    [job]
  );

  const toggleCriteria = (criteriaId: string) => {
    setPassedCriteriaIds((prev) =>
      prev.includes(criteriaId) ? prev.filter((id) => id !== criteriaId) : [...prev, criteriaId]
    );
  };

  const handleDelete = () => {
    if (!job?.id) return;
    Alert.alert(
      'Xóa hạng mục công việc',
      `Bạn có chắc chắn muốn xóa hạng mục "${job.name}"? Hành động này không thể hoàn tác.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id: job.id });
              Alert.alert('Thành công', 'Đã xóa hạng mục công việc.');
              router.back();
            } catch (err: any) {
              Alert.alert('Lỗi xóa hạng mục', err?.message || 'Không thể xóa hạng mục.');
            }
          },
        },
      ]
    );
  };

  if (isAuthLoading || isLoading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-[#F8FAFC]">
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text className="text-sm text-[#64748B] mt-3">Đang tải hạng mục...</Text>
      </SafeAreaView>
    );
  }

  if (!hasAccess) {
    return (
      <SafeAreaView className="flex-1 bg-[#F8FAFC] items-center justify-center px-8">
        <Feather name="lock" size={36} color="#94A3B8" />
        <Text className="text-base font-bold text-[#1E293B] mt-4 mb-1.5">Giới hạn quyền truy cập</Text>
        <Text className="text-[13px] text-[#64748B] text-center">
          Bạn không có quyền xem hạng mục công việc.
        </Text>
      </SafeAreaView>
    );
  }

  if (isError || !job) {
    return (
      <SafeAreaView className="flex-1 bg-[#F8FAFC]">
        <View className="flex-row items-center gap-3 px-4 py-3 bg-white border-b border-[#E2E8F0]">
          <TouchableOpacity
            className="w-12 h-12 items-center justify-center rounded-xl bg-[#F1F5F9]"
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color="#334155" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-[#0F172A]">Chi tiết hạng mục</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Feather name="alert-triangle" size={32} color="#EF4444" />
          <Text className="text-base font-bold text-[#1E293B] mt-4 mb-1.5">
            Không tải được hạng mục
          </Text>
          <Text className="text-[13px] text-[#64748B] text-center mb-4">
            {(error as any)?.message || 'Hạng mục không tồn tại hoặc đã bị xóa.'}
          </Text>
          <TouchableOpacity
            className="flex-row items-center gap-2 bg-primary px-4 rounded-xl min-h-[48px]"
            onPress={() => refetch()}
            activeOpacity={0.85}
          >
            <Feather name="refresh-cw" size={16} color="#FFFFFF" />
            <Text className="text-sm font-bold text-white">Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const categories = Array.isArray(job.categories) ? job.categories : [];
  const performerLabel = JOB_PERFORMER_TYPE_LABELS[job.defaultPerformerType || 'INTERNAL'] || '—';

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 py-3 bg-white border-b border-[#E2E8F0]">
        <TouchableOpacity
          className="w-12 h-12 items-center justify-center rounded-xl bg-[#F1F5F9]"
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityLabel="Quay lại"
        >
          <Feather name="arrow-left" size={20} color="#334155" />
        </TouchableOpacity>

        <View className="flex-1">
          <Text className="text-base font-bold text-[#0F172A]" numberOfLines={1}>
            {job.name}
          </Text>
          <Text className="text-[11px] text-[#64748B] mt-0.5" numberOfLines={1}>
            Mã: {job.code || '—'} · Cập nhật: {formatDateToDDMMYYYY(job.updatedAt || job.createdAt)}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            colors={[BrandColors.primary]}
            tintColor={BrandColors.primary}
          />
        }
      >
        {/* Thông tin chính */}
        <View className="bg-white rounded-2xl p-4 border border-[#E2E8F0]">
          <View className="flex-row flex-wrap gap-1.5 mb-3">
            {categories.length > 0 ? (
              categories.map((category) => {
                const meta = JOB_CATEGORY_COLORS[category] || DEFAULT_CATEGORY_COLOR;
                return (
                  <View
                    key={category}
                    className="px-2 py-0.5 rounded-md border"
                    style={{ backgroundColor: meta.bg, borderColor: meta.border }}
                  >
                    <Text className="text-[11px] font-bold" style={{ color: meta.color }}>
                      {JOB_CATEGORY_LABELS[category] || category}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text className="text-[11px] italic text-[#94A3B8]">Chưa xác định category</Text>
            )}
          </View>

          <View className="flex-row gap-2 mb-3">
            <View className="flex-1 rounded-xl bg-[#FFF4EA] border border-[#FDCB9E] p-3">
              <Text className="text-[10px] font-bold text-[#C2410C] uppercase mb-1">Giá vốn</Text>
              <Text className="text-sm font-extrabold text-primary">
                {formatVND(toJobNumber(job.costPrice))}
              </Text>
            </View>
            <View className="flex-1 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] p-3">
              <Text className="text-[10px] font-bold text-[#B45309] uppercase mb-1">Vinicoin</Text>
              <Text className="text-sm font-extrabold text-[#B45309]">
                {toJobNumber(job.vinicoin)}
              </Text>
            </View>
            <View className="flex-1 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] p-3">
              <Text className="text-[10px] font-bold text-[#1D4ED8] uppercase mb-1">Thời gian</Text>
              <Text className="text-sm font-extrabold text-[#1D4ED8]">
                {toJobNumber(job.timeToComplete)} giờ
              </Text>
            </View>
          </View>

          <View className="gap-2 pt-2 border-t border-[#F1F5F9]">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-[#64748B]">Biệt danh</Text>
              <Text className="text-xs font-semibold text-[#334155]">{job.nickname || '—'}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-[#64748B]">Người thực hiện mặc định</Text>
              <Text className="text-xs font-semibold text-[#334155]">{performerLabel}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-[#64748B]">Đơn vị</Text>
              <Text className="text-xs font-semibold text-[#334155]">{job.unit || '—'}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-[#64748B]">Liên quan tới AI (brief video)</Text>
              <Text
                className={
                  'text-xs font-bold ' + (job.isBriefVideo ? 'text-[#0E7490]' : 'text-[#94A3B8]')
                }
              >
                {job.isBriefVideo ? 'Có' : 'Không'}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-[#64748B]">Là hạng mục báo giá</Text>
              <Text
                className={
                  'text-xs font-bold ' +
                  (job.isQuotationItem !== false ? 'text-[#047857]' : 'text-[#94A3B8]')
                }
              >
                {job.isQuotationItem !== false ? 'Có' : 'Không'}
              </Text>
            </View>
          </View>
        </View>

        {/* Tiêu chí đánh giá (tick chọn cho nghiệm thu QC) */}
        <View className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
            <View className="flex-row items-center gap-2">
              <Feather name="clipboard" size={16} color={BrandColors.primary} />
              <Text className="text-sm font-bold text-[#0F172A]">Tiêu chí đánh giá</Text>
            </View>
            <Text className="text-[11px] font-semibold text-[#64748B]">
              Đã chọn {passedCriteriaIds.length}/{criteriaList.length}
            </Text>
          </View>

          <View className="p-4 gap-2">
            {criteriaList.length === 0 ? (
              <View className="items-center py-6 rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC]">
                <Feather name="check-square" size={22} color="#CBD5E1" />
                <Text className="text-xs italic text-[#94A3B8] mt-2">
                  Chưa có tiêu chí đánh giá nào được thiết lập.
                </Text>
              </View>
            ) : (
              criteriaList.map((criteria) => {
                const isChecked = passedCriteriaIds.includes(criteria.id);
                return (
                  <TouchableOpacity
                    key={criteria.id}
                    className={
                      'flex-row items-start gap-3 rounded-xl border p-3 min-h-[48px] ' +
                      (isChecked ? 'bg-[#FFF4EA] border-[#FDCB9E]' : 'bg-[#F8FAFC] border-[#E2E8F0]')
                    }
                    onPress={() => toggleCriteria(criteria.id)}
                    activeOpacity={0.8}
                  >
                    <View
                      className={
                        'w-5 h-5 rounded-md border items-center justify-center mt-0.5 ' +
                        (isChecked ? 'bg-primary border-primary' : 'bg-white border-[#CBD5E1]')
                      }
                    >
                      {isChecked ? <Feather name="check" size={13} color="#FFFFFF" /> : null}
                    </View>
                    <View className="flex-1">
                      <Text className="text-[13px] font-bold text-[#0F172A] uppercase">
                        {criteria.name}
                      </Text>
                      {criteria.description ? (
                        <Text className="text-xs text-[#64748B] mt-1 leading-[17px]">
                          {criteria.description}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        {/* Dịch vụ đang dùng */}
        <View className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
            <View className="flex-row items-center gap-2">
              <Feather name="layers" size={16} color="#2563EB" />
              <Text className="text-sm font-bold text-[#0F172A]">Dịch vụ đang dùng</Text>
            </View>
            <Text className="text-[11px] font-semibold text-[#64748B]">
              {serviceLinks.length} dịch vụ
            </Text>
          </View>

          <View className="p-4 gap-2">
            {serviceLinks.length === 0 ? (
              <View className="items-center py-6 rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC]">
                <Feather name="layers" size={22} color="#CBD5E1" />
                <Text className="text-xs italic text-[#94A3B8] mt-2 px-6 text-center">
                  Hạng mục này chưa được gán cho dịch vụ nào.
                </Text>
              </View>
            ) : (
              serviceLinks.map((link, index) => {
                const service = link.service;
                const quantity = toJobNumber(link.quantity) || 1;
                return (
                  <TouchableOpacity
                    key={link.id || service?.id || `service-job-${index}`}
                    className="flex-row items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 min-h-[48px]"
                    activeOpacity={0.8}
                    onPress={() => {
                      if (service?.id) router.push(`/services/${service.id}` as any);
                    }}
                  >
                    <View className="w-9 h-9 rounded-lg bg-white border border-[#E2E8F0] items-center justify-center">
                      <Feather name="box" size={16} color="#2563EB" />
                    </View>

                    <View className="flex-1">
                      <Text className="text-[13px] font-bold text-[#0F172A]" numberOfLines={1}>
                        {service?.name || 'Dịch vụ chưa xác định'}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-0.5">
                        <Text className="text-[11px] text-[#64748B]">
                          Mã: {service?.code || '—'}
                        </Text>
                        <Text className="text-[11px] text-[#64748B]">SL: {quantity}</Text>
                        {link.isOutput ? (
                          <View className="px-1.5 py-0.5 rounded-md bg-[#ECFDF5] border border-[#A7F3D0]">
                            <Text className="text-[10px] font-bold text-[#047857]">Đầu ra</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <Feather name="chevron-right" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        {/* Nhà cung cấp */}
        <View className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
            <View className="flex-row items-center gap-2">
              <Feather name="truck" size={16} color="#4F46E5" />
              <Text className="text-sm font-bold text-[#0F172A]">Nhà cung cấp</Text>
            </View>
            <Text className="text-[11px] font-semibold text-[#64748B]">
              {vendorLinks.length} vendor
            </Text>
          </View>

          <View className="p-4 gap-2">
            {vendorLinks.length === 0 ? (
              <View className="items-center py-6 rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC]">
                <Feather name="truck" size={22} color="#CBD5E1" />
                <Text className="text-xs italic text-[#94A3B8] mt-2 px-6 text-center">
                  Chưa có vendor nào thực hiện hạng mục này.
                </Text>
              </View>
            ) : (
              vendorLinks.map((link, index) => (
                <TouchableOpacity
                  key={link.id || link.vendor?.id || `vendor-job-${index}`}
                  className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 min-h-[48px]"
                  activeOpacity={0.8}
                  onPress={() => {
                    if (link.vendor?.id) router.push(`/vendors/${link.vendor.id}` as any);
                  }}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-9 h-9 rounded-lg bg-white border border-[#E2E8F0] items-center justify-center">
                      <Feather name="briefcase" size={16} color="#4F46E5" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[13px] font-bold text-[#0F172A]" numberOfLines={1}>
                        {link.vendor?.name || 'Vendor chưa xác định'}
                      </Text>
                      <Text className="text-[11px] text-[#64748B] mt-0.5">
                        {link.vendor?.type === 'INDIVIDUAL' ? 'Cá nhân' : 'Công ty'}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[10px] text-[#64748B]">Giá chào</Text>
                      <Text className="text-[13px] font-extrabold text-[#047857]">
                        {formatVND(toJobNumber(link.price))}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color="#94A3B8" />
                  </View>

                  {link.note ? (
                    <Text className="text-[11px] text-[#64748B] italic mt-2 pt-2 border-t border-[#E2E8F0]">
                      {link.note}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        {/* Hành động ADMIN/BOD */}
        {canWrite ? (
          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center gap-2 bg-primary rounded-xl min-h-[48px]"
              onPress={() => setIsEditVisible(true)}
              activeOpacity={0.85}
            >
              <Feather name="edit-3" size={16} color="#FFFFFF" />
              <Text className="text-sm font-bold text-white">Sửa hạng mục</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-xl min-h-[48px]"
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
              activeOpacity={0.85}
            >
              {deleteMutation.isPending ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <>
                  <Feather name="trash-2" size={16} color="#EF4444" />
                  <Text className="text-sm font-bold text-[#EF4444]">Xóa hạng mục</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <JobFormModal
        visible={isEditVisible}
        job={job as Job}
        onClose={() => setIsEditVisible(false)}
        onSuccess={() => refetch()}
      />
    </SafeAreaView>
  );
}
