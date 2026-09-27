import React, { useState } from 'react';
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
import {
  InvoiceUploadPicker,
  UploadedFileItem,
} from '@/components/payment-requests/InvoiceUploadPicker';
import { formatNumberInput, parseNumberInput } from '@/utils/formatters';

export default function CreatePaymentRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<'PROJECT' | 'OTHER_WORK'>('PROJECT');
  const [projectId, setProjectId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [amountRaw, setAmountRaw] = useState('');
  const [reason, setReason] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryAccount, setBeneficiaryAccount] = useState('');
  const [beneficiaryBank, setBeneficiaryBank] = useState('');
  const [files, setFiles] = useState<UploadedFileItem[]>([]);

  const { data: projects = [], isLoading: loadingProjects } = useProjectsQuery();
  const createMutation = useCreatePaymentRequestMutation();

  const handleAmountChange = (text: string) => {
    const formatted = formatNumberInput(text);
    setAmountRaw(formatted);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tiêu đề đề xuất thanh toán.');
      return;
    }

    const parsedAmount = parseNumberInput(amountRaw);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Số tiền không hợp lệ', 'Vui lòng nhập số tiền chi lớn hơn 0.');
      return;
    }

    if (type === 'PROJECT' && !projectId) {
      Alert.alert('Chưa chọn dự án', 'Đề xuất theo dự án bắt buộc phải chọn dự án liên quan.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      await createMutation.mutateAsync({
        type,
        title: title.trim(),
        amount: parsedAmount,
        reason: reason.trim() || undefined,
        projectId: type === 'PROJECT' ? projectId : undefined,
        beneficiaryName: beneficiaryName.trim() || undefined,
        beneficiaryAccount: beneficiaryAccount.trim() || undefined,
        beneficiaryBank: beneficiaryBank.trim() || undefined,
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
              onPress={() => setType('PROJECT')}
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
              onPress={() => setType('OTHER_WORK')}
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

        {/* 2. Chọn dự án nếu type === 'PROJECT' */}
        {type === 'PROJECT' && (
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
                        onPress={() => setProjectId(p.id)}
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
        )}

        {/* 3. Tiêu đề */}
        <View style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
            Tiêu Đề Đề Xuất <Text style={{ color: '#EF4444' }}>*</Text>
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ví dụ: Tạm ứng tiền thuê thiết bị quay..."
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
          disabled={createMutation.isPending}
          activeOpacity={0.85}
          style={{
            height: 48,
            borderRadius: 10,
            backgroundColor: '#F38820',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            opacity: createMutation.isPending ? 0.7 : 1,
          }}
        >
          {createMutation.isPending ? (
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
