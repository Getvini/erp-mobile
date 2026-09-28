import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptic from 'expo-haptics';
import {
  useCreateReferralPartnerMutation,
  useUpdateReferralPartnerMutation,
} from '@/hooks/queries/useReferralPartners';
import {
  ReferralPartnerItem,
  ReferralPartnerPayload,
  ReferralPartnerType,
} from '@/services/referralPartnerService';
import { BrandColors } from '@/constants/colors';
import { EMAIL_REGEX } from '@/utils/validators';

/** Backend: ERP/src/modules/vendor/validations/Partner.Validation.ts */
const PARTNER_PHONE_REGEX = /^\+?[0-9]{10,15}$/;
const BUSINESS_TAX_ID_REGEX = /^\d{10}(\s?-\s?\d{3})?$/;
const INDIVIDUAL_ID_REGEX = /^(\d{9}|\d{12})$/;

const DISMISS_THRESHOLD = 120;

interface PartnerFormModalProps {
  visible: boolean;
  /** Có `partner` → chế độ sửa (PUT, prefill); không có → tạo mới (POST). */
  partner?: ReferralPartnerItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface PartnerFormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  type: ReferralPartnerType;
}

const EMPTY_FORM: PartnerFormState = {
  name: '',
  email: '',
  phone: '',
  address: '',
  taxId: '',
  type: 'BUSINESS',
};

