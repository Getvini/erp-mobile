import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useLoginMutation } from '@/hooks/queries';
import { STORAGE_REMEMBER_KEY } from '@/services/api';
import { privateStorage } from '@/services/secureStorage';
import { authService, BiometricStatus } from '@/services/authService';

const bg = require('@/assets/images/bg.jpg');
const logo = require('@/assets/images/logo.png');

const PRIMARY_COLOR = '#F38820';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  // Biometric state (Option A)
  const [biometricStatus, setBiometricStatus] = useState<BiometricStatus | null>(null);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [biometricUsername, setBiometricUsername] = useState('');
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const hasAutoPromptedRef = useRef(false);

  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const loginMutation = useLoginMutation();
  const isLoading = loginMutation.isPending;

  // Load saved username and remember status on mount, plus initialize biometrics
  useEffect(() => {
    let isMounted = true;

    const initLoginScreen = async () => {
      try {
        const savedUsername = await privateStorage.getItem(STORAGE_REMEMBER_KEY);
        if (savedUsername && isMounted) {
          setUsername(savedUsername);
          setRememberMe(true);
        }

        // Kiểm tra phần cứng & cài đặt sinh trắc học
        const bioStatus = await authService.checkBiometrics();
        const isBioEnabled = await authService.isBiometricEnabled();
        const bioCreds = await authService.getBiometricCredentials();

        if (isMounted) {
          setBiometricStatus(bioStatus);
          const available =
            bioStatus.isSupported &&
            isBioEnabled &&
            !!bioCreds?.username &&
            !!bioCreds?.password;

          setIsBiometricAvailable(available);

          if (bioCreds?.username) {
            setBiometricUsername(bioCreds.username);
            // Điền sẵn username nếu ô đang trống
            setUsername((prev) => prev || bioCreds.username);
          }

          // Option A: Tự động bung popup quét sinh trắc học 1 lần khi vừa vào màn hình login
          if (available && !hasAutoPromptedRef.current && !isAuthenticated) {
            hasAutoPromptedRef.current = true;
            setTimeout(() => {
              if (isMounted) {
                triggerBiometricLogin(true);
              }
            }, 400);
          }
        }
      } catch {}
    };

    initLoginScreen();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated]);

  const triggerBiometricLogin = async (isAuto = false) => {
    if (isLoading || isBiometricLoading) return;
    setError('');
    setIsBiometricLoading(true);

    try {
      const bioCreds = await authService.getBiometricCredentials();
      if (!bioCreds?.username || !bioCreds?.password) {
        if (!isAuto) {
          setError('Chưa có thông tin đăng nhập sinh trắc học được lưu.');
        }
        setIsBiometricLoading(false);
        return;
      }

      const authSuccess = await authService.authenticateBiometrics(
        'Xác thực sinh trắc học để đăng nhập vào Getvini ERP'
      );

      if (!authSuccess) {
        if (!isAuto) {
          setError('Xác thực sinh trắc học không thành công hoặc đã bị hủy.');
        }
        setIsBiometricLoading(false);
        return;
      }

      await loginMutation.mutateAsync({
        username: bioCreds.username,
        password: bioCreds.password,
        rememberMe: true,
      });

      router.replace('/');
    } catch (err: any) {
      if (!isAuto) {
        setError(err?.message || 'Đăng nhập bằng sinh trắc học thất bại.');
      }
    } finally {
      setIsBiometricLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError('');

    if (!username.trim()) {
      setError('Vui lòng nhập tên tài khoản.');
      return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }

    try {
      await loginMutation.mutateAsync({
        username: username.trim(),
        password,
        rememberMe,
      });
      router.replace('/');
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
      >
        <ScrollView
          contentContainerClassName="flex-grow bg-white"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Top Brand Banner with original crisp bg.jpg */}
          <View className="h-[220px] w-full">
            <ImageBackground source={bg} className="h-full w-full flex-1" resizeMode="cover" />
          </View>

          {/* Clean Edge-to-Edge Sheet */}
          <View className="-mt-7 min-h-full flex-1 rounded-t-[28px] bg-white px-[22px] pb-9 pt-[26px]">
            {/* Header with Floating Brand Logo */}
            <View className="mb-[22px] items-center">
              <View className="-mt-[58px] mb-3.5 h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-white p-2.5 shadow-lg shadow-black/15 border border-slate-100">
                <Image
                  source={logo}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              </View>
              <Text className="text-center text-2xl font-bold text-slate-950">Đăng nhập hệ thống</Text>
              <Text className="mt-1.5 text-center text-sm text-slate-500">
                Nhập thông tin tài khoản doanh nghiệp của bạn
              </Text>
            </View>

            {/* Error Message */}
            {!!error && (
              <View className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3">
                <Text className="text-sm leading-5 text-red-700">{error}</Text>
              </View>
            )}

            {/* Form */}
            <View className="gap-4">
              {/* Username Field */}
              <View className="gap-1.5">
                <Text className="text-sm font-semibold text-slate-800">Tên tài khoản</Text>
                <View className="h-[50px] flex-row items-center overflow-hidden rounded-[10px] border border-slate-300 bg-white">
                  <View className="items-center justify-center pl-4 pr-1">
                    <Feather name="user" size={20} color="#94A3B8" />
                  </View>
                  <TextInput
                    className="h-full flex-1 px-3 text-[15px] text-slate-950"
                    placeholder="Nhập tên tài khoản"
                    placeholderTextColor="#94A3B8"
                    value={username}
                    onChangeText={(text) => {
                      setUsername(text);
                      if (error) setError('');
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Password Field */}
              <View className="gap-1.5">
                <Text className="text-sm font-semibold text-slate-800">Mật khẩu</Text>
                <View className="h-[50px] flex-row items-center overflow-hidden rounded-[10px] border border-slate-300 bg-white">
                  <View className="items-center justify-center pl-4 pr-1">
                    <Feather name="lock" size={20} color="#94A3B8" />
                  </View>
                  <TextInput
                    className="h-full flex-1 px-3 text-[15px] text-slate-950"
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (error) setError('');
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    className="h-full min-w-12 items-center justify-center px-4"
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Checkbox: Remember me */}
              <View className="mt-0.5 flex-row items-center justify-between">
                <TouchableOpacity
                  className="min-h-11 flex-row items-center gap-2"
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                >
                  <View
                    className={`h-[18px] w-[18px] items-center justify-center rounded-[5px] border bg-white ${
                      rememberMe ? 'border-primary' : 'border-slate-300'
                    }`}
                  >
                    {rememberMe && <Feather name="check" size={12} color="#0F172A" />}
                  </View>
                  <Text className="text-sm text-slate-700">Ghi nhớ đăng nhập</Text>
                </TouchableOpacity>
              </View>

              {/* Submit Button & Biometric Quick Button (Option A) */}
              <View className="mt-1.5 flex-row items-center gap-2.5">
                <TouchableOpacity
                  className={`h-[50px] flex-1 items-center justify-center rounded-[10px] bg-primary shadow-md ${
                    isLoading || isBiometricLoading ? 'opacity-60' : ''
                  }`}
                  onPress={handleSubmit}
                  disabled={isLoading || isBiometricLoading}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isLoading || isBiometricLoading }}
                >
                  {isLoading ? (
                    <View className="flex-row items-center justify-center gap-2">
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text className="text-base font-bold text-white">Đang đăng nhập...</Text>
                    </View>
                  ) : (
                    <Text className="text-base font-bold text-white">Đăng nhập</Text>
                  )}
                </TouchableOpacity>

                {isBiometricAvailable && (
                  <TouchableOpacity
                    className={`h-[50px] w-[50px] items-center justify-center rounded-[10px] border border-primary/30 bg-orange-50 active:bg-orange-100 ${
                      isBiometricLoading ? 'opacity-60' : ''
                    }`}
                    onPress={() => triggerBiometricLogin(false)}
                    disabled={isLoading || isBiometricLoading}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Đăng nhập bằng Sinh trắc học"
                  >
                    {isBiometricLoading ? (
                      <ActivityIndicator size="small" color="#F38820" />
                    ) : (
                      <MaterialCommunityIcons
                        name="fingerprint"
                        size={26}
                        color="#F38820"
                      />
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Quick Biometric Hint */}
              {isBiometricAvailable && !!biometricUsername && (
                <TouchableOpacity
                  onPress={() => triggerBiometricLogin(false)}
                  activeOpacity={0.7}
                  className="mt-1 flex-row items-center justify-center gap-1.5 py-1"
                >
                  <MaterialCommunityIcons
                    name="fingerprint"
                    size={14}
                    color="#F38820"
                  />
                  <Text className="text-xs text-slate-500">
                    Đăng nhập nhanh cho{' '}
                    <Text className="font-semibold text-slate-800">{biometricUsername}</Text> bằng{' '}
                    <Text className="font-bold text-primary">Sinh trắc học</Text>
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* IT Support & Enterprise Trust Section */}
            <View className="mt-6">
              {/* IT Support Card */}
              <View className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <View className="h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
                  <Feather name="headphones" size={18} color={PRIMARY_COLOR} />
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-bold text-slate-800">Cần hỗ trợ đăng nhập?</Text>
                  <Text className="mt-0.5 text-[11px] leading-4 text-slate-500">
                    Quên mật khẩu hoặc sự cố tài khoản? Vui lòng liên hệ Quản trị viên IT nội bộ
                  </Text>
                </View>
              </View>

              {/* Security & Version Footnotes */}
              <View className="mt-5 flex-row items-center justify-center gap-2">
                <Feather name="shield" size={13} color="#10B981" />
                <Text className="text-[11px] font-medium text-slate-500">Bảo mật SSL 256-bit</Text>
                <Text className="text-[11px] text-slate-300">•</Text>
                <Text className="text-[11px] font-medium text-slate-500">Getvini ERP v1.0.0</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
