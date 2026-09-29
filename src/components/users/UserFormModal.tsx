import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useCreateUserMutation,
  useUpdateUserMutation,
} from '@/hooks/queries/useUsers';
import {
  DEFAULT_USER_ROLE,
  getUserAccount,
  USER_ROLE_OPTIONS,
  UserItem,
} from '@/services/userService';
import { BrandColors } from '@/constants/colors';
import { EMAIL_REGEX } from '@/utils/validators';

/** Backend không có enum trạng thái — chỉ ràng buộc định dạng SĐT quốc tế/nội địa. */
const USER_PHONE_REGEX = /^\+?[0-9]{10,15}$/;

interface UserFormModalProps {
  visible: boolean;
  onClose: () => void;
  /** Có `user` ⇒ chế độ Sửa. Không có ⇒ chế độ Tạo mới. */
  user?: UserItem | null;
  onSuccess?: () => void;
}

interface UserFormState {
  username: string;
  password: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
  isLocked: boolean;
}

const EMPTY_FORM: UserFormState = {
  username: '',
  password: '',
  fullName: '',
  email: '',
  phoneNumber: '',
  role: DEFAULT_USER_ROLE,
  isActive: true,
  isLocked: false,
};

/**
 * Sheet được mount mới mỗi lần mở ⇒ state khởi tạo trực tiếp từ props,
 * không cần useEffect đồng bộ (tránh cascading render).
 */
const buildFormState = (user?: UserItem | null): UserFormState => {
  if (!user) return { ...EMPTY_FORM };
  const account = getUserAccount(user);
  return {
    username: account?.username || '',
    password: '',
    fullName: user.fullName || '',
    email: account?.email || '',
    phoneNumber: user.phoneNumber || '',
    role: account?.role || DEFAULT_USER_ROLE,
    isActive: account?.isActive !== false,
    isLocked: Boolean(user.isLocked),
  };
};

