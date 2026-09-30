import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  TextInput,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  usePaymentRequestDetailQuery,
  useSubmitPaymentRequestMutation,
  useDeletePaymentRequestMutation,
  useReviewPaymentRequestMutation,
  useBodDecidePaymentRequestMutation,
  usePayPaymentRequestMutation,
  useCancelPaymentRequestMutation,
  useSupplementPaymentRequestMutation,
  useUpdatePaymentRequestMutation,
} from '@/hooks/queries/usePaymentRequests';
import {
  APPROVAL_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  PAYMENT_REQUEST_TYPE_LABELS,
  paymentRequestService,
} from '@/services/paymentRequestService';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  formatVND,
  formatDateToDDMMYYYY,
  formatNumberInput,
  parseNumberInput,
} from '@/utils/formatters';
import { InvoiceUploadPicker, UploadedFileItem } from '@/components/payment-requests/InvoiceUploadPicker';
import { DatePickerModal } from '@/components/common/DatePickerModal';

export default function PaymentRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((state) => state.user);

  const { data: request, isLoading, error, refetch } = usePaymentRequestDetailQuery(id);

  // Mutations
  const submitMutation = useSubmitPaymentRequestMutation();
  const deleteMutation = useDeletePaymentRequestMutation();
  const reviewMutation = useReviewPaymentRequestMutation();
  const bodDecideMutation = useBodDecidePaymentRequestMutation();
  const payMutation = usePayPaymentRequestMutation();
  const cancelMutation = useCancelPaymentRequestMutation();
  const supplementMutation = useSupplementPaymentRequestMutation();
  const updateMutation = useUpdatePaymentRequestMutation();

  // Dialog State for Action Notes
  const [modalAction, setModalAction] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionContent, setActionContent] = useState('');
  const [actionAmount, setActionAmount] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');
  const [actionFiles, setActionFiles] = useState<UploadedFileItem[]>([]);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#F38820" />
        <Text style={{ marginTop: 12, fontSize: 14, color: '#64748B' }}>Đang tải chi tiết đề xuất...</Text>
      </View>
    );
  }

  if (error || !request) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Feather name="alert-circle" size={44} color="#EF4444" />
        <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
          Không tìm thấy đề xuất thanh toán
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 16,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: '#F38820',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const approvalCfg = APPROVAL_STATUS_CONFIG[request.approvalStatus] || {
    text: request.approvalStatus,
    color: '#64748B',
    bg: '#F1F5F9',
    border: '#E2E8F0',
  };

  const paymentCfg = PAYMENT_STATUS_CONFIG[request.paymentStatus] || {
    text: request.paymentStatus,
    color: '#94A3B8',
    bg: '#F8FAFC',
    border: '#E2E8F0',
  };

  // RBAC Privileges (Single source of truth theo Master Plan)
  const userRole = (currentUser?.role || '').toUpperCase();
  const isOwner = currentUser?.id === (request.requesterId || request.createdById);
  const isBOD = ['ADMIN', 'DIRECTOR', 'BOD'].includes(userRole);
  const isReviewer = ['ADMIN', 'DIRECTOR', 'BOD', 'ADMIN_SALE', 'MANAGER'].includes(userRole);
  const isAccountant = ['ADMIN', 'DIRECTOR', 'BOD', 'ACCOUNTANT'].includes(userRole);

  // Handlers
  const handleDeleteDraft = async () => {
    Alert.alert('Xóa đề xuất', 'Bạn có chắc chắn muốn xóa bản nháp đề xuất này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync(request.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            router.back();
          } catch (err: any) {
            Alert.alert('Lỗi', err?.message || 'Không thể xóa đề xuất.');
          }
        },
      },
    ]);
  };

  const openActionModal = (action: string) => {
    if (request) {
      setActionContent(request.content || request.reason || request.title || '');
      setActionAmount(formatNumberInput(request.amount));
      setActionDueDate(request.confirmedDueDate || request.dueDate || '');
    }
    setActionFiles([]);
    setActionNote('');
    setModalAction(action);
  };

  const handleReviewAction = (action: 'APPROVE' | 'REQUEST_MORE_DOCS' | 'REJECT') => {
    openActionModal(action);
  };

  const resetActionModal = () => {
    setModalAction(null);
    setActionNote('');
    setActionFiles([]);
    if (request) {
      setActionContent(request.content || request.reason || request.title || '');
      setActionAmount(formatNumberInput(request.amount));
      setActionDueDate(request.confirmedDueDate || request.dueDate || '');
    }
  };

  const uploadActionFiles = async () => {
    const uploaded: any[] = [];
    for (const file of actionFiles) {
      const formData = new FormData();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (formData as any).append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type || 'application/octet-stream',
      });
      const response = await paymentRequestService.uploadPaymentRequestInvoiceFile(formData);
      if (response.error || !response.data) {
        throw new Error(response.error || `Không thể tải tệp ${file.name}`);
      }
      uploaded.push({
        ...(response.data as any),
        name: (response.data as any).name || file.name,
        fileType: file.type?.includes('pdf') ? 'PDF' : 'IMAGE',
      });
    }
    return uploaded;
  };

  const executeModalAction = async () => {
    if (!modalAction) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      if (['REJECT', 'REQUEST_MORE_DOCS', 'BOD_REJECT'].includes(modalAction) && !actionNote.trim()) {
        Alert.alert('Thiếu thông tin', 'Vui lòng nhập lý do trước khi xác nhận.');
        return;
      }

      if (['DRAFT_SUBMIT', 'SUPPLEMENT'].includes(modalAction)) {
        const amount = parseNumberInput(actionAmount);
        if (!actionContent.trim() || amount <= 0 || !actionDueDate) {
          Alert.alert('Thiếu thông tin', 'Vui lòng nhập nội dung, số tiền và thời hạn thanh toán.');
          return;
        }

        if (modalAction === 'DRAFT_SUBMIT') {
          await updateMutation.mutateAsync({
            id: request.id,
            content: actionContent.trim(),
            amount,
            dueDate: actionDueDate,
          });
          await submitMutation.mutateAsync(request.id);
        } else {
          setIsUploading(true);
          const uploaded = await uploadActionFiles();
          await supplementMutation.mutateAsync({
            id: request.id,
            content: actionContent.trim(),
            amount,
            dueDate: actionDueDate,
            note: actionNote.trim() || undefined,
            addInvoiceImages: uploaded.filter((file) => file.fileType === 'IMAGE'),
            addInvoicePdfs: uploaded.filter((file) => file.fileType === 'PDF'),
          });
        }
      } else if (['APPROVE', 'REQUEST_MORE_DOCS', 'REJECT'].includes(modalAction)) {
        await reviewMutation.mutateAsync({
          id: request.id,
          action: modalAction,
          note: actionNote.trim() || undefined,
        });
      } else if (modalAction === 'BOD_APPROVE') {
        if (!actionDueDate) {
          Alert.alert('Thiếu thời hạn', 'Vui lòng xác nhận hạn thanh toán trước khi phê duyệt.');
          return;
        }
        await bodDecideMutation.mutateAsync({
          id: request.id,
          action: 'APPROVE',
          reason: actionNote.trim() || undefined,
          confirmedDueDate: actionDueDate,
        });
      } else if (modalAction === 'BOD_REJECT') {
        await bodDecideMutation.mutateAsync({
          id: request.id,
          action: 'REJECT',
          reason: actionNote.trim() || undefined,
        });
      } else if (modalAction === 'PAY') {
        if (actionFiles.length === 0) {
          Alert.alert('Thiếu minh chứng', 'Vui lòng tải lên ảnh hoặc PDF minh chứng đã chi tiền.');
          return;
        }
        setIsUploading(true);
        const paymentProofs = await uploadActionFiles();
        await payMutation.mutateAsync({
          id: request.id,
          paymentProofs,
          note: actionNote.trim() || undefined,
        });
      } else if (modalAction === 'CANCEL') {
        await cancelMutation.mutateAsync({
          id: request.id,
          reason: actionNote.trim() || undefined,
        });
      }

      resetActionModal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Thành công', 'Thao tác phê duyệt đã được ghi nhận!');
      refetch();
    } catch (err: any) {
      Alert.alert('Thất bại', err?.message || 'Không thể xử lý yêu cầu.');
    } finally {
      setIsUploading(false);
    }
  };

  const isPendingReview = request.approvalStatus === 'PENDING_REVIEWER';
  const isPendingBOD = request.approvalStatus === 'PENDING_BOD';
  const isApproved = request.approvalStatus === 'APPROVED';
  const isPaid = request.paymentStatus === 'PAID';
  const isDraft = request.approvalStatus === 'DRAFT';
  const needsMoreDocs = request.approvalStatus === 'NEED_MORE_DOCS';
  const invoiceFiles = [
    ...(request.invoiceImages || []),
    ...(request.invoicePdfs || []),
    ...(request.invoiceFiles || []),
  ];

  const hasAnyAction =
    ((isDraft || needsMoreDocs) && isOwner) ||
    (isPendingReview && isReviewer) ||
    (isPendingBOD && isBOD) ||
    (isApproved && !isPaid && isAccountant);

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View
        style={{
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>
              {request.code || `PR-${request.id?.substring(0, 6)?.toUpperCase()}`}
            </Text>
            <Text style={{ fontSize: 11, color: '#64748B' }}>
              Ngày tạo: {formatDateToDDMMYYYY(request.createdAt)}
            </Text>
          </View>
        </View>

        {/* Dual Badges in Header */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
              backgroundColor: approvalCfg.bg,
              borderWidth: 1,
              borderColor: approvalCfg.border,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: approvalCfg.color }}>
              {approvalCfg.text}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: hasAnyAction ? 110 : 40 }}
        showsVerticalScrollIndicator
      >
        {/* Big Amount Card */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>
            Số tiền đề xuất chi
          </Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#F38820', marginTop: 4 }}>
            {formatVND(request.amount)}
          </Text>

          {/* Payment Status Pill */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginTop: 8,
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 12,
              backgroundColor: paymentCfg.bg,
              borderWidth: 1,
              borderColor: paymentCfg.border,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: paymentCfg.color }}>
              {paymentCfg.text}
            </Text>
          </View>
        </View>

        {/* General Info Card */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            padding: 16,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 12 }}>
            Thông Tin Chung
          </Text>

          {/* Title */}
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Tiêu đề đề xuất</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A' }}>
              {request.content || request.title || 'Chưa cập nhật nội dung'}
            </Text>
          </View>

          {/* Type */}
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Phân loại</Text>
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#334155' }}>
              {PAYMENT_REQUEST_TYPE_LABELS[request.type] || request.type}
            </Text>
          </View>

          {/* Project / Contract */}
          {request.project?.name && (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Dự án liên quan</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#2563EB' }}>
                {request.project.name}
              </Text>
            </View>
          )}

          {request.vendor?.name && (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Nhà cung cấp</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>{request.vendor.name}</Text>
              {(request.costPrice !== undefined || request.vendorCost !== undefined) && (
                <Text style={{ marginTop: 2, fontSize: 12, color: '#F38820', fontWeight: '700' }}>
                  Giá vốn công việc: {formatVND(request.costPrice ?? request.vendorCost)}
                </Text>
              )}
            </View>
          )}

          {(request.confirmedDueDate || request.dueDate) && (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>
                {request.confirmedDueDate ? 'Hạn thanh toán (BOD xác nhận)' : 'Hạn thanh toán'}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>
                {formatDateToDDMMYYYY(request.confirmedDueDate || request.dueDate)}
              </Text>
            </View>
          )}

          {/* Requester */}
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Người đề xuất</Text>
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#334155' }}>
              {request.requester?.fullName || request.requestedBy?.fullName || 'Không xác định'}
            </Text>
          </View>

          {/* Reason */}
          {request.reason ? (
            <View>
              <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Lý do chi</Text>
              <Text style={{ fontSize: 13, color: '#475569', lineHeight: 18 }}>{request.reason}</Text>
            </View>
          ) : null}
        </View>

        {(request.paidAt || (request.paymentProofs?.length || 0) > 0) && (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: 16,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: '#BBF7D0',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#166534', marginBottom: 10 }}>
              Minh Chứng Thanh Toán ({request.paymentProofs?.length || 0})
            </Text>
            {request.paidAt && (
              <Text style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>
                Ngày chi: <Text style={{ fontWeight: '700' }}>{formatDateToDDMMYYYY(request.paidAt)}</Text>
              </Text>
            )}
            <View style={{ gap: 8 }}>
              {(request.paymentProofs || []).map((file, index) => (
                <TouchableOpacity
                  key={file.id || file.url || index}
                  onPress={() => file.url && Linking.openURL(file.url)}
                  accessibilityRole="button"
                  accessibilityLabel={`Mở minh chứng thanh toán ${file.name || index + 1}`}
                  style={{
                    minHeight: 48,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    backgroundColor: '#F0FDF4',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#BBF7D0',
                  }}
                >
                  <Feather name="check-circle" size={18} color="#16A34A" />
                  <Text numberOfLines={1} style={{ flex: 1, marginLeft: 8, fontSize: 13, color: '#166534' }}>
                    {file.name || `Minh chứng ${index + 1}`}
                  </Text>
                  <Feather name="external-link" size={15} color="#16A34A" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Beneficiary Card */}
        {(request.beneficiaryName || request.beneficiaryAccount) && (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: 16,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 10 }}>
              Tài Khoản Thụ Hưởng
            </Text>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, color: '#334155' }}>
                Đơn vị / Người nhận:{' '}
                <Text style={{ fontWeight: '700', color: '#0F172A' }}>{request.beneficiaryName}</Text>
              </Text>
              <Text style={{ fontSize: 13, color: '#334155' }}>
                Số tài khoản:{' '}
                <Text style={{ fontWeight: '700', color: '#F38820' }}>{request.beneficiaryAccount}</Text>
              </Text>
              {request.beneficiaryBank && (
                <Text style={{ fontSize: 13, color: '#64748B' }}>
                  Ngân hàng: {request.beneficiaryBank}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Invoice Attachments */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            padding: 16,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: '#E2E8F0',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 10 }}>
            Hóa Đơn / Chứng Từ Đính Kèm ({invoiceFiles.length})
          </Text>

          {invoiceFiles.length === 0 ? (
            <Text style={{ fontSize: 12, color: '#94A3B8' }}>Không có tài liệu đính kèm.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {invoiceFiles.map((file, idx) => (
                <TouchableOpacity
                  key={file.id || file.url}
                  onPress={() => file.url && Linking.openURL(file.url)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 10,
                    backgroundColor: '#F8FAFC',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                  }}
                >
                  <MaterialIcons name="insert-drive-file" size={20} color="#F38820" />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: '#0F172A', marginLeft: 8 }}>
                    {file.name || `Tài liệu đính kèm ${idx + 1}`}
                  </Text>
                  <Feather name="external-link" size={14} color="#64748B" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* History / Timeline if any */}
        {request.history && request.history.length > 0 && (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              padding: 16,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 12 }}>
              Lịch Sử Phê Duyệt
            </Text>

            <View style={{ gap: 12 }}>
              {request.history.map((h, i) => (
                <View key={h.id || `${h.action}-${h.createdAt}`} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: '#F38820',
                        marginTop: 4,
                      }}
                    />
                    {i !== request.history!.length - 1 && (
                      <View style={{ width: 1, flex: 1, backgroundColor: '#E2E8F0', marginTop: 4 }} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>
                      {h.action}
                    </Text>
                    {h.note && (
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{h.note}</Text>
                    )}
                    <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                      {h.actor?.fullName} • {formatDateToDDMMYYYY(h.createdAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* RBAC Bottom Sticky Action Bar (Thumb Zone) */}
      {hasAnyAction && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 16),
            borderTopWidth: 1,
            borderTopColor: '#F1F5F9',
            flexDirection: 'row',
            gap: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 10,
          }}
        >
          {/* Draft Actions */}
          {isDraft && isOwner && (
            <>
              <TouchableOpacity
                onPress={handleDeleteDraft}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#FECACA',
                  backgroundColor: '#FEF2F2',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#DC2626' }}>Xóa nháp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openActionModal('DRAFT_SUBMIT')}
                style={{
                  flex: 2,
                  height: 48,
                  borderRadius: 10,
                  backgroundColor: '#F38820',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
                  {request.isAutoGenerated ? 'Kiểm tra & gửi duyệt' : 'Sửa & gửi duyệt'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {needsMoreDocs && isOwner && (
            <TouchableOpacity
              onPress={() => openActionModal('SUPPLEMENT')}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 10,
                backgroundColor: '#F38820',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Bổ sung hồ sơ</Text>
            </TouchableOpacity>
          )}

          {/* Reviewer / Admin Sale Actions */}
          {isPendingReview && isReviewer && (
            <>
              <TouchableOpacity
                onPress={() => handleReviewAction('REQUEST_MORE_DOCS')}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#FED7AA',
                  backgroundColor: '#FFF7ED',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#EA580C' }}>Yêu cầu bổ sung</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleReviewAction('APPROVE')}
                style={{
                  flex: 1.5,
                  height: 48,
                  borderRadius: 10,
                  backgroundColor: '#16A34A',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Duyệt đề xuất</Text>
              </TouchableOpacity>
            </>
          )}

          {/* BOD Actions */}
          {isPendingBOD && isBOD && (
            <>
              <TouchableOpacity
                onPress={() => openActionModal('BOD_REJECT')}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#FECACA',
                  backgroundColor: '#FEF2F2',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#DC2626' }}>Từ chối</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openActionModal('BOD_APPROVE')}
                style={{
                  flex: 1.5,
                  height: 48,
                  borderRadius: 10,
                  backgroundColor: '#16A34A',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>BOD Phê Duyệt</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Accountant Payment Action */}
          {isApproved && !isPaid && isAccountant && (
            <TouchableOpacity
              onPress={() => openActionModal('PAY')}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 10,
                backgroundColor: '#F38820',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
                Xác Nhận Chi Tiền
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Action Dialog / Note Modal */}
      {modalAction && (
        <Modal visible transparent animationType="slide" onRequestClose={resetActionModal}>
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              justifyContent: 'flex-end',
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                backgroundColor: '#FFFFFF',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 20,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
              }}
              style={{
                maxHeight: '88%',
              }}
            >
              <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 16 }} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>
                {modalAction === 'DRAFT_SUBMIT'
                  ? request.isAutoGenerated ? 'Kiểm tra nháp tự sinh' : 'Sửa bản nháp'
                  : modalAction === 'SUPPLEMENT'
                  ? 'Bổ sung hồ sơ theo yêu cầu'
                  : modalAction === 'APPROVE'
                  ? 'Ghi chú duyệt đề xuất'
                  : modalAction === 'REQUEST_MORE_DOCS'
                  ? 'Nội dung yêu cầu bổ sung'
                  : modalAction === 'BOD_APPROVE'
                  ? 'Xác nhận phê duyệt (BOD)'
                  : modalAction === 'BOD_REJECT'
                  ? 'Lý do từ chối'
                  : 'Ghi chú thao tác'}
              </Text>

              {['DRAFT_SUBMIT', 'SUPPLEMENT'].includes(modalAction) && (
                <View style={{ gap: 12, marginBottom: 14 }}>
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>Nội dung chi *</Text>
                    <TextInput
                      value={actionContent}
                      onChangeText={setActionContent}
                      placeholder="Nhập nội dung đề xuất"
                      multiline
                      style={{ minHeight: 76, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 12, textAlignVertical: 'top', color: '#0F172A' }}
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>Số tiền *</Text>
                    <TextInput
                      value={actionAmount}
                      onChangeText={(value) => setActionAmount(formatNumberInput(value))}
                      keyboardType="numeric"
                      placeholder="0"
                      style={{ minHeight: 48, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, color: '#0F172A', fontWeight: '700' }}
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>Thời hạn thanh toán *</Text>
                    <TouchableOpacity
                      onPress={() => setDatePickerVisible(true)}
                      accessibilityRole="button"
                      style={{ minHeight: 48, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Text style={{ color: actionDueDate ? '#0F172A' : '#94A3B8' }}>
                        {actionDueDate ? formatDateToDDMMYYYY(actionDueDate) : 'Chọn ngày'}
                      </Text>
                      <Feather name="calendar" size={18} color="#F38820" />
                    </TouchableOpacity>
                  </View>
                  {modalAction === 'SUPPLEMENT' && (
                    <InvoiceUploadPicker files={actionFiles} onChange={setActionFiles} maxFiles={5} />
                  )}
                </View>
              )}

              {modalAction === 'BOD_APPROVE' && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>Hạn thanh toán BOD xác nhận *</Text>
                  <TouchableOpacity
                    onPress={() => setDatePickerVisible(true)}
                    style={{ minHeight: 48, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Text style={{ color: actionDueDate ? '#0F172A' : '#94A3B8' }}>
                      {actionDueDate ? formatDateToDDMMYYYY(actionDueDate) : 'Chọn ngày'}
                    </Text>
                    <Feather name="calendar" size={18} color="#F38820" />
                  </TouchableOpacity>
                </View>
              )}

              {modalAction === 'PAY' && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 12, color: '#64748B', lineHeight: 18 }}>
                    Minh chứng ảnh/PDF là bắt buộc trước khi xác nhận đã chi tiền.
                  </Text>
                  <InvoiceUploadPicker files={actionFiles} onChange={setActionFiles} maxFiles={5} />
                </View>
              )}

              <TextInput
                value={actionNote}
                onChangeText={setActionNote}
                placeholder={['REJECT', 'REQUEST_MORE_DOCS', 'BOD_REJECT'].includes(modalAction) ? 'Nhập lý do bắt buộc...' : 'Nhập ghi chú nếu có...'}
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                style={{
                  minHeight: 70,
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 13,
                  color: '#0F172A',
                  textAlignVertical: 'top',
                  marginBottom: 16,
                }}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    resetActionModal();
                  }}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#475569' }}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={executeModalAction}
                  disabled={isUploading || supplementMutation.isPending || updateMutation.isPending || payMutation.isPending}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 8,
                    backgroundColor: modalAction.includes('REJECT') ? '#DC2626' : '#F38820',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {(isUploading || supplementMutation.isPending || updateMutation.isPending || payMutation.isPending) ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>Xác nhận</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}
      <DatePickerModal
        visible={datePickerVisible}
        title="Chọn hạn thanh toán"
        initialDate={actionDueDate}
        onClose={() => setDatePickerVisible(false)}
        onConfirm={(_, apiDate) => {
          setActionDueDate(apiDate);
          setDatePickerVisible(false);
        }}
      />
    </View>
  );
}
