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
import { useCreatePaymentRequestMutation } from '@/hooks/queries/usePaymentRequests';
import { useProjectsQuery } from '@/hooks/queries/useProjects';
import { useTasksByProjectQuery, useTasksQuery } from '@/hooks/queries/useTasks';
import { useAuthStore } from '@/stores/useAuthStore';
import { paymentRequestService } from '@/services/paymentRequestService';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import {
  InvoiceUploadPicker,
  UploadedFileItem,
} from '@/components/payment-requests/InvoiceUploadPicker';
import {
  formatNumberInput,
  parseNumberInput,
  formatDateToDDMMYYYY,
  formatDateToYYYYMMDD,
} from '@/utils/formatters';

export default function CreatePaymentRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?.id;

  const [type, setType] = useState<'PROJECT' | 'OTHER_WORK'>('PROJECT');
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
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryAccount, setBeneficiaryAccount] = useState('');
  const [beneficiaryBank, setBeneficiaryBank] = useState('');
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { data: projects = [], isLoading: loadingProjects } = useProjectsQuery();
  const { data: projectTasks = [], isLoading: loadingTasks } = useTasksByProjectQuery(projectId);
  const { data: userTasksData, isLoading: loadingOtherTasks } = useTasksQuery({
    assigneeId: currentUserId,
    limit: 500,
  });
  const createMutation = useCreatePaymentRequestMutation();

  const myProjectTasks = useMemo(() => {
    return projectTasks.filter(
      (t: any) => t.assigneeId === currentUserId || t.assignee?.id === currentUserId
    );
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
    if (!title.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập nội dung đề xuất thanh toán.');
      return;
    }

    const parsedAmount = parseNumberInput(amountRaw);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Số tiền không hợp lệ', 'Vui lòng nhập số tiền chi lớn hơn 0 VNĐ.');
      return;
    }

    if (type === 'PROJECT') {
      if (!projectId) {
        Alert.alert('Chưa chọn dự án', 'Đề xuất theo dự án bắt buộc phải chọn dự án liên quan.');
        return;
      }
      if (!taskId) {
        Alert.alert('Chưa chọn công việc', 'Vui lòng chọn công việc của bạn trong dự án.');
        return;
      }
    }
    // Ghi chú: Khi type === 'OTHER_WORK', công việc là TÙY CHỌN, KHÔNG BẮT BUỘC!

    if (!dueDate) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn thời hạn thanh toán.');
      return;
    }

    if (files.length === 0) {
      Alert.alert('Thiếu hóa đơn', 'Vui lòng đính kèm ít nhất một file hóa đơn hoặc chứng từ.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setIsUploading(true);

      const invoiceImages: any[] = [];
      const invoicePdfs: any[] = [];

      for (const file of files) {
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
          if (isPdf) {
            invoicePdfs.push({ ...uploadRes.data, fileType: 'PDF' });
          } else {
            invoiceImages.push({ ...uploadRes.data, fileType: 'IMAGE' });
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
        projectId: type === 'PROJECT' ? projectId : undefined,
        taskId: taskId || undefined,
        beneficiaryName: beneficiaryName.trim() || undefined,
        beneficiaryAccount: beneficiaryAccount.trim() || undefined,
        beneficiaryBank: beneficiaryBank.trim() || undefined,
        invoiceImages,
        invoicePdfs,
        invoiceFiles: files.map((f) => ({ url: f.uri, name: f.name })),
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
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Loại đề xuất */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
            Phân Loại Đề Xuất <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
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
                  fontSize: 13,
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
                  fontSize: 13,
                  fontWeight: type === 'OTHER_WORK' ? '700' : '500',
                  color: type === 'OTHER_WORK' ? '#F38820' : '#475569',
                }}
              >
                Công việc khác
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
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {projects.map((p) => {
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
                {loadingTasks ? (
                  <ActivityIndicator size="small" color="#F38820" />
                ) : myProjectTasks.length === 0 ? (
                  <Text style={{ fontSize: 12, color: '#EA580C', fontStyle: 'italic' }}>
                    Bạn chưa được giao công việc nào trong dự án này
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

        {/* 2b. Chọn công việc nếu type === 'OTHER_WORK' (KHÔNG BẮT BUỘC) */}
        {type === 'OTHER_WORK' && (
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
              Công Việc (không thuộc dự án){' '}
              <Text style={{ fontSize: 11, fontWeight: 'normal', color: '#94A3B8' }}>(tùy chọn)</Text>
            </Text>
            {loadingOtherTasks ? (
              <ActivityIndicator size="small" color="#F38820" />
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
                      -- Không chọn công việc --
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
            {!loadingOtherTasks && nonProjectTasks.length === 0 && (
              <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 6, fontStyle: 'italic' }}>
                Bạn chưa có công việc nào không thuộc dự án (có thể để trống)
              </Text>
            )}
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
            placeholder="Mô tả nội dung yêu cầu thanh toán..."
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
            Thời Hạn Thanh Toán <Text style={{ color: '#EF4444' }}>*</Text>
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

        {/* 4. Số tiền */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
            Số Tiền Yêu Cầu Chi (VNĐ) <Text style={{ color: '#EF4444' }}>*</Text>
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

        {/* 5. Lý do chi tiết */}
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

        {/* 6. Thông tin thụ hưởng */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 10,
            padding: 14,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 10 }}>
            Thông Tin Tài Khoản Thụ Hưởng
          </Text>

          {/* Tên người thụ hưởng */}
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Người / Đơn vị thụ hưởng</Text>
            <TextInput
              value={beneficiaryName}
              onChangeText={setBeneficiaryName}
              placeholder="Ví dụ: NGUYEN VAN A hoặc CÔNG TY TNHH..."
              placeholderTextColor="#94A3B8"
              style={{
                height: 40,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                borderRadius: 6,
                paddingHorizontal: 10,
                fontSize: 13,
                color: '#0F172A',
              }}
            />
          </View>

          {/* Số tài khoản */}
          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Số tài khoản ngân hàng</Text>
            <TextInput
              value={beneficiaryAccount}
              onChangeText={setBeneficiaryAccount}
              keyboardType="numeric"
              placeholder="Ví dụ: 19034567890012"
              placeholderTextColor="#94A3B8"
              style={{
                height: 40,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                borderRadius: 6,
                paddingHorizontal: 10,
                fontSize: 13,
                color: '#0F172A',
              }}
            />
          </View>

          {/* Ngân hàng */}
          <View>
            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Ngân hàng &amp; Chi nhánh</Text>
            <TextInput
              value={beneficiaryBank}
              onChangeText={setBeneficiaryBank}
              placeholder="Ví dụ: Techcombank - CN Tân Bình"
              placeholderTextColor="#94A3B8"
              style={{
                height: 40,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                borderRadius: 6,
                paddingHorizontal: 10,
                fontSize: 13,
                color: '#0F172A',
              }}
            />
          </View>
        </View>

        {/* 7. Hóa đơn / Chứng từ đính kèm (Nén ảnh tự động < 1MB) */}
        <InvoiceUploadPicker files={files} onChange={setFiles} />
      </ScrollView>

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
                Tạo Đề Xuất Thanh Toán
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
