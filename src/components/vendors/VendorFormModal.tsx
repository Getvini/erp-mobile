import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useCreateVendorMutation, useUpdateVendorMutation } from '@/hooks/queries/useVendors';
import {
  CreateVendorPayload,
  VENDOR_PHONE_REGEX,
  VENDOR_TYPES,
  VENDOR_TYPE_LABELS,
  VENDOR_UPLOAD_FOLDER,
  VendorItem,
  VendorType,
  getVendorIdentifierError,
  isValidVendorIdentifier,
  requiresIdCard,
} from '@/services/vendorService';
import { uploadToCloudinary } from '@/services/cloudinaryService';
import { VIETNAM_BANKS } from '@/constants/banks';
import { BrandColors } from '@/constants/colors';
import { EMAIL_REGEX } from '@/utils/validators';
import { fetchTaxInfo } from '@/utils/tax';

export interface VendorFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Có giá trị ⇒ chế độ chỉnh sửa (PATCH), ngược lại là tạo mới (POST). */
  vendor?: VendorItem | null;
}

interface VendorFormSheetProps {
  onClose: () => void;
  onSuccess?: () => void;
  vendor?: VendorItem | null;
}

interface VendorFormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  type: VendorType;
  taxId: string;
  bankName: string;
  bankAccount: string;
  idCardFront: string;
  idCardBack: string;
}

type FormErrors = Partial<Record<'name' | 'phone' | 'email' | 'taxId', string>>;

const EMPTY_FORM: VendorFormState = {
  name: '',
  phone: '',
  email: '',
  address: '',
  type: 'BUSINESS',
  taxId: '',
  bankName: '',
  bankAccount: '',
  idCardFront: '',
  idCardBack: '',
};

/** Chuẩn hoá SĐT trước khi gửi: bỏ khoảng trắng/gạch để khớp `phoneRegex` backend. */
const normalizePhone = (value: string): string => value.replace(/[\s.\-()]/g, '');

const buildFormFromVendor = (vendor?: VendorItem | null): VendorFormState => {
  if (!vendor) return { ...EMPTY_FORM };
  return {
    name: vendor.name ?? '',
    phone: vendor.phone ?? '',
    email: vendor.email ?? '',
    address: vendor.address ?? '',
    type: (vendor.type as VendorType) ?? 'BUSINESS',
    taxId: vendor.taxId ?? '',
    bankName: vendor.bankName ?? '',
    bankAccount: vendor.bankAccount ?? '',
    idCardFront: vendor.idCardFront ?? '',
    idCardBack: vendor.idCardBack ?? '',
  };
};

/**
 * Bottom Sheet tạo/chỉnh sửa nhà cung cấp (kéo xuống để đóng).
 * Ảnh CCCD được nén bằng expo-image-manipulator rồi upload Cloudinary TRƯỚC,
 * sau đó mới gửi URL `idCardFront`/`idCardBack` lên backend.
 */
