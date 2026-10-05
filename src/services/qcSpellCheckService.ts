import { apiService } from './api';
import type { PreviewRequest, PreviewWindow, ScenarioInfo } from '@/utils/sheetScope';

export interface QcProductInfoItem {
  productName: string;
  extractedText?: string | null;
  note?: string | null;
  fileUrl?: string | null;
}

export interface LocalPickedFile {
  uri: string;
  name: string;
  mimeType?: string;
}

export interface SheetsResult {
  sheets: string[];
  scenarios: Record<string, ScenarioInfo[]>;
}

const appendFile = (formData: FormData, file: LocalPickedFile) => {
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as unknown as Blob);
};

const toSheetsResult = (data?: { sheets?: string[]; scenarios?: Record<string, ScenarioInfo[]> }): SheetsResult => ({
  sheets: data?.sheets || [],
  scenarios: data?.scenarios || {},
});

class QcSpellCheckService {
  async getSheetsFromUrl(fileUrl: string, fileName?: string): Promise<{ data?: SheetsResult; error?: string; status?: number }> {
    const res = await apiService.post<{ sheets?: string[]; scenarios?: Record<string, ScenarioInfo[]> }>(
      '/spelling-check/sheets-from-url',
      { fileUrl, fileName }
    );
    return { data: toSheetsResult(res.data), error: res.error, status: res.status };
  }

  async getSheetsFromFile(file: LocalPickedFile): Promise<{ data?: SheetsResult; error?: string; status?: number }> {
    const formData = new FormData();
    appendFile(formData, file);
    const res = await apiService.postForm<{ sheets?: string[]; scenarios?: Record<string, ScenarioInfo[]> }>(
      '/spelling-check/sheets',
      formData
    );
    return { data: toSheetsResult(res.data), error: res.error, status: res.status };
  }

  async previewFromUrl(
    fileUrl: string,
    fileName: string,
    request: PreviewRequest
  ): Promise<{ data?: PreviewWindow; error?: string }> {
    const res = await apiService.post<PreviewWindow>('/spelling-check/preview-from-url', {
      fileUrl,
      fileName,
      ...request,
    });
    return { data: res.data, error: res.error };
  }

  async previewFromFile(
    fileKey: string,
    file: LocalPickedFile,
    request: PreviewRequest
  ): Promise<{ data?: PreviewWindow; error?: string }> {
    const send = (withFile: boolean) => {
      const formData = new FormData();
      formData.append('fileKey', fileKey);
      if (request.sheet) formData.append('sheet', request.sheet);
      formData.append('rowStart', String(request.rowStart));
      formData.append('rowCount', String(request.rowCount));
      formData.append('colStart', String(request.colStart));
      formData.append('colCount', String(request.colCount));
      if (withFile) appendFile(formData, file);
      return apiService.postForm<PreviewWindow>('/spelling-check/preview', formData);
    };
    let res = await send(false);
    if (res.status === 409) {
      res = await send(true);
    }
    return { data: res.data, error: res.error };
  }

  async getProductInfo(projectId: string): Promise<{ data?: QcProductInfoItem[]; error?: string }> {
    const res = await apiService.get<{ items?: QcProductInfoItem[] }>(`/qc/product-info/${projectId}`);
    return { data: res.data?.items || [], error: res.error };
  }
}

export const qcSpellCheckService = new QcSpellCheckService();