interface UserFormSheetProps {
  user?: UserItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const UserFormSheet: React.FC<UserFormSheetProps> = ({ user, onClose, onSuccess }) => {
  const isEditMode = Boolean(user?.id);

  const createUserMutation = useCreateUserMutation();
  const updateUserMutation = useUpdateUserMutation();
  const isSubmitting = createUserMutation.isPending || updateUserMutation.isPending;

  const [form, setForm] = useState<UserFormState>(() => buildFormState(user));
  const [showPassword, setShowPassword] = useState(false);

  const setField = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): string | null => {
    if (!isEditMode) {
      if (!form.username.trim()) return 'Vui lòng nhập tên đăng nhập.';
      if (!form.password.trim()) return 'Vui lòng nhập mật khẩu.';
    }
    if (!form.fullName.trim()) return 'Vui lòng nhập họ tên nhân sự.';
    if (!form.role) return 'Vui lòng chọn vai trò.';

    const email = form.email.trim();
    if (email && !EMAIL_REGEX.test(email)) return 'Email không đúng định dạng.';

    const phone = form.phoneNumber.trim().replace(/\s+/g, '');
    if (phone && !USER_PHONE_REGEX.test(phone)) {
      return 'Số điện thoại phải gồm 10-15 chữ số, có thể bắt đầu bằng dấu +.';
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Lỗi nhập liệu', validationError);
      return;
    }

    const email = form.email.trim();
    const phone = form.phoneNumber.trim().replace(/\s+/g, '');

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (isEditMode && user) {
        await updateUserMutation.mutateAsync({
          id: user.id,
          fullName: form.fullName.trim(),
          email: email || undefined,
          phoneNumber: phone || undefined,
          role: form.role,
          isActive: form.isActive,
          isLocked: form.isLocked,
        });
      } else {
        await createUserMutation.mutateAsync({
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          role: form.role || DEFAULT_USER_ROLE,
          email: email || undefined,
          phoneNumber: phone || undefined,
          isLocked: form.isLocked,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Thành công',
        isEditMode ? 'Đã cập nhật hồ sơ nhân sự.' : 'Đã thêm nhân sự mới.',
      );
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = err instanceof Error ? err.message : 'Vui lòng thử lại sau.';
      Alert.alert('Không thể lưu', message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 justify-end bg-slate-900/50"
    >
      <View className="max-h-[90%] rounded-t-[24px] border-t border-slate-200 bg-white p-5 shadow-xl">
        {/* Header */}
        <View className="mb-4 flex-row items-center justify-between border-b border-slate-100 pb-3">
          <View className="flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-xl border border-orange-100 bg-orange-50">
              <Feather
                name={isEditMode ? 'user-check' : 'user-plus'}
                size={17}
                color={BrandColors.primary}
              />
            </View>
            <View>
              <Text className="text-base font-bold text-slate-900">
                {isEditMode ? 'Cập nhật nhân sự' : 'Thêm nhân sự mới'}
              </Text>
              <Text className="text-[11px] text-slate-400">
                {isEditMode ? 'Chỉnh sửa hồ sơ & quyền truy cập' : 'Tạo tài khoản đăng nhập hệ thống'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            className="h-11 w-11 items-center justify-center rounded-xl bg-slate-100"
            onPress={onClose}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Đóng biểu mẫu"
          >
            <Feather name="x" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-3.5 pb-5"
        >
          {/* Create-only credentials */}
          {!isEditMode ? (
            <>
              <View>
                <Text className="mb-1.5 text-xs font-bold text-slate-700">
                  Tên đăng nhập <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  testID="userFormUsername"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
                  placeholder="VD: nguyenvana"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={form.username}
                  onChangeText={(v) => setField('username', v)}
                />
              </View>

              <View>
                <Text className="mb-1.5 text-xs font-bold text-slate-700">
                  Mật khẩu <Text className="text-red-500">*</Text>
                </Text>
                <View className="flex-row items-center rounded-xl border border-slate-200 bg-slate-50 pl-3.5 pr-1.5">
                  <TextInput
                    testID="userFormPassword"
                    className="flex-1 py-3 text-sm text-slate-900"
                    placeholder="Tối thiểu 6 ký tự"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={form.password}
                    onChangeText={(v) => setField('password', v)}
                  />
                  <TouchableOpacity
                    className="h-11 w-11 items-center justify-center"
                    onPress={() => setShowPassword((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={18}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : null}

          {/* Common fields */}
          <View>
            <Text className="mb-1.5 text-xs font-bold text-slate-700">
              Họ và tên <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              testID="userFormFullName"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
              placeholder="VD: Nguyễn Văn A"
              placeholderTextColor="#94A3B8"
              value={form.fullName}
              onChangeText={(v) => setField('fullName', v)}
            />
          </View>

          <View>
            <Text className="mb-1.5 text-xs font-bold text-slate-700">Email</Text>
            <TextInput
              testID="userFormEmail"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
              placeholder="nguyenvana@getvini.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={form.email}
              onChangeText={(v) => setField('email', v)}
            />
          </View>

          <View>
            <Text className="mb-1.5 text-xs font-bold text-slate-700">Số điện thoại</Text>
            <TextInput
              testID="userFormPhone"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900"
              placeholder="0912345678"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={form.phoneNumber}
              onChangeText={(v) => setField('phoneNumber', v)}
            />
          </View>

          <View>
            <Text className="mb-1.5 text-xs font-bold text-slate-700">
              Vai trò <Text className="text-red-500">*</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {USER_ROLE_OPTIONS.map((option) => {
                const isSelected = form.role === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    testID={`userFormRole-${option.value}`}
                    className={`min-h-[44px] justify-center rounded-full border px-3 ${
                      isSelected ? 'border-primary bg-primary' : 'border-slate-200 bg-slate-100'
                    }`}
                    onPress={() => setField('role', option.value)}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      className={`text-xs ${isSelected ? 'font-bold text-white' : 'font-semibold text-slate-600'}`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Edit-only status switches */}
          {isEditMode ? (
            <View className="gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-xs font-bold text-slate-700">Tài khoản hoạt động</Text>
                  <Text className="mt-0.5 text-[11px] text-slate-400">
                    Tắt để chặn đăng nhập (account.isActive) mà không khóa hồ sơ.
                  </Text>
                </View>
                <Switch
                  testID="userFormIsActive"
                  value={form.isActive}
                  onValueChange={(v) => setField('isActive', v)}
                  trackColor={{ false: '#CBD5E1', true: BrandColors.primaryBorder }}
                  thumbColor={form.isActive ? BrandColors.primary : '#F1F5F9'}
                />
              </View>

              <View className="flex-row items-center justify-between border-t border-slate-200 pt-2.5">
                <View className="flex-1 pr-3">
                  <Text className="text-xs font-bold text-slate-700">Khóa hồ sơ nhân sự</Text>
                  <Text className="mt-0.5 text-[11px] text-slate-400">
                    Bật để khóa (user.isLocked) — hồ sơ sẽ bị ẩn khỏi danh sách.
                  </Text>
                </View>
                <Switch
                  testID="userFormIsLocked"
                  value={form.isLocked}
                  onValueChange={(v) => setField('isLocked', v)}
                  trackColor={{ false: '#CBD5E1', true: '#FCA5A5' }}
                  thumbColor={form.isLocked ? '#EF4444' : '#F1F5F9'}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* Footer — nút Lưu ≥48dp */}
        <View className="flex-row gap-3 border-t border-slate-100 pt-3">
          <TouchableOpacity
            className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-slate-100"
            onPress={onClose}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            <Text className="text-sm font-bold text-slate-600">Hủy bỏ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="userFormSubmit"
            className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-primary"
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isEditMode ? 'Lưu thay đổi nhân sự' : 'Tạo nhân sự mới'}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text className="text-sm font-bold text-white">
                {isEditMode ? 'Lưu thay đổi' : 'Tạo nhân sự'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

/**
 * Draggable bottom sheet thêm/sửa nhân sự.
 * Mount lại `UserFormSheet` mỗi lần mở để state luôn khớp dữ liệu mới nhất.
 */
export const UserFormModal: React.FC<UserFormModalProps> = ({
  visible,
  onClose,
  user,
  onSuccess,
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    {visible ? <UserFormSheet user={user} onClose={onClose} onSuccess={onSuccess} /> : null}
  </Modal>
);

export default UserFormModal;
