import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { UserProfile } from '@/services/api';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUserProfileQuery, useLoginMutation, useLogoutMutation } from '@/hooks/queries/useAuthQuery';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { username: string; password: string; rememberMe?: boolean }) => Promise<{ user?: UserProfile; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Bootstrap user session via TanStack Query and sync into useAuthStore & privateStorage
  useUserProfileQuery();

  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();

  const login = useCallback(
    async ({ username, password, rememberMe }: { username: string; password: string; rememberMe?: boolean }) => {
      try {
        const userData = await loginMutation.mutateAsync({ username, password, rememberMe });
        return { user: userData };
      } catch (err: any) {
        return { error: err.message || 'Đăng nhập thất bại. Vui lòng thử lại.' };
      }
    },
    [loginMutation]
  );

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {}
  }, [logoutMutation]);

  const contextValue = useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      login,
      logout,
    }),
    [user, isAuthenticated, isLoading, login, logout]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
