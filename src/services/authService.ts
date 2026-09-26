import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { apiService, UserProfile, LoginResponse, STORAGE_REMEMBER_KEY } from './api';
import { privateStorage } from './secureStorage';

export const STORAGE_BIOMETRIC_ENABLED_KEY = 'erp.auth.biometric-enabled';
export const STORAGE_BIOMETRIC_CREDS_KEY = 'erp.auth.biometric-credentials';

export interface RegisterPayload {
  username: string;
  password: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  role?: string;
}

export interface UpdateProfilePayload {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  avatar?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface BiometricStatus {
  isSupported: boolean;
  hasHardware: boolean;
  isEnrolled: boolean;
  biometricTypes: LocalAuthentication.AuthenticationType[];
  typeLabel: 'FaceID' | 'Fingerprint' | 'Biometrics' | 'None';
}

class AuthService {
  /**
   * 1. POST /auth/login
   * Đăng nhập với username và password
   */
  async login(credentials: { username: string; password: string; rememberMe?: boolean }): Promise<{
    data?: LoginResponse;
    error?: string;
    status: number;
  }> {
    const res = await apiService.login(credentials);
    return res;
  }

  /**
   * 2. POST /auth/register
   * Đăng ký tài khoản người dùng mới
   */
  async register(data: RegisterPayload): Promise<{
    data?: { message: string; user: UserProfile };
    error?: string;
    status: number;
  }> {
    return apiService.post<{ message: string; user: UserProfile }>('/auth/register', data);
  }

  /**
   * 3. POST /auth/logout
   * Đăng xuất phiên làm việc và xóa cookies/tokens
   */
  async logout(): Promise<{ message?: string; error?: string }> {
    const res = await apiService.logout();
    return res.data || { error: res.error };
  }

  /**
   * 4. GET /me
   * Lấy thông tin tài khoản người dùng hiện tại
   */
  async getMe(): Promise<{ data?: UserProfile; error?: string; status: number }> {
    return apiService.getMe();
  }

  /**
   * 5. PATCH /me
   * Cập nhật thông tin tài khoản cá nhân
   */
  async updateMe(data: UpdateProfilePayload): Promise<{
    data?: UserProfile;
    error?: string;
    status: number;
  }> {
    return apiService.patch<UserProfile>('/me', data);
  }

  // =========================================================================
  // SINH TRẮC HỌC (BIOMETRICS - FaceID / Vân tay)
  // =========================================================================

  /**
   * Kiểm tra thiết bị có hỗ trợ FaceID / Vân tay không
   */
  async checkBiometrics(): Promise<BiometricStatus> {
    if (Platform.OS === 'web') {
      return {
        isSupported: false,
        hasHardware: false,
        isEnrolled: false,
        biometricTypes: [],
        typeLabel: 'None',
      };
    }

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const biometricTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      let typeLabel: 'FaceID' | 'Fingerprint' | 'Biometrics' | 'None' = 'None';
      if (biometricTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        typeLabel = 'FaceID';
      } else if (biometricTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        typeLabel = 'Fingerprint';
      } else if (hasHardware && isEnrolled) {
        typeLabel = 'Biometrics';
      }

      return {
        isSupported: hasHardware && isEnrolled,
        hasHardware,
        isEnrolled,
        biometricTypes,
        typeLabel,
      };
    } catch {
      return {
        isSupported: false,
        hasHardware: false,
        isEnrolled: false,
        biometricTypes: [],
        typeLabel: 'None',
      };
    }
  }

  /**
   * Yêu cầu người dùng xác thực sinh trắc học FaceID / Vân tay
   */
  async authenticateBiometrics(
    promptMessage: string = 'Xác thực sinh trắc học để tiếp tục'
  ): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Hủy',
        fallbackLabel: 'Sử dụng mật khẩu',
        disableDeviceFallback: false,
      });

      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Kiểm tra người dùng có bật tính năng đăng nhập sinh trắc học không
   */
  async isBiometricEnabled(): Promise<boolean> {
    const val = await privateStorage.getItem(STORAGE_BIOMETRIC_ENABLED_KEY);
    return val === 'true';
  }

  /**
   * Bật hoặc tắt tính năng sinh trắc học
   */
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      await privateStorage.setItem(STORAGE_BIOMETRIC_ENABLED_KEY, 'true');
    } else {
      await privateStorage.removeItem(STORAGE_BIOMETRIC_ENABLED_KEY);
      await privateStorage.removeItem(STORAGE_BIOMETRIC_CREDS_KEY);
    }
  }

  /**
   * Lưu thông tin đăng nhập an toàn trong SecureStore để đăng nhập nhanh bằng sinh trắc học
   */
  async saveBiometricCredentials(username: string, password: string): Promise<void> {
    const payload = JSON.stringify({ username, password });
    await privateStorage.setItem(STORAGE_BIOMETRIC_CREDS_KEY, payload);
    await privateStorage.setItem(STORAGE_BIOMETRIC_ENABLED_KEY, 'true');
  }

  /**
   * Lấy thông tin đăng nhập sinh trắc học đã lưu
   */
  async getBiometricCredentials(): Promise<{ username: string; password: string } | null> {
    const raw = await privateStorage.getItem(STORAGE_BIOMETRIC_CREDS_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Xóa thông tin đăng nhập sinh trắc học
   */
  async clearBiometricCredentials(): Promise<void> {
    await privateStorage.removeItem(STORAGE_BIOMETRIC_CREDS_KEY);
    await privateStorage.removeItem(STORAGE_BIOMETRIC_ENABLED_KEY);
  }
}

export const authService = new AuthService();
