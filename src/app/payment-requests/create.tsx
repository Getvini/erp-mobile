import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useCreatePaymentRequestMutation,
  useServiceBudgetQuery,
} from '@/hooks/queries/usePaymentRequests';
import { useProjectsQuery } from '@/hooks/queries/useProjects';
import { useTasksByProjectQuery, useTasksQuery } from '@/hooks/queries/useTasks';
import { useAuthStore } from '@/stores/useAuthStore';
import { paymentRequestService } from '@/services/paymentRequestService';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import {
  ProductionDocumentPicker,
  ProductionDocItem,
} from '@/components/payment-requests/ProductionDocumentPicker';
import { PaymentRequestDocModal } from '@/components/payment-requests/PaymentRequestDocModal';
import { ServiceBudgetBox } from '@/components/payment-requests/ServiceBudgetBox';
import {
  formatNumberInput,
  parseNumberInput,
  formatDateToDDMMYYYY,
  formatDateToYYYYMMDD,
} from '@/utils/formatters';
import {
  isProjectActive,
  isTaskBudgetService,
  validatePaymentRequestInput,
} from '@/utils/paymentRequestHelper';

export default function CreatePaymentRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?.id;

  const [type, setType] = useState<'PROJECT' | 'OTHER_WORK' | 'ADVANCE'>('PROJECT');
  const [projectId, setProjectId] = useState<string>('');
  const [taskId, setTaskId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [reason, setReason] = useState('');
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return formatDateToYYYYMMDD(d);
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [settlementDueDate, setSettlementDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return formatDateToYYYYMMDD(d);
  });
  const [showSettlementDatePicker, setShowSettlementDatePicker] = useState(false);
  const [overBudgetReason, setOverBudgetReason] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [files, setFiles] = useState<ProductionDocItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  const handleApplyDocFromModal = (
    docItem: ProductionDocItem,
    syncData?: { amount: number; reason: string; dueDate: string }
  ) => {
    // Đính kèm Giấy ĐNTT mẫu (thay thế mẫu cũ nếu có)
    setFiles((prev) => {
      const filtered = prev.filter((f) => !f.isGeneratedDoc);
      return [...filtered, docItem];
    });

    // Đồng bộ ngược các trường ra form chính
    if (syncData) {
      if (syncData.amount > 0) {
        setAmountRaw(formatNumberInput(String(syncData.amount)));
      }
      if (syncData.reason && syncData.reason.trim()) {
        if (!title.trim() || title === reason) {
          setTitle(syncData.reason.trim());
        }
        setReason(syncData.reason.trim());
      }
      if (syncData.dueDate) {
        setDueDate(syncData.dueDate);
      }
    }
  };

  const { data: rawProjects = [], isLoading: loadingProjects } = useProjectsQuery();
  const { data: projectTasks = [], isLoading: loadingTasks, isError: projectTasksError, refetch: refetchProjectTasks } = useTasksByProjectQuery(projectId);
  const { data: userTasksData, isLoading: loadingOtherTasks } = useTasksQuery({
    assigneeId: currentUserId,
    limit: 500,
  });
  const { data: budgetInfo, isLoading: loadingBudget } = useServiceBudgetQuery({
    projectId: projectId || undefined,
    taskId: taskId || undefined,
  });
  const createMutation = useCreatePaymentRequestMutation();

  // 1. Chỉ lấy các dự án đang hoạt động (ẩn COMPLETED, CANCELLED, ON_HOLD)
  const activeProjects = useMemo(() => {
    return (rawProjects || []).filter(isProjectActive);
  }, [rawProjects]);

  // Lấy dự án hiện tại đang chọn
  const selectedProject = useMemo(() => {
    return activeProjects.find((p) => p.id === projectId);
  }, [activeProjects, projectId]);

  // 2. Lọc công việc trong dự án: Phải được giao cho user VÀ thuộc dịch vụ quản lý ngân sách
  const myProjectTasks = useMemo(() => {
    return (projectTasks || []).filter((t: any) => {
      const isAssigned = t.assigneeId === currentUserId || t.assignee?.id === currentUserId;
      if (!isAssigned) return false;
      return isTaskBudgetService(t);
    });
  }, [projectTasks, currentUserId]);

  const nonProjectTasks = useMemo(() => {
    const list = Array.isArray(userTasksData?.data) ? userTasksData.data : [];
    return list.filter(
      (t: any) =>
        !t.projectId &&
        !t.project?.id &&
        (!currentUserId || t.assigneeId === currentUserId || t.assignee?.id === currentUserId)
    );
  }, [userTasksData, currentUserId]);

  const handleAmountChange = (text: string) => {
    const formatted = formatNumberInput(text);
    setAmountRaw(formatted);
  };

  const handleSubmit = async () => {
    if (projectId && (loadingTasks || projectTasksError)) {
      Alert.alert('Chưa tải đủ công việc', 'Vui lòng tải lại danh sách công việc dự án trước khi gửi đề xuất.');
      return;
    }
    const parsedAmount = parseNumberInput(amountRaw) || 0;

    // Kiểm tra vượt ngân sách cấp dịch vụ
    const remainingTotal = Number(budgetInfo?.remainingTotalServiceBudget) || 0;
    const isOverBudget = Boolean(
      budgetInfo?.hasTotalServiceBudget &&
      (remainingTotal <= 0 || parsedAmount > remainingTotal)
    );

    // Validate dữ liệu tập trung qua helper
    const validation = validatePaymentRequestInput({
      type,
      title: title.trim(),
      amount: parsedAmount,
      dueDate,
      projectId: (type === 'PROJECT' || Boolean(projectId)) ? projectId : undefined,
      taskId: taskId || undefined,
      isOverBudget,
      overBudgetReason,
      settlementDueDate: type === 'ADVANCE' ? settlementDueDate : undefined,
    });

    if (!validation.isValid) {
      Alert.alert('Chưa hợp lệ', validation.error || 'Vui lòng kiểm tra lại thông tin.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setIsUploading(true);

      const invoiceImages: any[] = [];
      const invoicePdfs: any[] = [];

      // Upload từng file chứng từ lên Cloudinary (nếu có đính kèm)
      for (const file of files) {
        if (file.isGeneratedDoc) {
          // File mẫu chuẩn Word: Backend sẽ tự sinh file docx từ template và lưu vào hồ sơ
          invoicePdfs.push({
            name: file.name,
            standardName: file.standardName,
            docType: 'PAYMENT_REQUEST_DOC',
            fileType: 'DOC',
            isGeneratedDoc: true,
            docData: file.docData,
          });
          continue;
        }

        const formData = new FormData();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (formData as any).append('file', {
          uri: file.uri,
          name: file.name,
          type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        });

        const uploadRes = await paymentRequestService.uploadPaymentRequestInvoiceFile(formData);
        if (uploadRes.data) {
          const isPdf = file.type?.includes('pdf') || file.name?.toLowerCase().endsWith('.pdf');
          const fileMeta = {
            ...uploadRes.data,
            name: file.name,
            standardName: file.standardName,
            docType: file.docType,
            fileType: isPdf ? 'PDF' : 'IMAGE',
          };

          if (isPdf) {
            invoicePdfs.push(fileMeta);
          } else {
            invoiceImages.push(fileMeta);
          }
        }
      }

      await createMutation.mutateAsync({
        type,
        title: title.trim(),
        content: title.trim(),
        amount: parsedAmount,
        reason: reason.trim() || undefined,
        dueDate,
        settlementDueDate: type === 'ADVANCE' ? settlementDueDate : undefined,
        overBudgetReason: overBudgetReason.trim() || undefined,
        projectId: (type === 'PROJECT' || Boolean(projectId)) ? projectId : undefined,
        taskId: taskId || undefined,
        isUrgent,
        invoiceImages,
        invoicePdfs,
        invoiceFiles: files.map((f) => ({ url: f.uri, name: f.name, docType: f.docType })),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Thành công', 'Đã tạo đề xuất thanh toán thành công!', [
        {
          text: 'Đóng',
          onPress: () => router.back(),
        },
      ]);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Thao tác thất bại', err?.message || 'Không thể tạo đề xuất thanh toán.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#F8FAFC' }}
    >
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
          gap: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#F1F5F9',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>
          Tạo Đề Xuất Thanh Toán
        </Text>
      </View>

      {/* Form Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Loại đề xuất (3 Tabs: Theo dự án, Công việc khác, Tạm ứng) */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
            Phân Loại Đề Xuất <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => {
                setType('PROJECT');
                setTaskId('');
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: type === 'PROJECT' ? '#F38820' : '#E2E8F0',
                backgroundColor: type === 'PROJECT' ? '#FFF7ED' : '#FFFFFF',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: type === 'PROJECT' ? '700' : '500',
                  color: type === 'PROJECT' ? '#F38820' : '#475569',
                }}
              >
                Theo dự án
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setType('OTHER_WORK');
                setProjectId('');
                setTaskId('');
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: type === 'OTHER_WORK' ? '#F38820' : '#E2E8F0',
                backgroundColor: type === 'OTHER_WORK' ? '#FFF7ED' : '#FFFFFF',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: type === 'OTHER_WORK' ? '700' : '500',
                  color: type === 'OTHER_WORK' ? '#F38820' : '#475569',
                }}
              >
                Việc khác
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setType('ADVANCE');
              }}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: type === 'ADVANCE' ? '#9333EA' : '#E2E8F0',
                backgroundColor: type === 'ADVANCE' ? '#FAF5FF' : '#FFFFFF',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: type === 'ADVANCE' ? '700' : '500',
                  color: type === 'ADVANCE' ? '#9333EA' : '#475569',
                }}
              >
                Tạm ứng
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Chọn dự án & công việc nếu type === 'PROJECT' */}
        {type === 'PROJECT' && (
          <>
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                Chọn Dự Án <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              {loadingProjects ? (
                <ActivityIndicator size="small" color="#F38820" />
              ) : activeProjects.length === 0 ? (
                <Text style={{ fontSize: 12, color: '#EA580C', fontStyle: 'italic' }}>
                  Không có dự án đang hoạt động
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {activeProjects.map((p) => {
                      const active = projectId === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => {
                            setProjectId(p.id);
                            setTaskId('');
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: active ? '#F38820' : '#E2E8F0',
                            backgroundColor: active ? '#FFF7ED' : '#FFFFFF',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: active ? '700' : '500',
                              color: active ? '#F38820' : '#334155',
                            }}
                          >
                            {p.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>

            {projectId ? (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                  Công Việc Của Bạn <Text style={{ color: '#EF4444' }}>*</Text>
                </Text>
                {projectTasksError ? (
                  <TouchableOpacity className="min-h-[48px] justify-center" onPress={() => refetchProjectTasks()}><Text className="text-red-600">Không tải được đầy đủ công việc. Bấm thử lại.</Text></TouchableOpacity>
                ) : loadingTasks ? (
                  <ActivityIndicator size="small" color="#F38820" />
                ) : myProjectTasks.length === 0 ? (
                  <Text style={{ fontSize: 12, color: '#EA580C', fontStyle: 'italic' }}>
                    Bạn chưa có công việc có ngân sách trong dự án này
                  </Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {myProjectTasks.map((t: any) => {
                        const active = taskId === t.id;
                        return (
                          <TouchableOpacity
                            key={t.id}
                            onPress={() => setTaskId(t.id)}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: active ? '#F38820' : '#E2E8F0',
                              backgroundColor: active ? '#FFF7ED' : '#FFFFFF',
                              maxWidth: 240,
                            }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 13,
                                fontWeight: active ? '700' : '500',
                                color: active ? '#F38820' : '#334155',
                              }}
                            >
                              {t.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
              </View>
            ) : null}
          </>
        )}

        {/* 2b. Chọn công việc ngoài dự án nếu type === 'OTHER_WORK' */}
        {type === 'OTHER_WORK' && (
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
              Công Việc Ngoài Dự Án <Text style={{ fontSize: 11, fontWeight: 'normal', color: '#94A3B8' }}>(tùy chọn)</Text>
            </Text>
            {loadingOtherTasks ? (
              <ActivityIndicator size="small" color="#F38820" />
            ) : nonProjectTasks.length === 0 ? (
              <Text style={{ fontSize: 12, color: '#64748B', fontStyle: 'italic' }}>
                Bạn không có công việc ngoài dự án nào (có thể để trống)
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setTaskId('')}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: !taskId ? '#F38820' : '#E2E8F0',
                      backgroundColor: !taskId ? '#FFF7ED' : '#FFFFFF',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: !taskId ? '700' : '500',
                        color: !taskId ? '#F38820' : '#64748B',
                      }}
                    >
                      -- Không gắn công việc --
                    </Text>
                  </TouchableOpacity>

                  {nonProjectTasks.map((t: any) => {
                    const active = taskId === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => setTaskId(t.id)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: active ? '#F38820' : '#E2E8F0',
                          backgroundColor: active ? '#FFF7ED' : '#FFFFFF',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: active ? '700' : '500',
                            color: active ? '#F38820' : '#334155',
                          }}
                        >
                          {t.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        )}

        {/* 2c. Chọn dự án, CÔNG VIỆC (Vá bug) & thời hạn hoàn ứng nếu type === 'ADVANCE' */}
        {type === 'ADVANCE' && (
          <View style={{ marginBottom: 14, gap: 12 }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                Dự Án Liên Quan <Text style={{ fontSize: 11, fontWeight: 'normal', color: '#94A3B8' }}>(tùy chọn)</Text>
              </Text>
              {loadingProjects ? (
                <ActivityIndicator size="small" color="#9333EA" />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setProjectId('');
                        setTaskId('');
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: !projectId ? '#9333EA' : '#E2E8F0',
                        backgroundColor: !projectId ? '#FAF5FF' : '#FFFFFF',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: !projectId ? '700' : '500',
                          color: !projectId ? '#9333EA' : '#64748B',
                        }}
                      >
                        -- Tạm ứng việc chung --
                      </Text>
                    </TouchableOpacity>

                    {activeProjects.map((p) => {
                      const active = projectId === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => {
                            setProjectId(p.id);
                            setTaskId('');
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: active ? '#9333EA' : '#E2E8F0',
                            backgroundColor: active ? '#FAF5FF' : '#FFFFFF',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: active ? '700' : '500',
                              color: active ? '#9333EA' : '#334155',
                            }}
                          >
                            {p.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>

            {/* SỬA BUG: Khi Tạm ứng có chọn Dự án, bắt buộc phải chọn Công việc của bạn trong dự án */}
            {projectId ? (
              <View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                  Công Việc Của Bạn Trong Dự Án <Text style={{ color: '#EF4444' }}>*</Text>
                </Text>
                {loadingTasks ? (
                  <ActivityIndicator size="small" color="#9333EA" />
                ) : myProjectTasks.length === 0 ? (
                  <Text style={{ fontSize: 12, color: '#EA580C', fontStyle: 'italic' }}>
                    Bạn chưa có công việc có ngân sách trong dự án này
                  </Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {myProjectTasks.map((t: any) => {
                        const active = taskId === t.id;
                        return (
                          <TouchableOpacity
                            key={t.id}
                            onPress={() => setTaskId(t.id)}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: active ? '#9333EA' : '#E2E8F0',
                              backgroundColor: active ? '#FAF5FF' : '#FFFFFF',
                              maxWidth: 240,
                            }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 13,
                                fontWeight: active ? '700' : '500',
                                color: active ? '#9333EA' : '#334155',
                              }}
                            >
                              {t.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
              </View>
            ) : null}

            {/* Hạn hoàn ứng / quyết toán */}
            <View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                Thời Hạn Hoàn Ứng / Quyết Toán <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TouchableOpacity
                onPress={() => setShowSettlementDatePicker(true)}
                style={{
                  height: 44,
                  borderWidth: 1,
                  borderColor: '#CBD5E1',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  backgroundColor: '#FFFFFF',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ fontSize: 14, color: settlementDueDate ? '#6B21A8' : '#94A3B8', fontWeight: '600' }}>
                  {settlementDueDate ? formatDateToDDMMYYYY(settlementDueDate) : 'Chọn hạn hoàn ứng'}
                </Text>
                <Feather name="calendar" size={18} color="#9333EA" />
              </TouchableOpacity>
            </View>

            <DatePickerModal
              visible={showSettlementDatePicker}
              initialDate={settlementDueDate}
              title="Chọn hạn hoàn ứng / quyết toán"
              onConfirm={(_, yyyymmdd) => {
                setSettlementDueDate(yyyymmdd);
                setShowSettlementDatePicker(false);
              }}
              onClose={() => setShowSettlementDatePicker(false)}
            />
          </View>
        )}

        {/* 3. Tiêu đề / Nội dung */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
            Nội Dung Yêu Cầu <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={type === 'ADVANCE' ? 'Mô tả mục đích tạm ứng kinh phí sản xuất, các khoản dự kiến...' : 'Mô tả nội dung chi phí sản xuất, họ tên đối tác/talent, công việc...'}
            placeholderTextColor="#94A3B8"
            style={{
              height: 44,
              borderWidth: 1,
              borderColor: '#CBD5E1',
              borderRadius: 8,
              paddingHorizontal: 12,
              fontSize: 14,
              color: '#0F172A',
              backgroundColor: '#FFFFFF',
            }}
          />
        </View>

        {/* 4. Thời hạn thanh toán */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
            Thời Hạn Thanh Toán {type === 'ADVANCE' ? '(Nhận tiền)' : ''} <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            style={{
              height: 44,
              borderWidth: 1,
              borderColor: '#CBD5E1',
              borderRadius: 8,
              paddingHorizontal: 12,
              backgroundColor: '#FFFFFF',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: 14, color: dueDate ? '#0F172A' : '#94A3B8' }}>
              {dueDate ? formatDateToDDMMYYYY(dueDate) : 'Chọn thời hạn thanh toán'}
            </Text>
            <Feather name="calendar" size={18} color="#F38820" />
          </TouchableOpacity>
        </View>

        <DatePickerModal
          visible={showDatePicker}
          initialDate={dueDate}
          title="Chọn hạn thanh toán"
          onConfirm={(_, yyyymmdd) => {
            setDueDate(yyyymmdd);
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />

        {/* 5. Số tiền */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
            Số Tiền Yêu Cầu Chi {type === 'ADVANCE' ? 'Tạm Ứng' : ''} (VNĐ) <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: 48,
              borderWidth: 1,
              borderColor: '#CBD5E1',
              borderRadius: 8,
              paddingHorizontal: 12,
              backgroundColor: '#FFFFFF',
            }}
          >
            <TextInput
              value={amountRaw}
              onChangeText={handleAmountChange}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#94A3B8"
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: '700',
                color: '#F38820',
              }}
            />
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B' }}>VNĐ</Text>
          </View>
        </View>

        {/* 6. Cờ Thanh toán gấp (Studio yêu cầu thanh toán ngay) */}
        <TouchableOpacity
          onPress={() => setIsUrgent(!isUrgent)}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: isUrgent ? '#F59E0B' : '#E2E8F0',
            backgroundColor: isUrgent ? '#FFFBEB' : '#FFFFFF',
            padding: 12,
            marginBottom: 14,
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              borderWidth: 1.5,
              borderColor: isUrgent ? '#D97706' : '#94A3B8',
              backgroundColor: isUrgent ? '#D97706' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isUrgent && <Feather name="check" size={14} color="#FFFFFF" />}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="zap" size={14} color="#D97706" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }}>
                Studio yêu cầu thanh toán gấp (sau buổi quay)
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
              Áp dụng khi có thỏa thuận Studio cần trả ngay; hệ thống ưu tiên duyệt & chi tiền sớm.
            </Text>
          </View>
        </TouchableOpacity>

        {/* Hộp Đối Soát Ngân Sách 2 Tầng (ServiceBudgetBox) khi có dự án */}
        {Boolean(projectId) && (
          <View style={{ marginBottom: 14 }}>
            <ServiceBudgetBox
              budgetInfo={budgetInfo}
              isLoading={loadingBudget}
              amount={parseNumberInput(amountRaw) || 0}
              overBudgetReason={overBudgetReason}
              setOverBudgetReason={setOverBudgetReason}
              readOnly={false}
            />
          </View>
        )}

        {/* 7. Lý do chi tiết */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
            Lý Do Chi &amp; Nội Dung Diễn Giải
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            placeholder="Mô tả chi tiết mục đích sử dụng số tiền này..."
            placeholderTextColor="#94A3B8"
            style={{
              minHeight: 70,
              borderWidth: 1,
              borderColor: '#CBD5E1',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 14,
              color: '#0F172A',
              backgroundColor: '#FFFFFF',
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* 8. Bộ Hồ Sơ Chứng Từ Sản Xuất (5 danh mục chuẩn Getvini - Tùy chọn) */}
        <ProductionDocumentPicker
          files={files}
          onChange={setFiles}
          projectName={selectedProject?.name}
          requestType={type}
          onOpenTemplateModal={() => setShowDocModal(true)}
        />
      </ScrollView>

      {/* Modal Lập Giấy ĐNTT từ mẫu chuẩn Word Getvini */}
      <PaymentRequestDocModal
        visible={showDocModal}
        onClose={() => setShowDocModal(false)}
        onApplyDoc={handleApplyDocFromModal}
        currentUser={currentUser}
        initialAmount={parseNumberInput(amountRaw) || 0}
        initialReason={reason || title}
        initialDueDate={dueDate}
        projectName={selectedProject?.name}
        requestType={type}
      />

      {/* Sticky Bottom Action Bar (Thumb Zone) */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16),
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 10,
        }}
      >
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={createMutation.isPending || isUploading}
          activeOpacity={0.85}
          style={{
            height: 48,
            borderRadius: 10,
            backgroundColor: '#F38820',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            opacity: createMutation.isPending || isUploading ? 0.7 : 1,
          }}
        >
          {createMutation.isPending || isUploading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="send" size={18} color="#FFFFFF" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
                {type === 'ADVANCE' ? 'Tạo Phiếu Tạm Ứng' : 'Tạo Đề Xuất Thanh Toán'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