export default function PartnerFormModal({
  visible,
  partner,
  onClose,
  onSuccess,
}: PartnerFormModalProps) {
  const isEditing = Boolean(partner?.id);
  const createMutation = useCreateReferralPartnerMutation();
  const updateMutation = useUpdateReferralPartnerMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [form, setForm] = useState<PartnerFormState>(EMPTY_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [translateY] = useState(() => new Animated.Value(0));

  // Prefill khi sheet mở (Modal.onShow): sửa → dữ liệu đối tác, tạo mới → form rỗng.
  const resetForm = useCallback(() => {
    translateY.setValue(0);
    setSubmitError(null);
    setForm(
      partner
        ? {
            name: partner.name || '',
            email: partner.email || '',
            phone: partner.phone || '',
            address: partner.address || '',
            taxId: partner.taxId || '',
            type: partner.type === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'BUSINESS',
          }
        : EMPTY_FORM,
    );
  }, [partner, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) => gesture.dy > 6,
        onPanResponderMove: (_evt, gesture) => {
          if (gesture.dy > 0) translateY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dy > DISMISS_THRESHOLD) {
            translateY.setValue(0);
            onClose();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        },
      }),
    [onClose, translateY],
  );

  const handleTextChange = useCallback(
    (key: 'name' | 'email' | 'phone' | 'address' | 'taxId', value: string) => {
      setSubmitError(null);
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleTypeChange = useCallback((type: ReferralPartnerType) => {
    setSubmitError(null);
    setForm((prev) => ({ ...prev, type }));
  }, []);

  const validate = useCallback((): string | null => {
    if (!form.name.trim()) {
      return 'Vui lòng nhập tên đối tác.';
    }

    const email = form.email.trim();
    if (email && !EMAIL_REGEX.test(email)) {
      return 'Email liên hệ không đúng định dạng.';
    }

    const phone = form.phone.trim().replace(/\s+/g, '');
    if (phone && !PARTNER_PHONE_REGEX.test(phone)) {
      return 'Số điện thoại phải gồm 10-15 chữ số, có thể bắt đầu bằng dấu +.';
    }

    const taxId = form.taxId.trim();
    if (taxId) {
      if (form.type === 'INDIVIDUAL') {
        if (!INDIVIDUAL_ID_REGEX.test(taxId)) {
          return 'CCCD/CMND không hợp lệ (phải là 9 hoặc 12 chữ số).';
        }
      } else if (!BUSINESS_TAX_ID_REGEX.test(taxId)) {
        return 'Mã số thuế không hợp lệ (10 chữ số hoặc dạng 0123456789-001).';
      }
    }

    return null;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    if (isPending) return;

    const validationError = validate();
    if (validationError) {
      setSubmitError(validationError);
      Alert.alert('Lỗi nhập liệu', validationError);
      return;
    }

    const payload: ReferralPartnerPayload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      taxId: form.taxId.trim(),
      type: form.type,
    };

    try {
      Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Medium);
      if (partner?.id) {
        await updateMutation.mutateAsync({ id: partner.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }

      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
      Alert.alert(
        'Thành công',
        isEditing ? 'Đã cập nhật thông tin đối tác.' : 'Đã tạo mới đối tác giới thiệu.',
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Không thể lưu thông tin đối tác. Vui lòng thử lại.';
      setSubmitError(message);
      Alert.alert('Lỗi lưu dữ liệu', message);
    }
  }, [createMutation, form, isPending, onClose, onSuccess, partner, updateMutation, validate]);

  const taxIdLabel = form.type === 'INDIVIDUAL' ? 'CCCD' : 'Mã số thuế';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={resetForm}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-slate-900/50"
      >
        <Animated.View
          testID="partnerFormModal"
          className="max-h-[90%] rounded-t-[24px] border-t border-slate-200 bg-white shadow-xl"
          style={{ transform: [{ translateY }] }}
        >
          {/* Draggable handle */}
          <View {...panResponder.panHandlers} className="items-center pb-1 pt-3">
            <View className="h-1.5 w-12 rounded-full bg-slate-300" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-slate-100 px-5 pb-3 pt-2">
            <View className="flex-row items-center gap-2">
              <View className="h-9 w-9 items-center justify-center rounded-xl border border-orange-100 bg-orange-50">
                <Feather name="users" size={18} color={BrandColors.primary} />
              </View>
              <Text className="text-lg font-bold text-slate-900">
                {isEditing ? 'Sửa đối tác giới thiệu' : 'Thêm đối tác giới thiệu'}
              </Text>
            </View>
            <TouchableOpacity
              testID="partnerFormCloseButton"
              className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Đóng biểu mẫu đối tác"
            >
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="gap-3.5 px-5 pb-6 pt-4"
          >
            {/* Tên đối tác */}
            <View>
              <Text className="mb-1.5 text-xs font-bold text-slate-700">
                Tên đối tác <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                testID="partnerFormNameInput"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
                placeholder="VD: Công ty TNHH Truyền thông ABC"
                placeholderTextColor="#94A3B8"
                value={form.name}
                onChangeText={(value) => handleTextChange('name', value)}
              />
            </View>

            {/* Loại đối tác — segmented */}
            <View>
              <Text className="mb-1.5 text-xs font-bold text-slate-700">Loại đối tác</Text>
              <View className="flex-row rounded-xl bg-slate-100 p-1">
                {(
                  [
                    { key: 'BUSINESS', label: 'Doanh nghiệp' },
                    { key: 'INDIVIDUAL', label: 'Cá nhân' },
                  ] as { key: ReferralPartnerType; label: string }[]
                ).map((option) => {
                  const isActive = form.type === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      testID={`partnerFormType-${option.key}`}
                      className={`min-h-[48px] flex-1 items-center justify-center rounded-lg ${
                        isActive ? 'bg-white' : ''
                      }`}
                      onPress={() => handleTypeChange(option.key)}
                      activeOpacity={0.75}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isActive ? 'text-orange-600' : 'text-slate-500'
                        }`}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Mã số thuế / CCCD */}
            <View>
              <Text className="mb-1.5 text-xs font-bold text-slate-700">{taxIdLabel}</Text>
              <TextInput
                testID="partnerFormTaxIdInput"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
                placeholder={
                  form.type === 'INDIVIDUAL' ? 'VD: 001099012345' : 'VD: 0101234567 hoặc 0101234567-001'
                }
                placeholderTextColor="#94A3B8"
                value={form.taxId}
                onChangeText={(value) => handleTextChange('taxId', value)}
              />
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-1.5 text-xs font-bold text-slate-700">Email</Text>
                <TextInput
                  testID="partnerFormEmailInput"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
                  placeholder="partner@abc.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={form.email}
                  onChangeText={(value) => handleTextChange('email', value)}
                />
              </View>

              <View className="flex-1">
                <Text className="mb-1.5 text-xs font-bold text-slate-700">Số điện thoại</Text>
                <TextInput
                  testID="partnerFormPhoneInput"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
                  placeholder="0912345678"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  value={form.phone}
                  onChangeText={(value) => handleTextChange('phone', value)}
                />
              </View>
            </View>

            <View>
              <Text className="mb-1.5 text-xs font-bold text-slate-700">Địa chỉ</Text>
              <TextInput
                testID="partnerFormAddressInput"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={2}
                value={form.address}
                onChangeText={(value) => handleTextChange('address', value)}
              />
            </View>

            {submitError ? (
              <View className="flex-row items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3">
                <Feather name="alert-circle" size={14} color={BrandColors.error} />
                <Text className="flex-1 text-xs font-semibold text-red-600">{submitError}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View className="flex-row gap-3 border-t border-slate-100 px-5 pb-6 pt-3">
            <TouchableOpacity
              className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-slate-100 py-3.5"
              onPress={onClose}
              activeOpacity={0.75}
              accessibilityRole="button"
            >
              <Text className="text-sm font-bold text-slate-600">Hủy bỏ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="partnerFormSubmitButton"
              className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-primary py-3.5"
              onPress={handleSubmit}
              disabled={isPending}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityState={{ disabled: isPending }}
            >
              {isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-sm font-bold text-white">
                  {isEditing ? 'Lưu thay đổi' : 'Tạo đối tác'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
