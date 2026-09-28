import React, { useState, useEffect } from 'react';
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
import { useCreateCustomerMutation } from '@/hooks/queries/useCustomers';
import { BrandColors } from '@/constants/colors';
import { fetchTaxInfo } from '@/utils/tax';
import { EMAIL_REGEX, IDENTIFIER_REGEX, PHONE_REGEX, TAX_ID_REGEX } from '@/utils/validators';

interface CreateCustomerModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateCustomerModal({ visible, onClose, onSuccess }: CreateCustomerModalProps) {
  const createCustomerMutation = useCreateCustomerMutation();

  const [form, setForm] = useState({
    name: '',
    code: '',
    taxId: '',
    phoneNumber: '',
    email: '',
    address: '',
  });

  const [isFetchingTax, setIsFetchingTax] = useState(false);
  const [taxError, setTaxError] = useState<string | null>(null);

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
    if (!form.name.trim()) {
      Alert.alert('Lỗi nhập liệu', 'Vui lòng nhập tên công ty / đối tác.');
      return;
    }

    const phone = form.phoneNumber.trim().replace(/\s+/g, '');
    if (phone && !PHONE_REGEX.test(phone)) {
      Alert.alert('Lỗi nhập liệu', 'Số điện thoại phải đúng định dạng Việt Nam, ví dụ 0912345678 hoặc +84912345678.');
      return;
    }
    if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim())) {
      Alert.alert('Lỗi nhập liệu', 'Email liên hệ không đúng định dạng.');
      return;
    }
    if (form.taxId.trim() && !TAX_ID_REGEX.test(form.taxId.trim())) {
      Alert.alert('Lỗi nhập liệu', 'Mã số thuế phải gồm 10 số hoặc dạng 0101234567-001.');
      return;
    }
    if (form.code.trim() && !IDENTIFIER_REGEX.test(form.code.trim())) {
      Alert.alert('Lỗi nhập liệu', 'Mã đối tác phải gồm 3-30 ký tự in hoa, số, dấu gạch ngang hoặc gạch dưới.');
      return;
    }

    try {
      Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Medium);
      await createCustomerMutation.mutateAsync({
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
        phoneNumber: phone || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      });

      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đã tạo mới hồ sơ khách hàng.');
      setForm({
        name: '',
        code: '',
        taxId: '',
        phoneNumber: '',
        email: '',
        address: '',
      });
      setTaxError(null);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert('Lỗi khởi tạo', err?.message || 'Không thể tạo mới khách hàng. Vui lòng thử lại.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/50"
      >
        <View className="bg-white rounded-t-3xl p-5 max-h-[85%] border-t border-slate-200 shadow-xl">
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <View className="flex-row items-center gap-2">
              <View className="w-9 h-9 rounded-xl bg-blue-50 items-center justify-center border border-blue-100">
                <Feather name="user-plus" size={18} color={BrandColors.primary} />
              </View>
              <Text className="text-lg font-bold text-slate-900">Thêm Khách hàng mới</Text>
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
          <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-3.5 pb-6">
            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5">
                Tên Doanh nghiệp / Khách hàng <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900"
                placeholder="VD: Công ty TNHH Tập đoàn ABC"
                placeholderTextColor="#94A3B8"
                value={form.name}
                onChangeText={(v) => handleChange('name', v)}
              />
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-xs font-bold text-slate-700 mb-1.5">Mã đối tác</Text>
                <TextInput
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900"
                  placeholder="VD: KH-ABC"
                  placeholderTextColor="#94A3B8"
                  value={form.code}
                  onChangeText={(v) => handleChange('code', v)}
                />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-xs font-bold text-slate-700">Mã số thuế</Text>
                  {isFetchingTax && <ActivityIndicator size="small" color={BrandColors.primary} />}
                </View>
                <TextInput
                  className={`bg-slate-50 border ${
                    taxError ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                  } rounded-xl px-3.5 py-3 text-sm text-slate-900`}
                  placeholder="0101234567"
                  keyboardType="numeric"
                  placeholderTextColor="#94A3B8"
                  value={form.taxId}
                  onChangeText={(v) => handleChange('taxId', v)}
                />
                {taxError ? (
                  <Text className="text-xs font-semibold text-red-500 mt-1">
                    Không tra cứu được mã số thuế
                  </Text>
                ) : null}
              </View>
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5">Số điện thoại</Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900"
                placeholder="0912345678"
                keyboardType="phone-pad"
                placeholderTextColor="#94A3B8"
                value={form.phoneNumber}
                onChangeText={(v) => handleChange('phoneNumber', v)}
              />
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5">Email liên hệ</Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900"
                placeholder="contact@abc.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#94A3B8"
                value={form.email}
                onChangeText={(v) => handleChange('email', v)}
              />
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5">Địa chỉ trụ sở</Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-900"
                placeholder="Tầng 5, Tòa nhà ABC, Cầu Giấy, Hà Nội"
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
              disabled={createCustomerMutation.isPending}
              activeOpacity={0.8}
            >
              {createCustomerMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-sm font-bold text-white">Lưu Khách hàng</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
