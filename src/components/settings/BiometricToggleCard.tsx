import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { authService, BiometricStatus } from '@/services/authService';
import { useAuthStore } from '@/stores/useAuthStore';

export const BiometricToggleCard: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [isSupported, setIsSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Sinh trắc học');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Modal xác nhận mật khẩu khi kích hoạt lần đầu
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      const bioStatus: BiometricStatus = await authService.checkBiometrics();
      setIsSupported(bioStatus.isSupported);
      setBiometricType('Sinh trắc học');

      if (bioStatus.isSupported) {
        const enabled = await authService.isBiometricEnabled();
        setIsEnabled(enabled);
      }
    } catch {
      setIsSupported(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (value) {
      // Kiểm tra xem đã có credentials lưu trữ chưa
      const existingCreds = await authService.getBiometricCredentials();
      const currentUsername = user?.username;

      if (existingCreds?.password && existingCreds?.username === currentUsername) {
        // Đã có mật khẩu lưu, chỉ cần quét sinh trắc học để xác nhận bật
        try {
          const authSuccess = await authService.authenticateBiometrics(
            `Xác nhận để kích hoạt đăng nhập bằng ${biometricType}`
          );

          if (authSuccess) {
            await authService.setBiometricEnabled(true);
            setIsEnabled(true);
            Alert.alert('Thành công', `Đã kích hoạt đăng nhập bằng ${biometricType}.`);
          } else {
            setIsEnabled(false);
          }
        } catch (err: any) {
          Alert.alert('Lỗi', err?.message || 'Không thể xác thực sinh trắc học.');
          setIsEnabled(false);
        }
      } else {
        // Chưa có mật khẩu lưu, mở modal yêu cầu nhập mật khẩu tài khoản
        setConfirmPassword('');
        setPasswordError('');
        setIsPasswordModalVisible(true);
      }
    } else {
      await authService.setBiometricEnabled(false);
      setIsEnabled(false);
      Alert.alert('Đã tắt', `Đã tắt đăng nhập bằng ${biometricType}.`);
    }
  };

  const handleConfirmPasswordAndEnable = async () => {
    if (!confirmPassword) {
      setPasswordError('Vui lòng nhập mật khẩu tài khoản.');
      return;
    }

    const currentUsername = user?.username;
    if (!currentUsername) {
      setPasswordError('Không tìm thấy thông tin tài khoản hiện tại.');
      return;
    }

    setIsActivating(true);
    setPasswordError('');

    try {
      // Quét sinh trắc học để người dùng xác nhận cấp quyền
      const authSuccess = await authService.authenticateBiometrics(
        `Xác nhận để kích hoạt đăng nhập bằng ${biometricType}`
      );

      if (!authSuccess) {
        setPasswordError(`Xác thực ${biometricType} không thành công hoặc đã bị hủy.`);
        setIsActivating(false);
        return;
      }

      // Lưu credentials an toàn vào SecureStore
      await authService.saveBiometricCredentials(currentUsername, confirmPassword);
      await authService.setBiometricEnabled(true);
      setIsEnabled(true);
      setIsPasswordModalVisible(false);
      setConfirmPassword('');
      Alert.alert('Thành công', `Đã kích hoạt đăng nhập bằng ${biometricType}.`);
    } catch (err: any) {
      setPasswordError(err?.message || 'Không thể kích hoạt sinh trắc học.');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <>
      <View className="bg-white rounded-2xl p-4 border border-slate-200">
        <View className="flex-row items-center gap-3">
          <View className="w-[42px] h-[42px] rounded-xl bg-orange-50 items-center justify-center">
            <MaterialCommunityIcons
              name="fingerprint"
              size={22}
              color="#F38820"
            />
          </View>

          <View className="flex-1">
            <Text className="text-sm font-bold text-slate-900">Đăng nhập Sinh trắc học</Text>
            <Text className="text-xs text-slate-500 mt-0.5 leading-4">
              {isSupported
                ? 'Sử dụng vân tay hoặc Face ID để đăng nhập ứng dụng nhanh chóng & an toàn'
                : 'Thiết bị chưa cài đặt hoặc không hỗ trợ sinh trắc học'}
            </Text>
          </View>

          <Switch
            value={isEnabled}
            onValueChange={handleToggle}
            disabled={!isSupported || isLoading}
            trackColor={{ false: '#E2E8F0', true: '#FDBA74' }}
            thumbColor={isEnabled ? '#F38820' : '#94A3B8'}
          />
        </View>
      </View>

      {/* Modal xác nhận mật khẩu */}
      <Modal
        visible={isPasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsPasswordModalVisible(false);
          setConfirmPassword('');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-center items-center bg-black/50 px-4"
        >
          <View className="w-full max-w-[340px] bg-white rounded-2xl p-5 shadow-lg">
            <View className="items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-orange-50 items-center justify-center mb-2">
                <MaterialCommunityIcons
                  name="fingerprint"
                  size={26}
                  color="#F38820"
                />
              </View>
              <Text className="text-base font-bold text-slate-900 text-center">
                Kích hoạt Sinh trắc học
              </Text>
              <Text className="text-xs text-slate-500 text-center mt-1">
                Nhập mật khẩu của tài khoản{' '}
                <Text className="font-semibold text-slate-800">{user?.username}</Text> để liên kết sinh
                trắc học
              </Text>
            </View>

            {!!passwordError && (
              <View className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5">
                <Text className="text-xs text-red-600 text-center">{passwordError}</Text>
              </View>
            )}

            <View className="h-[46px] flex-row items-center overflow-hidden rounded-xl border border-slate-300 bg-white mb-4">
              <View className="items-center justify-center pl-3 pr-1">
                <Feather name="lock" size={18} color="#94A3B8" />
              </View>
              <TextInput
                className="h-full flex-1 px-2.5 text-sm text-slate-900"
                placeholder="Nhập mật khẩu hiện tại"
                placeholderTextColor="#94A3B8"
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  if (passwordError) setPasswordError('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                className="h-full px-3 items-center justify-center"
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                className="flex-1 h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white"
                onPress={() => {
                  setIsPasswordModalVisible(false);
                  setConfirmPassword('');
                  setIsEnabled(false);
                }}
                disabled={isActivating}
                activeOpacity={0.7}
              >
                <Text className="text-sm font-semibold text-slate-700">Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 h-[44px] items-center justify-center rounded-xl bg-primary"
                onPress={handleConfirmPasswordAndEnable}
                disabled={isActivating}
                activeOpacity={0.8}
              >
                {isActivating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-sm font-bold text-white">Xác nhận</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};
