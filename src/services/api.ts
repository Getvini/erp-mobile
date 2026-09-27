import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { privateStorage } from './secureStorage';

const STORAGE_USER_KEY = '@erp_auth_user';
const STORAGE_COOKIE_KEY = '@erp_auth_cookie';
const STORAGE_REMEMBER_KEY = 'rememberedUsername';
const STORAGE_ACCESS_TOKEN_KEY = 'erp.auth.access-token';
const STORAGE_REFRESH_TOKEN_KEY = 'erp.auth.refresh-token';

const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Platform.select({
    android: 'http://10.0.2.2:3000/api',
    default: 'http://localhost:3000/api',
  });

type AuthCookies = {
  accessToken?: string;
  refreshToken?: string;
};

const AUTH_COOKIE_NAMES = ['accessToken', 'refreshToken'] as const;

const parseAuthCookies = (setCookieHeaders: string[]): Partial<AuthCookies> => {
  const parsed: Partial<AuthCookies> = {};

  for (const header of setCookieHeaders) {
    for (const name of AUTH_COOKIE_NAMES) {
      const match = header.match(new RegExp(`(?:^|,\\s*)${name}=([^;,]*)`));
      if (match) {
        parsed[name] = match[1].trim();
      }
    }
  }

  return parsed;
};

export interface UserProfile {
  id: string;
  fullName: string;
  role: string;
  username?: string;
  email?: string;
  phoneNumber?: string;
}

export interface LoginResponse {
  message: string;
  user: UserProfile;
}

class ApiService {
  private baseUrl = DEFAULT_API_URL;
  private currentCookies: AuthCookies = {};
  private cookieInitPromise: Promise<void>;
  private refreshPromise: Promise<boolean> | null = null;
  private configurationError: string | null = null;
  private onUnauthorizedCallback: (() => void) | null = null;

  constructor() {
    this.configurationError = this.validateApiUrl();
    this.cookieInitPromise = this.initCookies();
  }

  setOnUnauthorized(callback: () => void) {
    this.onUnauthorizedCallback = callback;
  }

  handleUnauthorized() {
    this.saveCookies({});
    privateStorage.removeItem(STORAGE_USER_KEY).catch(() => undefined);
    if (this.onUnauthorizedCallback) {
      this.onUnauthorizedCallback();
    }
  }

  private validateApiUrl() {
    try {
      const url = new URL(this.baseUrl);
      if (!__DEV__ && url.protocol !== 'https:') {
        return 'Cấu hình bảo mật không hợp lệ: API production bắt buộc phải dùng HTTPS.';
      }
      return null;
    } catch {
      return 'Địa chỉ API không hợp lệ. Vui lòng liên hệ Quản trị viên IT.';
    }
  }

  private async initCookies() {
    if (Platform.OS === 'web') {
      return;
    }

    const [accessToken, refreshToken] = await Promise.all([
      privateStorage.getItem(STORAGE_ACCESS_TOKEN_KEY),
      privateStorage.getItem(STORAGE_REFRESH_TOKEN_KEY),
    ]);

    this.currentCookies = {
      ...(accessToken ? { accessToken } : {}),
      ...(refreshToken ? { refreshToken } : {}),
    };

    // Migrate the previous single plaintext Cookie header, then remove it.
    const legacyCookie = await privateStorage.getItem(STORAGE_COOKIE_KEY);
    if (legacyCookie) {
      const migrated = parseAuthCookies([legacyCookie]);
      await this.saveCookies({ ...this.currentCookies, ...migrated });
      await privateStorage.removeItem(STORAGE_COOKIE_KEY);
    }
  }

