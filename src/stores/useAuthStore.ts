import { create } from 'zustand';
import { UserProfile, apiService } from '@/services/api';

interface AuthStoreState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBiometricEnabled: boolean;
  sessionExpired: boolean;

  setUser: (user: UserProfile | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsBiometricEnabled: (enabled: boolean) => void;
  setSessionExpired: (expired: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isBiometricEnabled: false,
  sessionExpired: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: Boolean(user),
      isLoading: false,
      sessionExpired: false,
    }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setIsBiometricEnabled: (isBiometricEnabled) => set({ isBiometricEnabled }),

  setSessionExpired: (sessionExpired) => set({ sessionExpired }),

  clearAuth: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      sessionExpired: true,
    }),
}));

// Wire up 401 interceptor hook directly to Zustand store
apiService.setOnUnauthorized(() => {
  useAuthStore.getState().clearAuth();
});
