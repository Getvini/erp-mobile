import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Linking,
  Modal,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import {
  ProductDescriptionSubmission,
  ProductDescriptionItem,
} from '@/services/productDescriptionService';
import { uploadToCloudinary } from '@/services/cloudinaryService';
import { BrandColors } from '@/constants/colors';
import {
  useProductDescriptionsQuery,
  useCreateProductDescriptionMutation,
  useUpdateProductDescriptionMutation,
  useSubmitProductDescriptionMutation,
  useApproveProductDescriptionMutation,
  useRejectProductDescriptionMutation,
  useExtractProductDescriptionFileMutation,
  useAiFormatProductDescriptionMutation,
} from '@/hooks/queries/useProjects';
import { useAuthStore } from '@/stores/useAuthStore';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PENDING_REVIEW: 'Chờ PM duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Không duyệt',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  DRAFT: { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
  PENDING_REVIEW: { bg: '#FFF7ED', text: '#C2410C', border: '#FFEDD5' },
  APPROVED: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  REJECTED: { bg: '#FFE4E6', text: '#BE123C', border: '#FECDD3' },
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Chưa có';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
};

interface FormProductItem {
  id?: string | null;
  productName: string;
  fileUrl: string;
  fileName: string | null;
  extractedText: string;
  note: string;
  documents: { url: string; name?: string | null }[];
  collapsed?: boolean;
  docUploading?: boolean;
  docUploadProgress?: number;
  extracting?: boolean;
  hasComplexLayout?: boolean;
  aiFormatting?: boolean;
  docsUploading?: boolean;
}

const emptyProduct = (): FormProductItem => ({
  id: null,
  productName: '',
  fileUrl: '',
  fileName: null,
  extractedText: '',
  note: '',
  documents: [],
  collapsed: false,
});

const toEditableProduct = (item: ProductDescriptionItem): FormProductItem => ({
  id: item.id || null,
  productName: item.productName || '',
  fileUrl: item.fileUrl || '',
  fileName: item.fileName || null,
  extractedText: item.extractedText || '',
  note: item.note || '',
  documents: Array.isArray(item.documents)
    ? item.documents.map((d) => ({ url: d.url, name: d.name ?? null }))
    : [],
  collapsed: false,
});

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissions: ProductDescriptionSubmission[];
  canEditSubmission: boolean;
  onEdit: (submission: ProductDescriptionSubmission) => void;
  onOpenUrl: (url?: string) => void;
}

const ProductDescriptionHistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  submissions,
  canEditSubmission,
  onEdit,
  onOpenUrl,
}) => {
  const sortedSubmissions = useMemo(() => {
    return [...submissions]
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [submissions]);

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-900/60 justify-end">
        <View className="bg-surface rounded-t-3xl p-4 max-h-[85%]">
          <View className="flex-row items-center justify-between border-b border-border pb-3 mb-3">
            <View className="flex-row items-center">
              <Feather name="clock" size={17} color={BrandColors.primary} style={{ marginRight: 8 }} />
              <Text className="text-base font-bold text-text-primary">
                Lịch sử mô tả sản phẩm ({submissions.length})
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center">
              <Feather name="x" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView className="mb-2" showsVerticalScrollIndicator={false}>
            <View className="gap-3 py-1">
              {sortedSubmissions.length > 0 ? (
                sortedSubmissions.map((sub) => {
                  const statusConfig = STATUS_COLORS[sub.status] || STATUS_COLORS.DRAFT;
                  return (
                    <View key={sub.id} className="bg-slate-50/70 rounded-xl p-3.5 border border-border gap-2.5">
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1 mr-2">
                          <View className="flex-row items-center gap-2 flex-wrap mb-1.5">
                            <Text className="text-sm font-bold text-text-primary">
                              {sub.versionNumber ? `Version ${sub.versionNumber}` : 'Bản gửi'}
                            </Text>
                            <View
                              className="px-2 py-0.5 rounded-md border"
                              style={{ backgroundColor: statusConfig.bg, borderColor: statusConfig.border }}
                            >
                              <Text className="text-[10px] font-bold" style={{ color: statusConfig.text }}>
                                {STATUS_LABELS[sub.status] || sub.status}
                              </Text>
                            </View>
                          </View>

                          <View className="gap-0.5">
                            <Text className="text-[11px] text-text-secondary">
                              Người tạo: <Text className="font-bold text-text-primary">{sub.createdBy?.fullName || 'Không xác định'}</Text>
                            </Text>
                            <Text className="text-[11px] text-text-secondary">
                              Thời điểm tạo: <Text className="font-bold text-text-primary">{formatDateTime(sub.createdAt)}</Text>
                            </Text>
                            {sub.reviewedBy && (
                              <Text className="text-[11px] text-text-secondary">
                                Người duyệt: <Text className="font-bold text-text-primary">{sub.reviewedBy.fullName}</Text>
                              </Text>
                            )}
                            {sub.reviewedAt && (
                              <Text className="text-[11px] text-text-secondary">
                                Thời điểm duyệt: <Text className="font-bold text-text-primary">{formatDateTime(sub.reviewedAt)}</Text>
                              </Text>
                            )}
                          </View>

                          {sub.reviewNote ? (
                            <View className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200">
                              <Text className="text-xs text-rose-700 italic">
                                Lý do từ chối: {sub.reviewNote}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {canEditSubmission && sub.status === 'REJECTED' && (
                          <TouchableOpacity
                            className="flex-row items-center px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50"
                            onPress={() => {
                              onClose();
                              onEdit(sub);
                            }}
                          >
                            <Feather name="edit-3" size={13} color="#2563EB" />
                            <Text className="text-xs font-bold text-blue-600 ml-1">Sửa</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Items */}
                      <View className="gap-1.5 mt-1">
                        {sub.items?.map((item) => (
                          <View key={item.id} className="bg-white px-3 py-2 rounded-lg border border-border">
                            <Text className="text-xs font-bold text-text-primary mb-1">
                              {item.productName}
                            </Text>
                            {item.fileUrl && (
                              <TouchableOpacity
                                className="flex-row items-center gap-1.5 self-start bg-blue-50 px-2 py-1 rounded-md"
                                onPress={() => onOpenUrl(item.fileUrl)}
                              >
                                <Feather name="file-text" size={12} color="#2563EB" />
                                <Text className="text-[11px] font-semibold text-blue-600" numberOfLines={1}>
                                  {item.fileName || 'Xem file chuẩn'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View className="py-8 items-center justify-center border border-dashed border-border rounded-xl">
                  <Text className="text-xs text-text-muted italic">Chưa có lịch sử mô tả sản phẩm</Text>
                </View>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity
            onPress={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 items-center justify-center"
          >
            <Text className="text-xs font-bold text-text-secondary">Đóng</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

interface ProductDescriptionSectionProps {
  projectId: string;
  project: any;
  user?: any;
}

export const ProductDescriptionSection: React.FC<ProductDescriptionSectionProps> = ({
  projectId,
  project,
}) => {
  const user = useAuthStore((state) => state.user);
  const currentUserId = user?.id || '';
  const userRole = user?.role || '';

  const { data: submissionsRes, isLoading } = useProductDescriptionsQuery(projectId);

  const submissions: ProductDescriptionSubmission[] = useMemo(() => {
    return Array.isArray(submissionsRes) ? submissionsRes : [];
  }, [submissionsRes]);

  const createSubmissionMutation = useCreateProductDescriptionMutation();
  const updateSubmissionMutation = useUpdateProductDescriptionMutation();
  const submitSubmissionMutation = useSubmitProductDescriptionMutation();
  const approveSubmissionMutation = useApproveProductDescriptionMutation();
  const rejectSubmissionMutation = useRejectProductDescriptionMutation();
  const extractFileMutation = useExtractProductDescriptionFileMutation();
  const aiFormatMutation = useAiFormatProductDescriptionMutation();

  const [isSaving, setIsSaving] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  const [products, setProducts] = useState<FormProductItem[]>([emptyProduct()]);
  const [loadedSubmissionId, setLoadedSubmissionId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Reject Modal State
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectSubmissionId, setRejectSubmissionId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const isOnHold = project?.status === 'ON_HOLD' || Boolean(project?.isOnHold);
  const isClosed = ['COMPLETED', 'CANCELLED'].includes(project?.status || '');

  // Active submission: latest approved, pending, or draft
  const activeSubmission = useMemo(() => {
    if (!submissions.length) return null;
    const sorted = [...submissions].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    const approved = sorted.find((s) => s.status === 'APPROVED');
    if (approved) return approved;
    const pending = sorted.find((s) => s.status === 'PENDING_REVIEW');
    if (pending) return pending;
    const draft = sorted.find((s) => s.status === 'DRAFT');
    if (draft) return draft;
    return sorted[0];
  }, [submissions]);

  const hasPendingSubmission = useMemo(() => {
    return submissions.some((s) => s.status === 'PENDING_REVIEW');
  }, [submissions]);

  // Permission evaluation
  const isTeamLead = project?.team?.teamLead?.id === currentUserId;
  const isAccountMember = project?.team?.members?.some((m: any) => {
    const mUserId = m?.user?.id || m?.userId;
    const isUser = mUserId === currentUserId;
    const hasAccountRole =
      m?.role === 'ACCOUNT' || (Array.isArray(m?.roles) && m?.roles.includes('ACCOUNT'));
    return isUser && hasAccountRole;
  });
  const isAccount = Boolean(isTeamLead || isAccountMember);

  const isAssignedPm =
    userRole === 'PM' &&
    project?.team?.members?.some((m: any) => {
      const mUserId = m?.user?.id || m?.userId;
      const isUser = mUserId === currentUserId;
      const hasPmRole =
        m?.role === 'PROJECT_MANAGER' ||
        (Array.isArray(m?.roles) && m?.roles.includes('PROJECT_MANAGER'));
      return isUser && hasPmRole;
    });

  const canManageSubmission =
    !isClosed && (isAccount || isAssignedPm || ['BOD', 'ADMIN'].includes(userRole));
  const canReview = !isClosed && (isAssignedPm || ['BOD', 'ADMIN'].includes(userRole));

  const handleOpenUrl = (url?: string) => {
    if (!url) return;
    const finalUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    Linking.openURL(finalUrl).catch(() => {
      Alert.alert('Lỗi', 'Không thể mở liên kết');
    });
  };

  // Form products management
  const updateProduct = (index: number, patch: Partial<FormProductItem>) => {
    setProducts((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  };

  const addProduct = () => {
    setProducts((prev) => [...prev, emptyProduct()]);
  };

  const removeProduct = (index: number) => {
    if (products.length <= 1) return;
    setProducts((prev) => prev.filter((_, idx) => idx !== index));
  };

  const toggleProductCollapsed = (index: number) => {
    setProducts((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, collapsed: !item.collapsed } : item))
    );
  };

  // Pick & Upload standard file (doc/pdf) -> auto extract text
  const handleDocFileChange = async (productIndex: number) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const file = res.assets[0];
      updateProduct(productIndex, { docUploading: true, docUploadProgress: 0 });

      const uploaded = await uploadToCloudinary(
        file,
        'GETVINI/ERP/product-description',
        (progress) => updateProduct(productIndex, { docUploadProgress: progress })
      );

      updateProduct(productIndex, {
        fileUrl: uploaded.url,
        fileName: file.name,
        docUploading: false,
        docUploadProgress: 0,
        extracting: true,
      });

      try {
        const result = await extractFileMutation.mutateAsync({
          projectId,
          fileUrl: uploaded.url,
        });

        updateProduct(productIndex, {
          extractedText: result?.extractedText || '',
          hasComplexLayout: Boolean(result?.hasComplexLayout),
          extracting: false,
        });

        if (result?.hasComplexLayout) {
          Alert.alert(
            'Lưu ý cấu trúc file',
            'File có nhiều cột/bảng phức tạp, nội dung trích xuất bên dưới có thể bị sai thứ tự hoặc thiếu sót. Vui lòng kiểm tra kỹ và chỉnh sửa trước khi gửi duyệt.'
          );
        }
      } catch (extractErr: any) {
        updateProduct(productIndex, { extracting: false });
        Alert.alert('Lỗi trích xuất', extractErr.message || 'Trích xuất nội dung file thất bại');
      }
    } catch (err: any) {
      updateProduct(productIndex, { docUploading: false, docUploadProgress: 0 });
      Alert.alert('Lỗi tải file', err.message || 'Tải file lên thất bại');
    }
  };

  // Trigger AI formatting
  const handleAiFormat = async (productIndex: number) => {
    const prod = products[productIndex];
    if (!prod.extractedText.trim()) {
      Alert.alert('Thông báo', 'Chưa có nội dung trích xuất để format');
      return;
    }

    updateProduct(productIndex, { aiFormatting: true });
    try {
      const result = await aiFormatMutation.mutateAsync({
        projectId,
        text: prod.extractedText,
        productName: prod.productName,
      });

      updateProduct(productIndex, {
        extractedText: result?.extractedText || prod.extractedText,
        aiFormatting: false,
      });
      Alert.alert('Thành công', 'Đã định dạng nội dung bằng AI');
    } catch (err: any) {
      updateProduct(productIndex, { aiFormatting: false });
      Alert.alert('Lỗi AI formatting', err.message || 'AI formatting thất bại');
    }
  };

  // Supplementary documents
  const handlePickSupplementaryDoc = async (productIndex: number) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'image/*',
        ],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const file = res.assets[0];
      updateProduct(productIndex, { docsUploading: true });

      const uploaded = await uploadToCloudinary(
        file,
        'GETVINI/ERP/product-description/attachments'
      );

      const prod = products[productIndex];
      const newDocs = [...prod.documents, { url: uploaded.url, name: file.name }];

      updateProduct(productIndex, {
        documents: newDocs,
        docsUploading: false,
      });
    } catch (err: any) {
      updateProduct(productIndex, { docsUploading: false });
      Alert.alert('Lỗi tải tài liệu', err.message || 'Tải tài liệu bổ sung thất bại');
    }
  };

  const removeSupplementaryDoc = (productIndex: number, docIndex: number) => {
    const prod = products[productIndex];
    const newDocs = prod.documents.filter((_, idx) => idx !== docIndex);
    updateProduct(productIndex, { documents: newDocs });
  };

  // Open Form
  const openCreateForm = () => {
    if (isClosed) {
      Alert.alert('Thông báo', 'Dự án đã hoàn tất hoặc đã đóng, không thể tạo bản gửi.');
      return;
    }
    if (isOnHold) {
      Alert.alert('Thông báo', 'Dự án đang tạm dừng, không thể tạo bản gửi.');
      return;
    }
    setProducts([emptyProduct()]);
    setLoadedSubmissionId(null);
    setIsFormOpen(true);
  };

  const openEditForm = (submission: ProductDescriptionSubmission) => {
    if (isClosed) {
      Alert.alert('Thông báo', 'Dự án đã hoàn tất hoặc đã đóng, không thể chỉnh sửa.');
      return;
    }
    if (isOnHold) {
      Alert.alert('Thông báo', 'Dự án đang tạm dừng, không thể chỉnh sửa.');
      return;
    }
    const editableItems = Array.isArray(submission.items) ? submission.items : [];
    setProducts(editableItems.length ? editableItems.map(toEditableProduct) : [emptyProduct()]);
    setLoadedSubmissionId(submission.id);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setProducts([emptyProduct()]);
    setLoadedSubmissionId(null);
    setIsFormOpen(false);
  };

  const buildPayload = () => {
    const normalized = products.map((product, index) => {
      const productName = product.productName.trim();
      if (!productName) {
        throw new Error(`Dòng ${index + 1}: Vui lòng nhập tên sản phẩm`);
      }
      const fileUrl = product.fileUrl.trim();
      if (!fileUrl) {
        throw new Error(`Sản phẩm "${productName}": Vui lòng upload file thông tin chuẩn (doc/pdf)`);
      }

      return {
        id: product.id,
        productName,
        fileUrl,
        fileName: product.fileName || null,
        extractedText: product.extractedText || null,
        note: product.note.trim() || undefined,
        documents: Array.isArray(product.documents) ? product.documents : [],
      };
    });

    return { items: normalized };
  };

  const handleSaveDraft = async () => {
    if (isClosed || isOnHold) return;
    try {
      const payload = buildPayload();
      setIsSaving(true);

      if (activeSubmission?.status === 'REJECTED') {
        const created = await createSubmissionMutation.mutateAsync({
          projectId,
          payload,
        });
        if (created?.id) {
          setLoadedSubmissionId(created.id);
        }
        Alert.alert('Thành công', 'Đã tạo bản nháp mới từ bản không duyệt');
      } else if (loadedSubmissionId || (activeSubmission && activeSubmission.status === 'DRAFT')) {
        const targetId = loadedSubmissionId || activeSubmission!.id;
        await updateSubmissionMutation.mutateAsync({
          projectId,
          submissionId: targetId,
          payload,
        });
        Alert.alert('Thành công', 'Đã cập nhật bản mô tả sản phẩm');
      } else {
        const created = await createSubmissionMutation.mutateAsync({
          projectId,
          payload,
        });
        if (created?.id) {
          setLoadedSubmissionId(created.id);
        }
        Alert.alert('Thành công', 'Đã tạo bản mô tả sản phẩm');
      }
      setIsFormOpen(false);
    } catch (err: any) {
      Alert.alert('Lỗi lưu nháp', err.message || 'Có lỗi xảy ra khi lưu');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (isClosed || isOnHold) return;
    try {
      const payload = buildPayload();
      setIsSaving(true);

      if (activeSubmission?.status === 'REJECTED') {
        const saved = await createSubmissionMutation.mutateAsync({
          projectId,
          payload,
        });
        if (saved?.id) {
          await submitSubmissionMutation.mutateAsync({
            projectId,
            submissionId: saved.id,
          });
        }
      } else if (loadedSubmissionId || (activeSubmission && activeSubmission.status === 'DRAFT')) {
        const targetId = loadedSubmissionId || activeSubmission!.id;
        await updateSubmissionMutation.mutateAsync({
          projectId,
          submissionId: targetId,
          payload,
        });
        await submitSubmissionMutation.mutateAsync({
          projectId,
          submissionId: targetId,
        });
      } else {
        const saved = await createSubmissionMutation.mutateAsync({
          projectId,
          payload,
        });
        if (saved?.id) {
          await submitSubmissionMutation.mutateAsync({
            projectId,
            submissionId: saved.id,
          });
        }
      }

      Alert.alert('Thành công', 'Đã gửi bản mô tả sản phẩm cho PM duyệt!');
      setIsFormOpen(false);
    } catch (err: any) {
      Alert.alert('Lỗi gửi duyệt', err.message || 'Có lỗi xảy ra khi gửi PM duyệt');
    } finally {
      setIsSaving(false);
    }
  };

  // PM Review handlers
  const handleApprove = (submissionId: string) => {
    Alert.alert(
      'Xác nhận duyệt',
      'Bạn có chắc chắn muốn duyệt bản thông tin chuẩn sản phẩm này không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Duyệt',
          style: 'default',
          onPress: async () => {
            setIsReviewing(true);
            try {
              await approveSubmissionMutation.mutateAsync({
                projectId,
                submissionId,
              });
              Alert.alert('Thành công', 'Đã duyệt thông tin chuẩn sản phẩm thành công!');
            } catch (err: any) {
              Alert.alert('Lỗi duyệt', err.message || 'Có lỗi xảy ra khi duyệt');
            } finally {
              setIsReviewing(false);
            }
          },
        },
      ]
    );
  };

  const openRejectModal = (submissionId: string) => {
    setRejectSubmissionId(submissionId);
    setReviewNote('');
    setRejectModalVisible(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectSubmissionId) return;
    if (!reviewNote.trim()) {
      Alert.alert('Thiếu lý do', 'Vui lòng nhập lý do không duyệt để người gửi chỉnh sửa');
      return;
    }

    setIsReviewing(true);
    try {
      await rejectSubmissionMutation.mutateAsync({
        projectId,
        submissionId: rejectSubmissionId,
        reviewNote: reviewNote.trim(),
      });
      setRejectModalVisible(false);
      Alert.alert('Thành công', 'Đã từ chối bản mô tả sản phẩm');
    } catch (err: any) {
      Alert.alert('Lỗi từ chối', err.message || 'Có lỗi xảy ra khi từ chối');
    } finally {
      setIsReviewing(false);
    }
  };

  if (isLoading) {
    return (
      <View className="bg-surface rounded-2xl border border-border p-4 shadow-sm mb-4 items-center justify-center py-6">
        <ActivityIndicator size="small" color={BrandColors.primary} />
        <Text className="text-xs text-text-muted mt-2">Đang tải thông tin sản phẩm...</Text>
      </View>
    );
  }

  return (
    <View className="bg-surface rounded-2xl border border-border p-4 shadow-sm mb-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1 mr-2">
          <View className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center mr-2.5">
            <Feather name="box" size={16} color={BrandColors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-text-primary" numberOfLines={1}>
              Thông tin chuẩn sản phẩm
            </Text>
            <Text className="text-[11px] text-text-muted" numberOfLines={1}>
              Cơ sở đối chiếu bắt buộc khi chạy QC
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-1.5">
          {submissions.length > 0 && (
            <TouchableOpacity
              onPress={() => setIsHistoryOpen(true)}
              className="p-1.5 rounded-lg bg-slate-100 items-center justify-center"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Feather name="clock" size={14} color="#64748B" />
            </TouchableOpacity>
          )}

          {canManageSubmission && !hasPendingSubmission && !isFormOpen && (
            <TouchableOpacity
              onPress={openCreateForm}
              disabled={isOnHold}
              className={`flex-row items-center px-2.5 py-1.5 rounded-xl bg-primary ${
                isOnHold ? 'opacity-50' : 'active:opacity-80'
              }`}
            >
              <Feather name="plus" size={13} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white ml-1">
                {activeSubmission ? 'Bản gửi mới' : 'Tạo bản gửi'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* QC Warning Banner */}
      <View className="mb-3 flex-row items-start p-2.5 rounded-xl bg-amber-50 border border-amber-200">
        <Feather name="alert-triangle" size={14} color="#D97706" style={{ marginTop: 2, marginRight: 6 }} />
        <Text className="text-[11px] text-amber-800 font-medium flex-1 leading-4">
          Đây là các thông tin sẽ được dùng để đối chiếu khi chạy QC. Vui lòng upload đầy đủ file thông tin chuẩn (doc/pdf) cho từng sản phẩm.
        </Text>
      </View>

      {/* Active Submission Card (View Mode) */}
      {activeSubmission ? (
        <View className="p-3.5 rounded-xl border border-border bg-slate-50/50 gap-3">
          {/* Submission Info Bar */}
          <View className="flex-row items-center justify-between flex-wrap gap-2">
            <View className="flex-row items-center gap-2">
              <Text className="text-xs font-bold text-text-primary">
                {activeSubmission.versionNumber ? `Version ${activeSubmission.versionNumber}` : 'Bản hiện tại'}
              </Text>
              <View
                className="px-2 py-0.5 rounded-md border"
                style={{
                  backgroundColor: (STATUS_COLORS[activeSubmission.status] || STATUS_COLORS.DRAFT).bg,
                  borderColor: (STATUS_COLORS[activeSubmission.status] || STATUS_COLORS.DRAFT).border,
                }}
              >
                <Text
                  className="text-[10px] font-bold"
                  style={{ color: (STATUS_COLORS[activeSubmission.status] || STATUS_COLORS.DRAFT).text }}
                >
                  {STATUS_LABELS[activeSubmission.status] || activeSubmission.status}
                </Text>
              </View>
            </View>

            {canManageSubmission &&
              (activeSubmission.status === 'DRAFT' || activeSubmission.status === 'REJECTED') &&
              !isFormOpen && (
                <TouchableOpacity
                  onPress={() => openEditForm(activeSubmission)}
                  disabled={isOnHold}
                  className="flex-row items-center px-2 py-1 rounded-lg bg-blue-50 border border-blue-200"
                >
                  <Feather name="edit-3" size={12} color="#2563EB" />
                  <Text className="text-[11px] font-bold text-blue-600 ml-1">Chỉnh sửa</Text>
                </TouchableOpacity>
              )}
          </View>

          {/* Rejection Notice if any */}
          {activeSubmission.status === 'REJECTED' && activeSubmission.reviewNote && (
            <View className="p-2.5 rounded-lg bg-rose-50 border border-rose-200">
              <Text className="text-xs font-semibold text-rose-800">
                Lý do PM không duyệt: {activeSubmission.reviewNote}
              </Text>
            </View>
          )}

          {/* Products List in Active Submission */}
          <View className="gap-2">
            {(activeSubmission.items || []).map((item, idx) => (
              <View key={item.id || idx} className="p-3 rounded-xl bg-white border border-border gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-text-primary flex-1 mr-2" numberOfLines={1}>
                    {idx + 1}. {item.productName}
                  </Text>
                  {item.fileUrl && (
                    <TouchableOpacity
                      onPress={() => handleOpenUrl(item.fileUrl)}
                      className="flex-row items-center px-2 py-1 rounded-md bg-blue-50 border border-blue-200"
                    >
                      <Feather name="file-text" size={11} color="#2563EB" />
                      <Text className="text-[10px] font-bold text-blue-600 ml-1">Xem file chuẩn</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Extracted Text Snippet */}
                {item.extractedText ? (
                  <View className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <Text className="text-[10px] font-bold text-text-muted uppercase mb-1">
                      Nội dung trích xuất
                    </Text>
                    <Text className="text-xs text-text-secondary leading-4" numberOfLines={4}>
                      {item.extractedText.replace(/<[^>]*>/g, '').trim()}
                    </Text>
                  </View>
                ) : null}

                {/* Notes */}
                {item.note ? (
                  <View className="p-2 rounded-lg bg-amber-50/60 border border-amber-200">
                    <Text className="text-[10px] font-bold text-amber-800 uppercase mb-0.5">
                      Chú thích
                    </Text>
                    <Text className="text-xs text-amber-900">{item.note}</Text>
                  </View>
                ) : null}

                {/* Supplementary Docs */}
                {item.documents && item.documents.length > 0 && (
                  <View className="pt-1">
                    <Text className="text-[10px] font-bold text-text-muted uppercase mb-1">
                      Tài liệu bổ sung ({item.documents.length})
                    </Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {item.documents.map((doc, dIdx) => (
                        <TouchableOpacity
                          key={dIdx}
                          onPress={() => handleOpenUrl(doc.url)}
                          className="flex-row items-center px-2 py-1 rounded-md bg-slate-100 border border-slate-200 max-w-[200px]"
                        >
                          <Feather name="paperclip" size={10} color="#475569" style={{ marginRight: 4 }} />
                          <Text className="text-[10px] text-text-secondary shrink" numberOfLines={1}>
                            {doc.name || 'Tài liệu'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* PM Review Actions */}
          {activeSubmission.status === 'PENDING_REVIEW' && canReview && (
            <View className="flex-row gap-2 pt-2 border-t border-border">
              <TouchableOpacity
                onPress={() => openRejectModal(activeSubmission.id)}
                disabled={isReviewing}
                className="flex-1 py-2 rounded-xl bg-rose-50 border border-rose-200 items-center justify-center active:bg-rose-100"
              >
                <Text className="text-xs font-bold text-rose-700">Từ chối</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleApprove(activeSubmission.id)}
                disabled={isReviewing}
                className="flex-1 py-2 rounded-xl bg-emerald-600 items-center justify-center active:bg-emerald-700"
              >
                {isReviewing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-xs font-bold text-white">Duyệt bản này</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View className="p-5 rounded-xl border border-dashed border-border bg-slate-50/50 items-center justify-center">
          <Feather name="box" size={20} color="#94A3B8" style={{ marginBottom: 6 }} />
          <Text className="text-xs font-semibold text-text-secondary text-center mb-0.5">
            Chưa có thông tin chuẩn sản phẩm
          </Text>
          <Text className="text-[11px] text-text-muted text-center max-w-[260px] mb-3">
            Tạo bản mô tả sản phẩm và tải file chuẩn để làm cơ sở chạy QC.
          </Text>
          {canManageSubmission && (
            <TouchableOpacity
              onPress={openCreateForm}
              disabled={isOnHold}
              className={`flex-row items-center px-3 py-1.5 rounded-xl bg-primary ${
                isOnHold ? 'opacity-50' : 'active:opacity-80'
              }`}
            >
              <Feather name="plus" size={12} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white ml-1">Tạo bản gửi đầu tiên</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Modal Form Tạo/Chỉnh sửa mô tả sản phẩm */}
      <Modal visible={isFormOpen} transparent animationType="slide" onRequestClose={closeForm}>
        <View className="flex-1 bg-slate-900/60 justify-end">
          <View className="bg-surface rounded-t-3xl p-4 max-h-[90%]">
            {/* Modal Form Header */}
            <View className="flex-row items-center justify-between pb-3 border-b border-border mb-3">
              <View className="flex-1 mr-2">
                <Text className="text-base font-bold text-text-primary">
                  {loadedSubmissionId ? 'Chỉnh sửa mô tả SP' : 'Tạo bản mô tả SP mới'}
                </Text>
                <Text className="text-[11px] text-text-muted">
                  Upload file chuẩn doc/pdf cho từng sản phẩm
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeForm}
                disabled={isSaving}
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
              >
                <Feather name="x" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Form Scrollable Body */}
            <ScrollView showsVerticalScrollIndicator={false} className="mb-3">
              {/* QC Alert Inside Modal */}
              <View className="mb-3 flex-row items-start p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <Feather name="alert-triangle" size={13} color="#D97706" style={{ marginTop: 2, marginRight: 6 }} />
                <Text className="text-[11px] text-amber-800 font-medium flex-1 leading-4">
                  Hệ thống tự động trích xuất nội dung chữ từ file doc/pdf (bỏ qua hình ảnh) để AI đối chiếu QC.
                </Text>
              </View>

              <View className="gap-3">
                {products.map((prod, idx) => (
                  <View key={idx} className="p-3.5 rounded-2xl border border-border bg-slate-50/70 gap-3">
                    {/* Product Card Header Accordion */}
                    <View className="flex-row items-center justify-between">
                      <TouchableOpacity
                        onPress={() => toggleProductCollapsed(idx)}
                        className="flex-row items-center flex-1 mr-2"
                      >
                        <Feather
                          name={prod.collapsed ? 'chevron-down' : 'chevron-up'}
                          size={16}
                          color="#64748B"
                          style={{ marginRight: 6 }}
                        />
                        <Text className="text-xs font-bold text-text-primary flex-1" numberOfLines={1}>
                          {prod.productName || `Sản phẩm #${idx + 1}`}
                        </Text>
                      </TouchableOpacity>

                      {products.length > 1 && (
                        <TouchableOpacity
                          onPress={() => removeProduct(idx)}
                          disabled={isSaving}
                          className="p-1"
                        >
                          <Feather name="trash-2" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {!prod.collapsed && (
                      <View className="gap-3 pt-1 border-t border-border/60">
                        {/* 1. Product Name */}
                        <View>
                          <Text className="text-[11px] font-bold text-primary uppercase tracking-wide mb-1">
                            Tên sản phẩm *
                          </Text>
                          <TextInput
                            value={prod.productName}
                            onChangeText={(t) => updateProduct(idx, { productName: t })}
                            placeholder="Ví dụ: Nước sâm thảo mộc 330ml"
                            placeholderTextColor="#94A3B8"
                            className="bg-white border border-border rounded-xl px-3 py-2 text-xs text-text-primary font-medium"
                          />
                        </View>

                        {/* 2. Standard File Upload (doc/pdf) */}
                        <View className="p-3 rounded-xl border border-primary/20 bg-primary/5 gap-2">
                          <Text className="text-[11px] font-bold text-primary uppercase tracking-wide">
                            File thông tin chuẩn (doc/pdf) *
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleDocFileChange(idx)}
                            disabled={prod.docUploading || isSaving}
                            className="flex-row items-center justify-center p-3 rounded-xl border-2 border-dashed border-primary/40 bg-white"
                          >
                            <Feather name="upload-cloud" size={16} color={BrandColors.primary} />
                            <Text className="text-xs font-bold text-primary ml-2">
                              {prod.fileUrl ? 'Thay đổi file chuẩn' : 'Chọn file doc/pdf từ máy'}
                            </Text>
                          </TouchableOpacity>

                          {prod.docUploading && (
                            <View className="flex-row items-center gap-2 mt-1">
                              <ActivityIndicator size="small" color={BrandColors.primary} />
                              <Text className="text-xs text-primary font-medium">
                                Đang tải lên... {prod.docUploadProgress || 0}%
                              </Text>
                            </View>
                          )}

                          {prod.fileUrl && !prod.docUploading && (
                            <View className="flex-row items-center justify-between p-2 rounded-lg bg-white border border-primary/30">
                              <TouchableOpacity
                                onPress={() => handleOpenUrl(prod.fileUrl)}
                                className="flex-row items-center flex-1 mr-2"
                              >
                                <Feather name="file-text" size={13} color={BrandColors.primary} style={{ marginRight: 6 }} />
                                <Text className="text-xs font-semibold text-primary truncate" numberOfLines={1}>
                                  {prod.fileName || 'Xem file chuẩn đã upload'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        {/* 3. Extracted Text with AI formatting */}
                        <View className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/30 gap-2">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                              Nội dung trích xuất
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleAiFormat(idx)}
                              disabled={prod.aiFormatting || prod.extracting || !prod.extractedText}
                              className="flex-row items-center px-2 py-1 rounded-lg bg-white border border-emerald-300"
                            >
                              {prod.aiFormatting ? (
                                <ActivityIndicator size="small" color="#059669" style={{ marginRight: 4 }} />
                              ) : (
                                <Feather name="zap" size={11} color="#059669" style={{ marginRight: 4 }} />
                              )}
                              <Text className="text-[10px] font-bold text-emerald-700">
                                AI formatting
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {prod.hasComplexLayout && (
                            <View className="p-2 rounded-lg bg-amber-50 border border-amber-300 flex-row items-start">
                              <Feather name="alert-circle" size={12} color="#D97706" style={{ marginTop: 2, marginRight: 4 }} />
                              <Text className="text-[10px] text-amber-800 font-medium flex-1">
                                File có nhiều cột/bảng phức tạp, vui lòng rà soát lại nội dung bên dưới.
                              </Text>
                            </View>
                          )}

                          {prod.extracting ? (
                            <View className="p-3 bg-white rounded-xl border border-emerald-200 flex-row items-center justify-center gap-2">
                              <ActivityIndicator size="small" color="#059669" />
                              <Text className="text-xs text-emerald-700 font-medium">
                                Đang trích xuất nội dung từ file...
                              </Text>
                            </View>
                          ) : (
                            <TextInput
                              value={prod.extractedText}
                              onChangeText={(t) => updateProduct(idx, { extractedText: t })}
                              placeholder="Nội dung trích xuất từ file sẽ hiển thị ở đây, có thể chỉnh sửa tự do"
                              placeholderTextColor="#94A3B8"
                              multiline
                              numberOfLines={4}
                              style={{ textAlignVertical: 'top', minHeight: 80 }}
                              className="bg-white border border-emerald-200 rounded-xl p-2.5 text-xs text-text-primary"
                            />
                          )}
                        </View>

                        {/* 4. Notes */}
                        <View>
                          <Text className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1">
                            Chú thích (không bắt buộc)
                          </Text>
                          <TextInput
                            value={prod.note}
                            onChangeText={(t) => updateProduct(idx, { note: t })}
                            placeholder="Nhập ghi chú cho sản phẩm này..."
                            placeholderTextColor="#94A3B8"
                            multiline
                            numberOfLines={2}
                            style={{ textAlignVertical: 'top', minHeight: 48 }}
                            className="bg-white border border-border rounded-xl px-3 py-2 text-xs text-text-primary"
                          />
                        </View>

                        {/* 5. Supplementary Documents */}
                        <View className="p-3 rounded-xl border border-border bg-white gap-2">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-[11px] font-bold text-text-muted uppercase tracking-wide">
                              Tài liệu bổ sung ({prod.documents.length})
                            </Text>
                            <TouchableOpacity
                              onPress={() => handlePickSupplementaryDoc(idx)}
                              disabled={prod.docsUploading || isSaving}
                              className="flex-row items-center px-2 py-1 rounded-lg bg-slate-100"
                            >
                              <Feather name="plus" size={11} color="#475569" style={{ marginRight: 4 }} />
                              <Text className="text-[10px] font-bold text-slate-700">Thêm tệp</Text>
                            </TouchableOpacity>
                          </View>

                          {prod.docsUploading && (
                            <View className="flex-row items-center gap-2">
                              <ActivityIndicator size="small" color={BrandColors.primary} />
                              <Text className="text-xs text-primary font-medium">Đang tải lên...</Text>
                            </View>
                          )}

                          {prod.documents.map((doc, dIdx) => (
                            <View
                              key={dIdx}
                              className="flex-row items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200"
                            >
                              <TouchableOpacity
                                onPress={() => handleOpenUrl(doc.url)}
                                className="flex-row items-center flex-1 mr-2"
                              >
                                <Feather name="paperclip" size={12} color="#64748B" style={{ marginRight: 6 }} />
                                <Text className="text-xs text-blue-600 truncate" numberOfLines={1}>
                                  {doc.name || 'Tài liệu'}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => removeSupplementaryDoc(idx, dIdx)}
                                className="p-1"
                              >
                                <Feather name="trash-2" size={13} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                ))}

                {/* Add product button */}
                <TouchableOpacity
                  onPress={addProduct}
                  disabled={isSaving}
                  className="flex-row items-center justify-center py-2.5 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 active:bg-primary/10"
                >
                  <Feather name="plus" size={14} color={BrandColors.primary} />
                  <Text className="text-xs font-bold text-primary ml-1.5">
                    Thêm sản phẩm khác
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Modal Form Footer Buttons */}
            <View className="flex-row gap-2 pt-2 border-t border-border">
              <TouchableOpacity
                onPress={handleSaveDraft}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 items-center justify-center active:bg-slate-200"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#64748B" />
                ) : (
                  <Text className="text-xs font-bold text-text-secondary">Lưu nháp</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmitForReview}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl bg-primary items-center justify-center active:opacity-80"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-xs font-bold text-white">Gửi PM duyệt</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <View className="flex-1 bg-slate-900/60 items-center justify-center p-4">
          <View className="w-full max-w-sm bg-surface rounded-2xl p-4 gap-3 shadow-lg">
            <View className="flex-row items-center justify-between border-b border-border pb-2.5">
              <Text className="text-sm font-bold text-rose-700">Từ chối bản mô tả sản phẩm</Text>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View>
              <Text className="text-xs text-text-secondary mb-1">
                Lý do không duyệt (bắt buộc) *:
              </Text>
              <TextInput
                value={reviewNote}
                onChangeText={setReviewNote}
                placeholder="Nhập lý do hoặc yêu cầu chỉnh sửa..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                style={{ textAlignVertical: 'top', minHeight: 70 }}
                className="bg-white border border-border rounded-xl p-2.5 text-xs text-text-primary"
              />
            </View>

            <View className="flex-row gap-2 pt-1">
              <TouchableOpacity
                onPress={() => setRejectModalVisible(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 items-center justify-center"
              >
                <Text className="text-xs font-bold text-text-secondary">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmReject}
                disabled={isReviewing}
                className="flex-1 py-2 rounded-xl bg-rose-600 items-center justify-center"
              >
                {isReviewing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-xs font-bold text-white">Xác nhận từ chối</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <ProductDescriptionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        submissions={submissions}
        canEditSubmission={canManageSubmission}
        onEdit={(sub) => openEditForm(sub)}
        onOpenUrl={handleOpenUrl}
      />
    </View>
  );
};