  private async saveCookies(cookies: AuthCookies) {
    this.currentCookies = cookies;
    if (Platform.OS === 'web') {
      return;
    }

    const cookieEntries: Array<[string, string | undefined]> = [
      [STORAGE_ACCESS_TOKEN_KEY, cookies.accessToken],
      [STORAGE_REFRESH_TOKEN_KEY, cookies.refreshToken],
    ];

    await Promise.all(
      cookieEntries.map(async ([key, value]) => {
        if (value) {
          await privateStorage.setItem(key, value);
        } else {
          await privateStorage.removeItem(key);
        }
      })
    );
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  getCookieHeader() {
    return AUTH_COOKIE_NAMES.map((name) => {
      const value = this.currentCookies[name];
      return value ? `${name}=${value}` : null;
    })
      .filter(Boolean)
      .join('; ');
  }

  private async captureCookies(response: Response) {
    if (Platform.OS === 'web') {
      return;
    }

    const cookieHeaders = response.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const setCookieHeaders = cookieHeaders.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? ''];
    const updates = parseAuthCookies(setCookieHeaders);

    if (Object.keys(updates).length > 0) {
      const nextCookies = { ...this.currentCookies };
      for (const name of AUTH_COOKIE_NAMES) {
        if (name in updates) {
          const value = updates[name];
          if (value) {
            nextCookies[name] = value;
          } else {
            delete nextCookies[name];
          }
        }
      }
      await this.saveCookies(nextCookies);
    }
  }

  private shouldRefresh(endpoint: string) {
    return !['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].some((path) =>
      endpoint.startsWith(path)
    );
  }

  private async refreshSession(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.request<{ message: string }>(
        '/auth/refresh',
        { method: 'POST' },
        false
      )
        .then(async (result) => {
          const refreshed = !result.error && result.status >= 200 && result.status < 300;
          if (!refreshed) {
            this.handleUnauthorized();
          }
          return refreshed;
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    allowRefresh = true
  ): Promise<{ data?: T; error?: string; status: number }> {
    if (this.configurationError) {
      return { error: this.configurationError, status: 0 };
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    try {
      await this.cookieInitPromise;
    } catch {
      return {
        error: 'Không thể mở kho lưu trữ phiên đăng nhập an toàn trên thiết bị.',
        status: 0,
      };
    }

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const cookieHeader = this.getCookieHeader();
    if (Platform.OS !== 'web' && cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const method = (options.method || 'GET').toUpperCase();
    const startTime = Date.now();

    if (__DEV__) {
      console.log(`🌐 [API Request] [${method}] ${url}`, options.body ? `| Payload: ${options.body}` : '');
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      try {
        await this.captureCookies(response);
      } catch {
        return {
          error: 'Không thể lưu phiên đăng nhập an toàn trên thiết bị.',
          status: 0,
        };
      }

      const text = await response.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      const duration = Date.now() - startTime;

      if (!response.ok) {
        if (__DEV__) {
          console.log(`❌ [API Error] [${method}] ${cleanEndpoint} (${response.status}) [${duration}ms]:`, data);
        }

        if (response.status === 401 && allowRefresh && this.shouldRefresh(cleanEndpoint)) {
          const refreshed = await this.refreshSession();
          if (refreshed) {
            return this.request<T>(endpoint, options, false);
          } else {
            this.handleUnauthorized();
          }
        }

        const errorMsg =
          data?.message ||
          data?.error ||
          (response.status === 401
            ? 'Phiên đăng nhập đã hết hạn hoặc không có quyền truy cập.'
            : 'Yêu cầu thất bại. Vui lòng thử lại.');
        return { error: errorMsg, status: response.status };
      }

      if (__DEV__) {
        console.log(`✅ [API Success] [${method}] ${cleanEndpoint} (${response.status}) [${duration}ms]`);
      }

      return { data, status: response.status };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      if (__DEV__) {
        console.log(`💥 [API Network Error] [${method}] ${cleanEndpoint} [${duration}ms]:`, err?.message || err);
      }
      return {
        error: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối.',
        status: 0,
      };
    }
  }

  async get<T = any>(endpoint: string, params?: Record<string, any>) {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T = any>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T = any>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T = any>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async postForm<T = any>(endpoint: string, formData: FormData) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData as any,
    });
  }

  async patchForm<T = any>(endpoint: string, formData: FormData) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: formData as any,
    });
  }

  async login(payload: { username: string; password: string; rememberMe?: boolean }) {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async logout() {
    try {
      return await this.request<{ message: string }>('/auth/logout', {
        method: 'POST',
      });
    } finally {
      await this.saveCookies({});
      await privateStorage.removeItem(STORAGE_USER_KEY).catch(() => undefined);
    }
  }

  async getMe() {
    return this.request<UserProfile>('/me', {
      method: 'GET',
    });
  }
}

export const apiService = new ApiService();
export { STORAGE_USER_KEY, STORAGE_COOKIE_KEY, STORAGE_REMEMBER_KEY };
