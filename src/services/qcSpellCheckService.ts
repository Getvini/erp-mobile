import { apiService } from './api';

export interface QcProductInfoItem {
  productName: string;
  sourceName?: string;
  sourceUrl?: string;
}

export interface LocalPickedFile {
  uri: string;
  name: string;
  mimeType?: string;
}

class QcSpellCheckService {
  async getSheetsFromUrl(fileUrl: string, fileName?: string): Promise<{ data?: string[]; error?: string }> {
    const res = await apiService.post<{ sheets?: string[] }>('/spelling-check/sheets-from-url', {
      fileUrl,
      fileName,
    });
    return { data: res.data?.sheets || [], error: res.error };
  }

  async getSheetsFromFile(file: LocalPickedFile): Promise<{ data?: string[]; error?: string }> {
    const formData = new FormData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (formData as any).append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
    });
    const res = await apiService.postForm<{ sheets?: string[] }>('/spelling-check/sheets', formData);
    return { data: res.data?.sheets || [], error: res.error };
  }

  async getProductInfo(projectId: string): Promise<{ data?: QcProductInfoItem[]; error?: string }> {
    const res = await apiService.get<{ items?: QcProductInfoItem[] }>(`/qc/product-info/${projectId}`);
    return { data: res.data?.items || [], error: res.error };
  }
}

export const qcSpellCheckService = new QcSpellCheckService();
