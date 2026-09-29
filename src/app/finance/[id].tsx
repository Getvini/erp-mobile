import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptic from 'expo-haptics';
import { getFinanceStatusConfig } from '@/services/financeService';
import { BrandColors } from '@/constants/colors';
import { safeGoBack } from '@/utils/navigation';
import {
  useApprovePaymentPeriodMutation,
  usePaymentPeriodDetailQuery,
  useRejectPaymentPeriodMutation,
} from '@/hooks/queries/useFinance';

export default function PaymentApprovalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const paymentPeriodId = String(id || '');
  const { data: period, isLoading: loading } = usePaymentPeriodDetailQuery(paymentPeriodId);
  const approveMutation = useApprovePaymentPeriodMutation();
  const rejectMutation = useRejectPaymentPeriodMutation();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const submitting = approveMutation.isPending || rejectMutation.isPending;

  const formatVND = (amount?: number) => {
    if (amount === undefined || amount === null) return '0 ₫';
    return amount.toLocaleString('vi-VN') + ' ₫';
  };

  const handleApprove = async () => {
    Alert.alert(
      'Xác nhận Phê duyệt',
      `Bạn có chắc chắn muốn duyệt đợt thanh toán ${formatVND(period?.amount)} cho ${period?.customerName}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Duyệt ngay',
          style: 'default',
          onPress: async () => {
            try {
              Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Heavy);
              await approveMutation.mutateAsync(paymentPeriodId);
              Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
              Alert.alert('Thành công', 'Đã phê duyệt đợt thanh toán.');
              safeGoBack(router, '/finance');
            } catch (err: any) {
              Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
              Alert.alert('Lỗi phê duyệt', err?.message || 'Không thể phê duyệt.');
            }
          },
        },
      ]
    );
  };

  const handleReject = async () => {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }

    try {
      Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Medium);
      await rejectMutation.mutateAsync({ id: paymentPeriodId, reason: rejectReason });
      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Warning);
      Alert.alert('Đã từ chối', 'Đã từ chối đợt thanh toán này.');
      safeGoBack(router, '/finance');
    } catch (err: any) {
      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert('Lỗi', err?.message || 'Không thể thực hiện.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center gap-2.5" edges={['top']}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text className="text-xs text-slate-400">Đang tải chi tiết đợt thanh toán...</Text>
      </SafeAreaView>
    );
  }

  if (!period) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 justify-center items-center p-6 gap-3" edges={['top']}>
        <Feather name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-base font-bold text-slate-800">Không tìm thấy đợt thanh toán</Text>
        <TouchableOpacity
          className="mt-2 bg-slate-900 px-5 py-3 rounded-xl min-h-[44px] justify-center"
          onPress={() => safeGoBack(router, '/finance')}
        >
          <Text className="text-sm font-bold text-white">Quay lại danh sách</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isPending = period.status === 'PENDING';
  const statusConfig = getFinanceStatusConfig(period.status);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <TouchableOpacity
          className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center min-w-[44px] min-h-[44px]"
          onPress={() => safeGoBack(router, '/finance')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <Text className="text-[17px] font-bold text-slate-900">Chi tiết Phê duyệt Chi</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* Amount Hero Card */}
        <View className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm items-center">
          <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            Số tiền thanh toán
          </Text>
          <Text className="text-3xl font-black text-blue-600 mb-2">
            {formatVND(period.amount)}
          </Text>
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: statusConfig.bg }}
          >
            <Text
              className="text-xs font-bold"
              style={{ color: statusConfig.color }}
            >
              TRẠNG THÁI: {statusConfig.text}
            </Text>
          </View>
        </View>

        {/* Detail Info Card */}
        <View className="bg-white rounded-2xl p-5 border border-slate-200 gap-4 shadow-sm">
          <View>
            <Text className="text-xs font-bold text-slate-400 mb-1 uppercase">HẠNG MỤC THANH TOÁN</Text>
            <Text className="text-base font-bold text-slate-900">{period.title}</Text>
          </View>

          <View className="border-t border-slate-100 pt-3">
            <Text className="text-xs font-bold text-slate-400 mb-1 uppercase">ĐỐI TÁC HỢP ĐỒNG</Text>
            <Text className="text-sm font-bold text-slate-800">{period.customerName || 'N/A'}</Text>
          </View>

          <View className="border-t border-slate-100 pt-3 flex-row justify-between">
            <View>
              <Text className="text-xs font-bold text-slate-400 mb-1 uppercase">MÃ HỢP ĐỒNG</Text>
              <Text className="text-sm font-bold text-blue-600">{period.contractCode || 'N/A'}</Text>
            </View>
            <View>
              <Text className="text-xs font-bold text-slate-400 mb-1 uppercase">HẠN THANH TOÁN</Text>
              <Text className="text-sm font-bold text-slate-800">{period.dueDate}</Text>
            </View>
          </View>

          {period.note && (
            <View className="border-t border-slate-100 pt-3">
              <Text className="text-xs font-bold text-slate-400 mb-1 uppercase">GHI CHÚ / CHỨNG TỪ</Text>
              <Text className="text-sm text-slate-700 leading-5">{period.note}</Text>
            </View>
          )}
        </View>

        {/* Reject Reason input if activated */}
        {showRejectInput && (
          <View className="bg-white rounded-2xl p-4 border border-rose-200 bg-rose-50/30 gap-2">
            <Text className="text-xs font-bold text-rose-700">Lý do từ chối phê duyệt (Không bắt buộc):</Text>
            <TextInput
              className="bg-white border border-rose-200 rounded-xl p-3 text-sm text-slate-900"
              placeholder="VD: Thiếu hóa đơn VAT / Cần bổ sung biên bản nghiệm thu"
              placeholderTextColor="#94A3B8"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={2}
            />
          </View>
        )}
      </ScrollView>

      {/* Action Footer Buttons (Only for PENDING status) */}
      {isPending && (
        <View className="p-4 bg-white border-t border-slate-200 flex-row gap-3">
          <TouchableOpacity
            className="flex-1 py-3.5 rounded-xl bg-rose-50 border border-rose-200 items-center justify-center min-h-[48px]"
            onPress={handleReject}
            disabled={submitting}
            activeOpacity={0.8}
          >
            <Text className="text-sm font-bold text-rose-600">
              {showRejectInput ? 'Xác nhận Từ chối' : 'Từ chối'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 py-3.5 rounded-xl bg-emerald-600 items-center justify-center min-h-[48px]"
            onPress={handleApprove}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text className="text-sm font-bold text-white">Phê duyệt Chi</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
