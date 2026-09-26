import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, Alert, Platform } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { privateStorage } from '@/services/secureStorage';

const BIOMETRIC_ENABLED_KEY = 'biometric_auth_enabled';

export const BiometricToggleCard: React.FC = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Sinh trắc học');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supported = hasHardware && isEnrolled;
      setIsSupported(supported);

      if (supported) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Vân tay');
        } else {
          setBiometricType('Sinh trắc học');
        }

        const savedPref = await privateStorage.getItem(BIOMETRIC_ENABLED_KEY);
        setIsEnabled(savedPref === 'true');
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
      // Xác thực thử trước khi kích hoạt
      try {
        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: `Xác nhận để kích hoạt ${biometricType}`,
          fallbackLabel: 'Sử dụng mật khẩu',
          cancelLabel: 'Hủy',
        });

        if (authResult.success) {
          await privateStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
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
      await privateStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
      setIsEnabled(false);
      Alert.alert('Đã tắt', `Đã tắt đăng nhập bằng ${biometricType}.`);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons
            name={biometricType === 'Face ID' ? 'face-recognition' : 'fingerprint'}
            size={22}
            color="#EA580C"
          />
        </View>

        <View style={styles.textCol}>
          <Text style={styles.title}>Đăng nhập {biometricType}</Text>
          <Text style={styles.subtitle}>
            {isSupported
              ? `Sử dụng ${biometricType} để mở khóa ứng dụng nhanh chóng & an toàn`
              : 'Thiết bị chưa cài đặt hoặc không hỗ trợ sinh trắc học'}
          </Text>
        </View>

        <Switch
          value={isEnabled}
          onValueChange={handleToggle}
          disabled={!isSupported || isLoading}
          trackColor={{ false: '#E2E8F0', true: '#FDBA74' }}
          thumbColor={isEnabled ? '#EA580C' : '#94A3B8'}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
});