function VendorFormSheet({ onClose, onSuccess, vendor }: VendorFormSheetProps) {
  const isEditing = Boolean(vendor?.id);
  const createVendorMutation = useCreateVendorMutation();
  const updateVendorMutation = useUpdateVendorMutation();

  const [form, setForm] = useState<VendorFormState>(() => buildFormFromVendor(vendor));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isBankPickerOpen, setIsBankPickerOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [uploadingSide, setUploadingSide] = useState<'idCardFront' | 'idCardBack' | null>(null);
  const [isFetchingTax, setIsFetchingTax] = useState(false);
  const [dragY] = useState(() => new Animated.Value(0));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_evt, gesture) => {
          if (gesture.dy > 0) dragY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dy > 120) {
            Animated.timing(dragY, {
              toValue: 640,
              duration: 180,
              useNativeDriver: true,
            }).start(() => onClose());
            return;
          }
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [dragY, onClose],
  );

  // Auto-fill tên/địa chỉ theo MST doanh nghiệp qua VietQR (debounce 500ms).
  useEffect(() => {
    if (form.type !== 'BUSINESS') return;
    const cleanTaxId = form.taxId.replace(/[\s-]/g, '');
    if (cleanTaxId.length !== 10 && cleanTaxId.length !== 13) return;

    const timer = setTimeout(async () => {
      setIsFetchingTax(true);
      try {
        const info = await fetchTaxInfo(cleanTaxId);
        if (info?.name) {
          setForm((prev) => ({
            ...prev,
            name: prev.name.trim() ? prev.name : info.name,
            address: prev.address.trim() ? prev.address : info.address || prev.address,
          }));
        }
      } catch {
        // Bỏ qua lỗi mạng / API tra cứu: người dùng vẫn nhập tay bình thường.
      } finally {
        setIsFetchingTax(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [form.taxId, form.type]);

  const usesIdCard = requiresIdCard(form.type);

  const filteredBanks = useMemo(() => {
    const keyword = bankSearch.trim().toLowerCase();
    if (!keyword) return VIETNAM_BANKS;
    return VIETNAM_BANKS.filter((bank) => bank.toLowerCase().includes(keyword));
  }, [bankSearch]);

  const isSubmitting = createVendorMutation.isPending || updateVendorMutation.isPending;

  const setField = <K extends keyof VendorFormState>(key: K, value: VendorFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'name' || key === 'phone' || key === 'email' || key === 'taxId') {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};
    if (!form.name.trim()) {
      nextErrors.name = 'Vui lòng nhập tên nhà cung cấp.';
    }

    const phone = normalizePhone(form.phone);
    if (phone && !VENDOR_PHONE_REGEX.test(phone)) {
      nextErrors.phone = 'SĐT phải gồm 10-15 chữ số (có thể bắt đầu bằng +).';
    }

    const email = form.email.trim();
    if (email && !EMAIL_REGEX.test(email)) {
      nextErrors.email = 'Email không đúng định dạng.';
    }

    const taxId = form.taxId.trim();
    if (taxId && !isValidVendorIdentifier(taxId, form.type)) {
      nextErrors.taxId = getVendorIdentifierError(form.type);
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePickImage = async (side: 'idCardFront' | 'idCardBack', fromCamera: boolean) => {
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Quyền truy cập',
          fromCamera ? 'Vui lòng cấp quyền Camera để chụp ảnh CCCD.' : 'Vui lòng cấp quyền thư viện ảnh.',
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      const asset = result.canceled ? undefined : result.assets?.[0];
      if (!asset?.uri) return;

      setUploadingSide(side);

      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );

      const uploaded = await uploadToCloudinary(
        {
          uri: manipulated.uri,
          name: asset.fileName || `cccd-${side}.jpg`,
          mimeType: 'image/jpeg',
        },
        VENDOR_UPLOAD_FOLDER,
      );

      setField(side, uploaded.url);
      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
    } catch (err: any) {
      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert('Lỗi tải ảnh', err?.message || 'Không thể tải ảnh CCCD lên hệ thống.');
    } finally {
      setUploadingSide(null);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) {
      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Warning);
      return;
    }

    // name/phone/address/email là NOT NULL ở backend ⇒ luôn gửi chuỗi.
    const payload: CreateVendorPayload = {
      name: form.name.trim(),
      phone: normalizePhone(form.phone),
      email: form.email.trim(),
      address: form.address.trim(),
      taxId: form.taxId.trim(),
      type: form.type,
      bankName: form.bankName.trim(),
      bankAccount: form.bankAccount.trim(),
      idCardFront: form.idCardFront,
      idCardBack: form.idCardBack,
    };

    try {
      await Haptic.impactAsync(Haptic.ImpactFeedbackStyle.Medium);
      if (isEditing && vendor) {
        // `type` luôn được service gửi kèm để backend không xử nhầm MST/CCCD.
        await updateVendorMutation.mutateAsync({ id: vendor.id, ...payload });
      } else {
        await createVendorMutation.mutateAsync(payload);
      }

      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Success);
      Alert.alert('Thành công', isEditing ? 'Đã cập nhật nhà cung cấp.' : 'Đã tạo mới nhà cung cấp.');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      await Haptic.notificationAsync(Haptic.NotificationFeedbackType.Error);
      Alert.alert('Lỗi', err?.message || 'Không thể lưu nhà cung cấp. Vui lòng thử lại.');
    }
  };

  const renderImageSlot = (side: 'idCardFront' | 'idCardBack', label: string) => {
    const url = form[side];
    const isUploading = uploadingSide === side;

    return (
      <View className="flex-1">
        <Text className="mb-1.5 text-xs font-bold text-slate-700">{label}</Text>
        {url ? (
          <View className="overflow-hidden rounded-xl border border-slate-200">
            <Image source={{ uri: url }} className="h-24 w-full" resizeMode="cover" />
            <View className="flex-row">
              <TouchableOpacity
                className="min-h-[44px] flex-1 items-center justify-center bg-slate-100"
                onPress={() => handlePickImage(side, false)}
                disabled={isUploading}
              >
                <Text className="text-[11px] font-bold text-slate-600">Đổi ảnh</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="min-h-[44px] flex-1 items-center justify-center bg-red-50"
                onPress={() => setField(side, '')}
                disabled={isUploading}
              >
                <Text className="text-[11px] font-bold text-red-600">Xoá</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            testID={`vendorPickImage-${side}`}
            className="h-24 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50"
            onPress={() => handlePickImage(side, false)}
            disabled={isUploading}
            accessibilityRole="button"
            accessibilityLabel={`Tải ảnh ${label}`}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={BrandColors.primary} />
            ) : (
              <>
                <Feather name="camera" size={18} color="#94A3B8" />
                <Text className="mt-1 text-[11px] font-semibold text-slate-400">Chọn ảnh</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 justify-end bg-slate-900/50"
    >
      <Animated.View
        style={{ transform: [{ translateY: dragY }] }}
        className="max-h-[90%] rounded-t-[24px] border-t border-slate-200 bg-white"
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} className="items-center pt-3">
          <View className="h-1.5 w-12 rounded-full bg-slate-300" />
        </View>

        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-slate-100 px-5 pb-3 pt-2">
          <View className="flex-row items-center gap-2">
            <View className="h-9 w-9 items-center justify-center rounded-xl border border-orange-100 bg-orange-50">
              <Feather name="truck" size={18} color={BrandColors.primary} />
            </View>
            <Text className="text-lg font-bold text-slate-900">
              {isEditing ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}
            </Text>
          </View>
          <TouchableOpacity
            className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Đóng biểu mẫu"
          >
            <Feather name="x" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-5 pt-4 pb-6 gap-3.5"
        >
          {/* Tên */}
          <View>
            <Text className="mb-1.5 text-xs font-bold text-slate-700">
              Tên nhà cung cấp <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              testID="vendorNameInput"
              className={`rounded-xl border px-3.5 py-3 text-sm text-slate-900 ${
                errors.name ? 'border-red-400 bg-red-50/30' : 'border-slate-200 bg-slate-50'
              }`}
              placeholder="VD: Công ty TNHH Sản xuất ABC"
              placeholderTextColor="#94A3B8"
              value={form.name}
              onChangeText={(value) => setField('name', value)}
            />
            {errors.name ? (
              <Text className="mt-1 text-xs font-semibold text-red-500">{errors.name}</Text>
            ) : null}
          </View>

          {/* Loại nhà cung cấp */}
          <View>
            <Text className="mb-1.5 text-xs font-bold text-slate-700">Loại nhà cung cấp</Text>
            <View className="flex-row gap-2">
              {VENDOR_TYPES.map((type) => {
                const isActive = form.type === type;
                return (
                  <TouchableOpacity
                    key={type}
                    testID={`vendorType-${type}`}
                    className={`min-h-[48px] flex-1 items-center justify-center rounded-xl border px-2 py-2 ${
                      isActive ? 'border-primary bg-primary' : 'border-slate-200 bg-slate-50'
                    }`}
                    onPress={() => setField('type', type)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      className={`text-center text-[11px] ${isActive ? 'font-bold text-white' : 'font-semibold text-slate-600'}`}
                    >
                      {VENDOR_TYPE_LABELS[type]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* SĐT + Email */}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="mb-1.5 text-xs font-bold text-slate-700">Số điện thoại</Text>
              <TextInput
                testID="vendorPhoneInput"
                className={`rounded-xl border px-3.5 py-3 text-sm text-slate-900 ${
                  errors.phone ? 'border-red-400 bg-red-50/30' : 'border-slate-200 bg-slate-50'
                }`}
                placeholder="0912345678"
                keyboardType="phone-pad"
                placeholderTextColor="#94A3B8"
                value={form.phone}
                onChangeText={(value) => setField('phone', value)}
              />
              {errors.phone ? (
                <Text className="mt-1 text-xs font-semibold text-red-500">{errors.phone}</Text>
              ) : null}
            </View>

            <View className="flex-1">
              <Text className="mb-1.5 text-xs font-bold text-slate-700">Email</Text>
              <TextInput
                testID="vendorEmailInput"
                className={`rounded-xl border px-3.5 py-3 text-sm text-slate-900 ${
                  errors.email ? 'border-red-400 bg-red-50/30' : 'border-slate-200 bg-slate-50'
                }`}
                placeholder="contact@abc.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#94A3B8"
                value={form.email}
                onChangeText={(value) => setField('email', value)}
              />
              {errors.email ? (
                <Text className="mt-1 text-xs font-semibold text-red-500">{errors.email}</Text>
              ) : null}
            </View>
          </View>

          {/* Địa chỉ */}
          <View>
            <Text className="mb-1.5 text-xs font-bold text-slate-700">Địa chỉ</Text>
            <TextInput
              testID="vendorAddressInput"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
              placeholder="Số 1, Đường ABC, Quận 1, TP.HCM"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={2}
              value={form.address}
              onChangeText={(value) => setField('address', value)}
            />
          </View>

          {/* MST / CCCD */}
          <View>
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text className="text-xs font-bold text-slate-700">
                {usesIdCard ? 'Số CCCD/CMND' : 'Mã số thuế'}
              </Text>
              {isFetchingTax ? <ActivityIndicator size="small" color={BrandColors.primary} /> : null}
            </View>
            <TextInput
              testID="vendorTaxIdInput"
              className={`rounded-xl border px-3.5 py-3 text-sm text-slate-900 ${
                errors.taxId ? 'border-red-400 bg-red-50/30' : 'border-slate-200 bg-slate-50'
              }`}
              placeholder={usesIdCard ? '9 hoặc 12 chữ số' : '0101234567 hoặc 0101234567-001'}
              keyboardType={usesIdCard ? 'number-pad' : 'default'}
              placeholderTextColor="#94A3B8"
              value={form.taxId}
              onChangeText={(value) => setField('taxId', value)}
            />
            {errors.taxId ? (
              <Text className="mt-1 text-xs font-semibold text-red-500">{errors.taxId}</Text>
            ) : (
              <Text className="mt-1 text-[11px] text-slate-400">
                {usesIdCard
                  ? 'Cá nhân/KOL/KOC dùng số CCCD 9 hoặc 12 chữ số.'
                  : 'Doanh nghiệp dùng MST 10 chữ số hoặc dạng 0101234567-001.'}
              </Text>
            )}
          </View>

          {/* Ngân hàng */}
          <View>
            <Text className="mb-1.5 text-xs font-bold text-slate-700">Ngân hàng</Text>
            <TouchableOpacity
              testID="vendorBankPicker"
              className="min-h-[48px] flex-row items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5"
              onPress={() => {
                setIsBankPickerOpen((prev) => !prev);
                setBankSearch('');
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text
                className={`text-sm ${form.bankName ? 'font-semibold text-slate-900' : 'text-slate-400'}`}
                numberOfLines={1}
              >
                {form.bankName || 'Chọn ngân hàng thụ hưởng'}
              </Text>
              <Feather name={isBankPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#94A3B8" />
            </TouchableOpacity>

            {isBankPickerOpen ? (
              <View className="mt-2 rounded-xl border border-slate-200 bg-white p-2">
                <View className="mb-2 flex-row items-center rounded-lg bg-slate-100 px-2.5">
                  <Feather name="search" size={15} color="#94A3B8" />
                  <TextInput
                    className="ml-2 h-[40px] flex-1 text-sm text-slate-900"
                    placeholder="Tìm ngân hàng..."
                    placeholderTextColor="#94A3B8"
                    value={bankSearch}
                    onChangeText={setBankSearch}
                  />
                </View>
                <ScrollView nestedScrollEnabled className="max-h-[190px]">
                  {filteredBanks.length === 0 ? (
                    <Text className="py-3 text-center text-xs text-slate-400">
                      Không tìm thấy ngân hàng phù hợp.
                    </Text>
                  ) : (
                    filteredBanks.map((bank) => (
                      <TouchableOpacity
                        key={bank}
                        className={`min-h-[44px] justify-center rounded-lg px-3 ${
                          form.bankName === bank ? 'bg-orange-50' : ''
                        }`}
                        onPress={() => {
                          setField('bankName', bank);
                          setIsBankPickerOpen(false);
                          setBankSearch('');
                        }}
                      >
                        <Text
                          className={`text-sm ${
                            form.bankName === bank ? 'font-bold text-orange-600' : 'text-slate-700'
                          }`}
                        >
                          {bank}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            ) : null}
          </View>

          {/* Số tài khoản */}
          <View>
            <Text className="mb-1.5 text-xs font-bold text-slate-700">Số tài khoản</Text>
            <TextInput
              testID="vendorBankAccountInput"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
              placeholder="0123456789"
              keyboardType="number-pad"
              placeholderTextColor="#94A3B8"
              value={form.bankAccount}
              onChangeText={(value) => setField('bankAccount', value)}
            />
          </View>

          {/* Ảnh CCCD — chỉ hiện với INDIVIDUAL/KOL/KOC */}
          {usesIdCard ? (
            <View>
              <View className="mb-1.5 flex-row items-center gap-1.5">
                <Feather name="credit-card" size={13} color="#64748B" />
                <Text className="text-xs font-bold text-slate-700">Ảnh CCCD/CMND</Text>
              </View>
              <View className="flex-row gap-3">
                {renderImageSlot('idCardFront', 'Mặt trước')}
                {renderImageSlot('idCardBack', 'Mặt sau')}
              </View>
              <Text className="mt-1.5 text-[11px] text-slate-400">
                Ảnh được nén và tải lên Cloudinary trước khi lưu hồ sơ.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Nút lưu */}
        <View className="border-t border-slate-100 px-5 pb-6 pt-3">
          <TouchableOpacity
            testID="vendorSubmitButton"
            className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl bg-primary"
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="save" size={18} color="#FFFFFF" />
                <Text className="text-sm font-extrabold text-white">
                  {isEditing ? 'Lưu thay đổi' : 'Lưu nhà cung cấp'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

/**
 * Sheet chỉ được mount khi mở ⇒ state luôn được khởi tạo mới từ `vendor`,
 * không cần effect reset state (tránh cascading render).
 */
export default function VendorFormModal({ visible, onClose, onSuccess, vendor }: VendorFormModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {visible ? <VendorFormSheet vendor={vendor} onClose={onClose} onSuccess={onSuccess} /> : null}
    </Modal>
  );
}
