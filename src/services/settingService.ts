import { apiService } from './api';

export interface QcConfig {
  provider: string;
  verifyModel: string;
  maxBatch: number;
  maxContext: number;
  isCustomized?: boolean;
}

export interface QcOptionItem {
  value: string;
  label: string;
}

export interface QcSettingsResponse {
  config: QcConfig;
  options: {
    providers: QcOptionItem[];
    models: Record<string, QcOptionItem[]>;
  };
}

export interface UpdateQcSettingsPayload {
  provider: string;
  verifyModel: string;
  maxBatch: number;
  maxContext: number;
}

class SettingService {
  /**
   * Lấy cấu hình QC đối chiếu sản phẩm tự động bằng AI
   */
  async getQcSettings(): Promise<{ data?: QcSettingsResponse; error?: string }> {
    const res = await apiService.get<QcSettingsResponse>('/settings/qc');
    return { data: res.data, error: res.error };
  }

  /**
   * Cập nhật cấu hình QC đối chiếu sản phẩm
   */
  async updateQcSettings(payload: UpdateQcSettingsPayload): Promise<{ data?: any; error?: string }> {
    const res = await apiService.put<any>('/settings/qc', payload);
    return { data: res.data, error: res.error };
  }
}

export const settingService = new SettingService();
