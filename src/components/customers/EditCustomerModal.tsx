import React, { useCallback, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptic from 'expo-haptics';
import { useUpdateCustomerMutation } from '@/hooks/queries/useCustomers';
import { CustomerItem } from '@/services/customerService';
import { BrandColors } from '@/constants/colors';
import { fetchTaxInfo } from '@/utils/tax';
import { EMAIL_REGEX, PHONE_REGEX, TAX_ID_REGEX } from '@/utils/validators';

interface EditCustomerModalProps {
  visible: boolean;
  customer?: CustomerItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EditCustomerModal({
  visible,
  customer,
  onClose,
  onSuccess,
}: EditCustomerModalProps) {
  const updateCustomerMutation = useUpdateCustomerMutation();

  const [form, setForm] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    taxId: '',
    address: '',
  });

  const [isFetchingTax, setIsFetchingTax] = useState(false);
  const [taxError, setTaxError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    if (customer) {
      setForm({
        name: customer.name || '',
        phoneNumber: customer.phoneNumber || customer.phone || '',
        email: customer.email || '',
        taxId: customer.taxId || customer.taxCode || '',
        address: customer.address || '',
      });
      setTaxError(null);
    }
  }, [customer]);

  // Tự động kiểm tra MST và điền tên doanh nghiệp & địa chỉ
  useEffect(() => {
    const cleanTaxId = form.taxId?.replace(/[\s-]/g, '');
    if (!cleanTaxId) {
      return;
    }

    if (visible && (cleanTaxId.length === 10 || cleanTaxId.length === 13)) {
      const timer = setTimeout(async () => {
        setIsFetchingTax(true);
        setTaxError(null);
        try {
          const info = await fetchTaxInfo(cleanTaxId);
          if (info && info.name) {
            setForm((prev) => ({
              ...prev,
              name: info.name || prev.name,
              address: info.address || prev.address,
            }));
            setTaxError(null);
            Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
          } else {
            setTaxError('Không tra cứu được mã số thuế');
          }
        } catch {
          setTaxError('Không tra cứu được mã số thuế');
        } finally {
          setIsFetchingTax(false);
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [form.taxId, visible]);

  const handleChange = (key: keyof typeof form, val: string) => {
    if (key === 'taxId') setTaxError(null);
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async () => {
    if (!customer?.id) {
      Alert.alert('Lỗi', 'Không tìm thấy ID khách hàng cần cập nhật.');
      return;
    }

    if (!form.name.trim()) {
      Alert.alert('Lỗi nhập liệu', 'Tên khách hàng là bắt buộc.');
      return;
    }

    if (!form.phoneNumber.trim()) {
      Alert.alert('Lỗi nhập liệu', 'Số điện thoại là bắt buộc.');
      return;
    }

    if (!form.email.trim()) {
      Alert.alert('Lỗi nhập liệu', 'Email là bắt buộc.');
      return;
    }

    if (!form.address.trim()) {
      Alert.alert('Lỗi nhập liệu', 'Địa chỉ là bắt buộc.');
      return;
    }

    const phone = form.phoneNumber.trim().replace(/\s+/g, '');
    if (!PHONE_REGEX.test(phone)) {
      Alert.alert('Lỗi nhập liệu', 'Số điện thoại phải đúng định dạng Việt Nam, ví dụ 0912345678 hoặc +84912345678.');
      return;
    }
    if (!EMAIL_REGEX.test(form.email.trim())) {
      Alert.alert('Lỗi nhập liệu', 'Email liên hệ không đúng định dạng.');
      return;
    }
    if (form.taxId.trim() && !TAX_ID_REGEX.test(form.taxId.trim())) {
      Alert.alert('Lỗi nhập liệu', 'Mã số thuế phải gồm 10 số hoặc dạng 0101234567-001.');
      return;
    }

    try {
      Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Medium);
      await updateCustomerMutation.mutateAsync({
        id: customer.id,
        payload: {
          name: form.name.trim(),
          phoneNumber: phone,
          phone,
          email: form.email.trim(),
          taxId: form.taxId.trim() || undefined,
          taxCode: form.taxId.trim() || undefined,
          address: form.address.trim(),
        },
      });

      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đã cập nhật thông tin khách hàng.');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert('Lỗi cập nhật', err?.message || 'Không thể cập nhật thông tin. Vui lòng thử lại.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} onShow={resetForm}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="bg-white rounded-t-3xl p-5 max-h-[85%] border-t border-slate-200 shadow-xl">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <View className="flex-row items-center gap-2">
              <View className="w-9 h-9 rounded-xl bg-blue-50 items-center justify-center border border-blue-100">
                <Feather name="edit-3" size={18} color={BrandColors.primary} />
              </View>
              <Text className="text-lg font-bold text-slate-900">Chỉnh Sửa Khách Hàng</Text>
            </View>
            <TouchableOpacity
              className="w-12 h-12 rounded-xl bg-slate-100 items-center justify-center"
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Form Body */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
            {/* Tên khách hàng * */}
            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5">
                Tên khách hàng <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900"
                placeholder="Nhập tên công ty / đối tác"
                placeholderTextColor="#94A3B8"
                value={form.name}
                onChangeText={(v) => handleChange('name', v)}
              />
            </View>

            {/* Số điện thoại * */}
            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5">
                Số điện thoại <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900"
                placeholder="Nhập số điện thoại liên hệ"
                keyboardType="phone-pad"
                placeholderTextColor="#94A3B8"
                value={form.phoneNumber}
                onChangeText={(v) => handleChange('phoneNumber', v)}
              />
            </View>

            {/* Email * */}
            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5">
                Email <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900"
                placeholder="Nhập email liên hệ"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#94A3B8"
                value={form.email}
                onChangeText={(v) => handleChange('email', v)}
              />
            </View>

            {/* Mã số thuế */}
            <View>
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xs font-bold text-slate-700">Mã số thuế</Text>
                {isFetchingTax && (
                  <View className="flex-row items-center gap-1">
                    <ActivityIndicator size="small" color={BrandColors.primary} />
                    <Text className="text-[11px] font-medium text-blue-600">Đang tra cứu MST...</Text>
                  </View>
                )}
              </View>
              <TextInput
                className={`bg-slate-50 border ${
                  taxError ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                } rounded-xl px-3.5 py-3 text-sm text-slate-900`}
                placeholder="Nhập mã số thuế (10 hoặc 13 số)"
                keyboardType="numeric"
                placeholderTextColor="#94A3B8"
                value={form.taxId}
                onChangeText={(v) => handleChange('taxId', v)}
              />
              {taxError ? (
                <Text className="text-xs font-semibold text-red-500 mt-1.5 ml-0.5">
                  {taxError}
                </Text>
              ) : null}
            </View>

            {/* Địa chỉ * */}
            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5">
                Địa chỉ <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900"
                placeholder="Nhập địa chỉ trụ sở"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={2}
                value={form.address}
                onChangeText={(v) => handleChange('address', v)}
              />
            </View>
          </ScrollView>

          {/* Footer Submit */}
          <View className="pt-3 border-t border-slate-100 flex-row gap-3">
            <TouchableOpacity
              className="flex-1 py-3.5 rounded-xl bg-slate-100 items-center min-h-[48px] justify-center"
              onPress={onClose}
            >
              <Text className="text-sm font-bold text-slate-600">Hủy bỏ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 py-3.5 rounded-xl bg-primary items-center min-h-[48px] justify-center"
              onPress={handleSubmit}
              disabled={updateCustomerMutation.isPending}
              activeOpacity={0.8}
            >
              {updateCustomerMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-sm font-bold text-white">Lưu thay đổi</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
