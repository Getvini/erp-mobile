import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  apiService,
  UserProfile,
  STORAGE_REMEMBER_KEY,
  STORAGE_USER_KEY,
} from '@/services/api';
import {
  authService,
  RegisterPayload,
  UpdateProfilePayload,
  BiometricStatus,
} from '@/services/authService';
import { privateStorage } from '@/services/secureStorage';
import { queryKeys } from '@/services/queryKeys';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * Hook to fetch current user profile and sync with useAuthStore
 */
export function useUserProfileQuery() {
  const setUser = useAuthStore((state) => state.setUser);
  const setIsLoading = useAuthStore((state) => state.setIsLoading);

  return useQuery({
    queryKey: queryKeys.auth.user,
    queryFn: async () => {
      try {
        const res = await apiService.getMe();
        if (res.data && !res.error) {
          setUser(res.data);
          return res.data;
        } else {
          setUser(null);
          return null;
        }
      } catch (err) {
        setUser(null);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

/**
 * Hook for login mutation with privateStorage token handling & Zustand sync
 */
export function useLoginMutation() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (credentials: { username: string; password: string; rememberMe?: boolean }) => {
      const res = await authService.login(credentials);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
      }

      if (credentials.rememberMe) {
        await privateStorage.setItem(STORAGE_REMEMBER_KEY, credentials.username);
      } else {
        await privateStorage.removeItem(STORAGE_REMEMBER_KEY);
      }

      // Fetch full profile via getMe right after login to populate full fields
      let fullUser: UserProfile = res.data.user;
      try {
        const meRes = await authService.getMe();
        if (meRes.data && !meRes.error) {
          fullUser = meRes.data;
        }
      } catch {}

      if (!fullUser.username && credentials.username) {
        fullUser.username = credentials.username;
      }

      return fullUser;
    },
    onSuccess: (userData: UserProfile) => {
      setUser(userData);
      queryClient.setQueryData(queryKeys.auth.user, userData);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.user });
    },
  });
}

/**
 * Hook for register mutation
 */
export function useRegisterMutation() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const res = await authService.register(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Đăng ký tài khoản thất bại.');
      }
      return res.data.user;
    },
    onSuccess: (userData: UserProfile) => {
      setUser(userData);
      queryClient.setQueryData(queryKeys.auth.user, userData);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.user });
    },
  });
}

/**
 * Hook to update user profile
 */
export function useUpdateMeMutation() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => {
      const res = await authService.updateMe(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể cập nhật hồ sơ cá nhân.');
      }
      return res.data;
    },
    onSuccess: (updatedUser: UserProfile) => {
      setUser(updatedUser);
      queryClient.setQueryData(queryKeys.auth.user, updatedUser);
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.user });
    },
  });
}

/**
 * Hook to check device biometrics hardware and enrollment
 */
export function useCheckBiometricsQuery() {
  return useQuery({
    queryKey: ['auth', 'biometrics-check'],
    queryFn: async (): Promise<BiometricStatus> => {
      return authService.checkBiometrics();
    },
    staleTime: Infinity,
  });
}

/**
 * Hook for biometric login
 */
export function useBiometricLoginMutation() {
  const loginMutation = useLoginMutation();

  return useMutation({
    mutationFn: async () => {
      const isSupported = await authService.checkBiometrics();
      if (!isSupported.isSupported) {
        throw new Error('Thiết bị chưa hỗ trợ hoặc chưa cài đặt sinh trắc học.');
      }

      const creds = await authService.getBiometricCredentials();
      if (!creds || !creds.username || !creds.password) {
        throw new Error('Chưa thiết lập đăng nhập sinh trắc học trên thiết bị này.');
      }

      const authenticated = await authService.authenticateBiometrics(
        'Quét FaceID / Vân tay để đăng nhập vào Getvini ERP'
      );

      if (!authenticated) {
        throw new Error('Xác thực sinh trắc học không thành công.');
      }

      return loginMutation.mutateAsync({
        username: creds.username,
        password: creds.password,
        rememberMe: true,
      });
    },
  });
}

/**
 * Hook for logout mutation with privateStorage cleanup & Zustand sync
 */
export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return useMutation({
    mutationFn: async () => {
      try {
        await authService.logout();
      } catch (err) {
        console.log('⚠️ [Logout Warning] Failed to call logout API, clearing local storage anyway:', err);
      } finally {
        await privateStorage.removeItem(STORAGE_USER_KEY).catch(() => undefined);
        clearAuth();
      }
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
