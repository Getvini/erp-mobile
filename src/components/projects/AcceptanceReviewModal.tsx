import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  AcceptanceItem,
  AcceptanceDecision,
  ACCEPTANCE_STATUS_CONFIG,
} from '@/services/acceptanceService';
import {
  useAcceptanceDetailQuery,
  useProcessAcceptanceMutation,
} from '@/hooks/queries/useAcceptances';
import { BrandColors } from '@/constants/colors';
import { useAuthStore } from '@/stores/useAuthStore';
import { canProcessAcceptance as canProcessAcceptanceRole } from '@/utils/rbac';
import { formatDateToDDMMYYYY } from '@/utils/formatters';
import {
  countPendingResults,
  countRejectedResults,
  dedupeResultsByTask,
  findRejectedServiceMissingFeedback,
  getAcceptanceDisplayStatus,
  getAcceptanceReadOnlyReason,
  isAcceptanceReadOnly,
  isAllRejected,
} from '@/utils/acceptance';

interface AcceptanceReviewModalProps {
  visible: boolean;
  onClose: () => void;
  request: AcceptanceItem | null;
  onSuccess: () => void;
}

export default function AcceptanceReviewModal({
  visible,
  onClose,
  request,
  onSuccess,
}: AcceptanceReviewModalProps) {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const [editedDecisions, setEditedDecisions] = useState<Record<string, AcceptanceDecision>>({});
  const [serviceFeedbacks, setServiceFeedbacks] = useState<Record<string, string>>({});
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  /**
   * RBAC duyệt nghiệm thu — chỉ BOD/ADMIN/ADMIN_SALE/PM (Acceptance.Route.ts:10).
   * Vai trò khác chỉ được xem (read-only), nút xác nhận bị ẩn hoàn toàn.
   */
  const canProcessAcceptance = canProcessAcceptanceRole((currentUser as any)?.role);

  const { data: fullRequest, isLoading: isLoadingDetails } = useAcceptanceDetailQuery(
    visible && request?.id ? request.id : '',
  );

  const processAcceptanceMutation = useProcessAcceptanceMutation();
  const isSubmitting = processAcceptanceMutation.isPending;

  // Row từ danh sách có thể thiếu dữ liệu — ưu tiên bản chi tiết đã fetch.
  const detail = (fullRequest || request) as AcceptanceItem | null;
  const services = useMemo(() => detail?.services || [], [detail]);

  const projectStatus = detail?.project?.status;
  const projectIsOnHold = detail?.project?.isOnHold;

  const isReadOnly =
    isAcceptanceReadOnly({
      status: detail?.status,
      projectStatus,
      projectIsOnHold,
    }) || !canProcessAcceptance;
  const readOnlyReason = getAcceptanceReadOnlyReason({
    status: detail?.status,
    projectStatus,
    projectIsOnHold,
  });

  const totalPendingResults = useMemo(() => countPendingResults(services), [services]);
  const hasNoPendingResult = totalPendingResults === 0;

  /**
   * Quyết định khởi tạo: mọi hạng mục APPROVED, các kết quả PENDING → APPROVED.
   * Tính bằng useMemo (không setState trong effect) để tránh cascading render.
   */
  const baseDecisions = useMemo<Record<string, AcceptanceDecision>>(() => {
    if (!fullRequest || isReadOnly) return {};
    const initial: Record<string, AcceptanceDecision> = {};
    services.forEach((service: any) => {
      initial[service.id] = {
        serviceId: service.id,
        status: 'APPROVED',
        feedback: '',
        resultDecisions: dedupeResultsByTask(service.results || [])
          .filter((result: any) => result.status !== 'APPROVED' && result.status !== 'REJECTED')
          .map((result: any) => ({
            taskId: result.taskId,
            status: 'APPROVED' as const,
            feedback: '',
          })),
      };
    });
    return initial;
  }, [fullRequest, isReadOnly, services]);

  // Điều chỉnh state trong lúc render khi mở biên bản khác (React khuyến nghị).
  const detailId = detail?.id ?? null;
  if (visible && detailId && detailId !== activeRequestId) {
    setActiveRequestId(detailId);
    setEditedDecisions({});
    setServiceFeedbacks({});
  } else if (!visible && activeRequestId !== null) {
    setActiveRequestId(null);
    setEditedDecisions({});
    setServiceFeedbacks({});
  }

  const decisions = useMemo<Record<string, AcceptanceDecision>>(
    () => ({ ...baseDecisions, ...editedDecisions }),
    [baseDecisions, editedDecisions],
  );

  const rejectAll = isAllRejected(decisions);

  const displayStatus = getAcceptanceDisplayStatus(detail?.status, services);
  const statusConfig =
    ACCEPTANCE_STATUS_CONFIG[detail?.status || ''] || {
      text: displayStatus || detail?.status || '',
      color: '#64748B',
      bg: '#F1F5F9',
    };
  const statusLabel = displayStatus || statusConfig.text;

  const serviceNameById = useMemo(() => {
    const map: Record<string, string> = {};
    services.forEach((service: any) => {
      map[service.id] = service.service?.name || service.name || 'Hạng mục dịch vụ';
    });
    return map;
  }, [services]);

  const handleGoToTask = (taskId?: string) => {
    if (!taskId) return;
    onClose();
    router.push(`/tasks/${taskId}` as any);
  };

  /** Chọn Đồng ý/Từ chối ở cấp hạng mục → cascade xuống toàn bộ resultDecisions. */
  const handleServiceDecision = (serviceId: string, status: 'APPROVED' | 'REJECTED') => {
    setEditedDecisions((prev) => {
      const current = decisions[serviceId] || { serviceId, status, resultDecisions: [] };
      const feedback = status === 'REJECTED' ? serviceFeedbacks[serviceId] || '' : '';
      return {
        ...prev,
        [serviceId]: {
          ...current,
          status,
          feedback,
          resultDecisions: (current.resultDecisions || []).map((result) => ({
            ...result,
            status,
            // Feedback của kết quả lấy từ lý do từ chối của hạng mục.
            feedback,
          })),
        },
      };
    });
  };

  const handleServiceFeedbackChange = (serviceId: string, feedback: string) => {
    setServiceFeedbacks((prev) => ({ ...prev, [serviceId]: feedback }));
    setEditedDecisions((prev) => {
      const current = decisions[serviceId];
      if (!current) return prev;
      return {
        ...prev,
        [serviceId]: {
          ...current,
          feedback,
          resultDecisions: (current.resultDecisions || []).map((result) => ({
            ...result,
            feedback,
          })),
        },
      };
    });
  };

  const handleOpenResultUrl = (url?: string) => {
    if (!url) return;
    let target = url;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    Linking.openURL(target).catch(() => {
      Alert.alert('Lỗi', 'Không thể mở liên kết kết quả.');
    });
  };

  const handleSubmit = async () => {
    if (!detail?.id) return;

    // Guard trạng thái dự án — mirror AcceptanceReviewModal.jsx:142-149.
    if (projectStatus === 'COMPLETED' || projectStatus === 'CANCELLED') {
      Alert.alert('Cảnh báo', 'Dự án đã hoàn tất hoặc đã đóng, không thể duyệt nghiệm thu.');
      return;
    }
    if (projectStatus === 'ON_HOLD' || projectIsOnHold) {
      Alert.alert('Cảnh báo', 'Dự án đang tạm dừng, không thể duyệt nghiệm thu.');
      return;
    }
    if (hasNoPendingResult) {
      Alert.alert('Thông báo', 'Tất cả kết quả đã được duyệt, không cần xác nhận thêm.');
      return;
    }

    // Field bắt buộc duy nhất: hạng mục bị từ chối phải có lý do.
    const missingFeedbackService = findRejectedServiceMissingFeedback(
      decisions,
      serviceNameById,
    );
    if (missingFeedbackService) {
      Alert.alert(
        'Cảnh báo',
        `Vui lòng nhập lý do từ chối cho hạng mục "${missingFeedbackService}"`,
      );
      return;
    }

    const payload = Object.values(decisions).map((decision) => ({
      serviceId: decision.serviceId,
      status: decision.status,
      feedback: decision.feedback,
      resultDecisions: decision.resultDecisions,
    }));

    try {
      await processAcceptanceMutation.mutateAsync({ id: detail.id, decisions: payload });
      Alert.alert('Thành công', 'Đã xử lý nghiệm thu thành công.');
      onClose();
      onSuccess();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Xử lý nghiệm thu thất bại.');
    }
  };

  if (!visible || !request) return null;

  const requesterName =    detail?.requester?.fullName || detail?.creator?.fullName || request.creator?.fullName || 'Team Lead';
  const approverName = detail?.approver?.fullName;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-900/50 justify-end">
        <View className="bg-white rounded-t-[24px] p-5 gap-3.5 max-h-[92%]">
          {/* Header */}
          <View className="flex-row justify-between items-center border-b border-slate-100 pb-3">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-[17px] font-extrabold text-slate-900">
                  {isReadOnly ? 'Chi tiết nghiệm thu' : 'Phê duyệt nghiệm thu'}
                </Text>
                <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: statusConfig.bg }}>
                  <Text className="text-[11px] font-bold" style={{ color: statusConfig.color }}>
                    {statusLabel}
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>
                {detail?.name ||
                  detail?.project?.name ||
                  detail?.acceptanceCode ||
                  'Nghiệm thu dịch vụ'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="p-2 rounded-lg bg-slate-100 min-w-[48px] min-h-[48px] items-center justify-center"
            >
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {isLoadingDetails ? (
            <View className="py-10 items-center justify-center gap-2.5">
              <ActivityIndicator size="large" color={BrandColors.primary} />
              <Text className="text-[13px] text-slate-500">Đang tải thông tin chi tiết...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Banner read-only */}
              {isReadOnly && readOnlyReason ? (
                <View className="flex-row items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 mb-3">
                  <Feather name="lock" size={14} color="#64748B" />
                  <Text className="text-xs font-semibold text-slate-600 flex-1">
                    {readOnlyReason} — biên bản chỉ được xem.
                  </Text>
                </View>
              ) : null}

              {/* Thông tin chung */}
              <View className="bg-slate-50 border border-slate-200 rounded-xl p-3 gap-1.5 mb-3">
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-slate-500">Người yêu cầu:</Text>
                  <Text className="text-xs font-bold text-slate-900">{requesterName}</Text>
                </View>
                {detail?.createdAt ? (
                  <View className="flex-row justify-between items-center">
                    <Text className="text-xs text-slate-500">Ngày yêu cầu:</Text>
                    <Text className="text-xs font-bold text-slate-900">
                      {formatDateToDDMMYYYY(detail.createdAt, '')}
                    </Text>
                  </View>
                ) : null}
                {approverName ? (
                  <View className="flex-row justify-between items-center">
                    <Text className="text-xs text-slate-500">Người nghiệm thu:</Text>
                    <Text className="text-xs font-bold text-slate-900">{approverName}</Text>
                  </View>
                ) : null}
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-slate-500">Trạng thái biên bản:</Text>
                  <Text className="text-xs font-bold" style={{ color: statusConfig.color }}>
                    {statusLabel}
                  </Text>
                </View>
                {detail?.note ? (
                  <View className="mt-1 pt-1.5 border-t border-slate-200">
                    <Text className="text-[11px] font-bold text-slate-500">
                      Ghi chú từ Team Lead:
                    </Text>
                    <Text className="text-xs text-slate-700 mt-0.5 italic">{detail.note}</Text>
                  </View>
                ) : null}
                {detail?.feedback ? (
                  <View className="mt-1 pt-1.5 border-t border-red-200 bg-red-50 rounded-lg px-2 py-1.5">
                    <Text className="text-[11px] font-bold text-red-700">
                      Phản hồi từ người duyệt:
                    </Text>
                    <Text className="text-xs text-red-900 mt-0.5">{detail.feedback}</Text>
                  </View>
                ) : null}
              </View>

              {/* Hạng mục dịch vụ */}
              <Text className="text-[11px] font-extrabold text-slate-500 tracking-wider mb-2">
                CHI TIẾT HẠNG MỤC DỊCH VỤ ({services.length})
              </Text>

              {services.length === 0 ? (
                <View className="py-8 items-center gap-2">
                  <Feather name="inbox" size={32} color="#CBD5E1" />
                  <Text className="text-xs text-slate-400">
                    Biên bản chưa có hạng mục dịch vụ nào.
                  </Text>
                </View>
              ) : null}

              {services.map((service: any) => {
                const serviceDecision = decisions[service.id];
                const results = dedupeResultsByTask(service.results || []);
                const rejectedCount = countRejectedResults(service);
                const serviceCode = service.code || service.service?.code || service.serviceCode;
                const parentName =
                  service.parentName ||
                  service.parentServiceName ||
                  service.service?.parentName ||
                  service.parent?.name;

                return (
                  <View
                    key={service.id}
                    className="bg-white border border-slate-200 rounded-2xl p-3 gap-2.5 mb-3"
                  >
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-1.5 flex-wrap">
                          {serviceCode ? (
                            <View className="bg-sky-100 px-1.5 py-0.5 rounded">
                              <Text className="text-[11px] font-bold text-sky-700">
                                #{serviceCode}
                              </Text>
                            </View>
                          ) : null}
                          <Text className="text-sm font-bold text-slate-900">
                            {service.service?.name || service.name || 'Hạng mục dịch vụ'}
                          </Text>
                        </View>
                        {parentName ? (
                          <Text className="text-[11px] text-purple-800 font-medium mt-0.5">
                            Dịch vụ cha: {parentName}
                          </Text>
                        ) : null}
                      </View>

                      {isReadOnly ? (
                        <View className="flex-row items-center gap-1 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          <Feather
                            name={rejectedCount > 0 ? 'x-circle' : 'check-circle'}
                            size={12}
                            color={rejectedCount > 0 ? '#DC2626' : '#059669'}
                          />
                          <Text
                            className="text-[11px] font-bold"
                            style={{ color: rejectedCount > 0 ? '#B91C1C' : '#047857' }}
                          >
                            {rejectedCount > 0
                              ? `Từ chối nghiệm thu (${rejectedCount} kết quả bị từ chối)`
                              : 'Đã duyệt xong'}
                          </Text>
                        </View>
                      ) : (
                        <View className="flex-row gap-1.5">
                          <TouchableOpacity
                            className={`flex-row items-center gap-1 px-3 py-2 rounded-lg border min-h-[44px] ${
                              serviceDecision?.status === 'APPROVED'
                                ? 'bg-emerald-500 border-emerald-500'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                            onPress={() => handleServiceDecision(service.id, 'APPROVED')}
                          >
                            <Feather
                              name="check"
                              size={12}
                              color={serviceDecision?.status === 'APPROVED' ? '#FFFFFF' : '#059669'}
                            />
                            <Text
                              className={`text-[11px] font-bold ${
                                serviceDecision?.status === 'APPROVED'
                                  ? 'text-white'
                                  : 'text-slate-500'
                              }`}
                            >
                              Đồng ý
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            className={`flex-row items-center gap-1 px-3 py-2 rounded-lg border min-h-[44px] ${
                              serviceDecision?.status === 'REJECTED'
                                ? 'bg-red-500 border-red-500'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                            onPress={() => handleServiceDecision(service.id, 'REJECTED')}
                          >
                            <Feather
                              name="x"
                              size={12}
                              color={serviceDecision?.status === 'REJECTED' ? '#FFFFFF' : '#DC2626'}
                            />
                            <Text
                              className={`text-[11px] font-bold ${
                                serviceDecision?.status === 'REJECTED'
                                  ? 'text-white'
                                  : 'text-slate-500'
                              }`}
                            >
                              Từ chối
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* Lý do từ chối cấp hạng mục — BẮT BUỘC */}
                    {!isReadOnly && serviceDecision?.status === 'REJECTED' ? (
                      <View>
                        <Text className="text-[11px] font-bold text-red-700 mb-1">
                          Lý do từ chối hạng mục *
                        </Text>
                        <TextInput
                          className="bg-red-50 border border-red-200 rounded-lg px-2.5 py-2 text-xs text-red-900 min-h-[44px]"
                          placeholder="Nhập lý do từ chối (bắt buộc)"
                          placeholderTextColor="#FCA5A5"
                          multiline
                          value={serviceFeedbacks[service.id] || ''}
                          onChangeText={(value) => handleServiceFeedbackChange(service.id, value)}
                        />
                      </View>
                    ) : null}

                    {/* Kết quả chi tiết */}
                    {results.length > 0 ? (
                      <View className="gap-2 pt-2 border-t border-slate-100">
                        {results.map((result: any, index: number) => {
                          const isApproved = result.status === 'APPROVED';
                          const taskCode = result.taskCode || result.task?.code || result.code;
                          return (
                            <View
                              key={result.taskId || index}
                              className="bg-slate-50 rounded-xl p-2.5 gap-1.5"
                            >
                              <View className="flex-row items-center justify-between gap-2">
                                <TouchableOpacity
                                  className="flex-1 min-w-0"
                                  onPress={() => handleGoToTask(result.taskId)}
                                  activeOpacity={0.7}
                                  disabled={!result.taskId}
                                >
                                  <Text
                                    className="text-[13px] font-semibold text-slate-700"
                                    numberOfLines={1}
                                  >
                                    {taskCode ? (
                                      <Text className="font-bold text-sky-600">#{taskCode} </Text>
                                    ) : null}
                                    {result.name || `Kết quả #${index + 1}`}
                                  </Text>
                                  {result.url ? (
                                    <TouchableOpacity
                                      onPress={() => handleOpenResultUrl(result.url)}
                                      className="flex-row items-center gap-1 mt-0.5"
                                    >
                                      <Feather
                                        name="external-link"
                                        size={11}
                                        color={BrandColors.primary}
                                      />
                                      <Text className="text-[11px] font-semibold text-primary">
                                        Xem tệp kết quả
                                      </Text>
                                    </TouchableOpacity>
                                  ) : null}
                                </TouchableOpacity>

                                <View className="flex-row items-center gap-0.5">
                                  {isReadOnly ? (
                                    isApproved ? (
                                      <View className="flex-row items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded">
                                        <Feather name="check" size={10} color="#059669" />
                                        <Text className="text-[10px] font-bold text-emerald-700">
                                          Đã duyệt
                                        </Text>
                                      </View>
                                    ) : (
                                      <View className="flex-row items-center gap-0.5 bg-red-50 px-1.5 py-0.5 rounded">
                                        <Feather name="x" size={10} color="#DC2626" />
                                        <Text className="text-[10px] font-bold text-red-700">
                                          Từ chối
                                        </Text>
                                      </View>
                                    )
                                  ) : null}
                                </View>
                              </View>

                              {/* Checklist kết quả — read-only */}
                              {Array.isArray(result.checklist) && result.checklist.length > 0 ? (
                                <View className="gap-1 mt-0.5">
                                  {result.checklist.map((item: any, checklistIndex: number) => (
                                    <View
                                      key={`${result.taskId}-check-${checklistIndex}`}
                                      className="flex-row items-center gap-1.5"
                                    >
                                      <Feather
                                        name={item.checked === false ? 'square' : 'check-square'}
                                        size={11}
                                        color={item.checked === false ? '#94A3B8' : '#059669'}
                                      />
                                      <Text className="text-[11px] text-slate-600">
                                        {item.label}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              ) : null}

                              {/* Lý do từ chối của kết quả (read-only) */}
                              {isReadOnly && result.feedback ? (
                                <View className="flex-row items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 mt-1">
                                  <Feather name="alert-circle" size={12} color="#B91C1C" />
                                  <Text className="text-[11px] text-red-900 font-semibold flex-1">
                                    Lý do từ chối: {result.feedback}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Footer Actions */}
          <View className="flex-row justify-end gap-2.5 border-t border-slate-100 pt-3">
            {isReadOnly ? (
              <View className="flex-1 flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5 flex-1 mr-2">
                  <Feather name="shield" size={14} color={statusConfig.color} />
                  <Text
                    className="text-xs font-bold flex-1"
                    style={{ color: statusConfig.color }}
                  >
                    {readOnlyReason || `Biên bản ${statusLabel.toLowerCase()}`}
                  </Text>
                </View>
                <TouchableOpacity
                  className="px-5 py-3 rounded-xl bg-slate-100 min-h-[48px] justify-center"
                  onPress={onClose}
                >
                  <Text className="text-sm font-bold text-slate-700">Đóng</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  className="px-4 py-3 rounded-xl bg-slate-100 min-h-[48px] justify-center"
                  onPress={onClose}
                  disabled={isSubmitting}
                >
                  <Text className="text-sm font-semibold text-slate-600">Đóng</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-row items-center gap-1.5 px-5 py-3 rounded-xl min-h-[48px] justify-center ${
                    hasNoPendingResult ? 'bg-slate-300' : rejectAll ? 'bg-red-600' : 'bg-primary'
                  } ${isSubmitting ? 'opacity-50' : ''}`}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Feather
                        name={rejectAll ? 'x-circle' : 'check-circle'}
                        size={14}
                        color="#FFFFFF"
                      />
                      <Text className="text-sm font-bold text-white">
                        {hasNoPendingResult
                          ? 'Không còn kết quả cần duyệt'
                          : rejectAll
                            ? 'Xác nhận từ chối nghiệm thu'
                            : 'Xác nhận phê duyệt'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
