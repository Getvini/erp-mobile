import { apiService } from './api';

export interface ProductDescriptionDocument {
  name?: string | null;
  url: string;
}

export interface ProductDescriptionItem {
  id?: string | null;
  productName: string;
  fileUrl?: string;
  fileName?: string;
  extractedText?: string | null;
  note?: string | null;
  documents?: ProductDescriptionDocument[];
}

export interface ProductDescriptionExtractResult {
  extractedText: string;
  hasComplexLayout?: boolean;
  warnings?: string[];
}

export interface ProductDescriptionAiFormatResult {
  extractedText: string;
  removed?: string[];
  warnings?: string[];
}

export interface ProductDescriptionSubmission {
  id: string;
  projectId: string;
  versionNumber?: number | null;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  reviewNote?: string | null;
  createdBy?: {
    id: string;
    fullName: string;
  };
  reviewedBy?: {
    id: string;
    fullName: string;
  };
  reviewedAt?: string | null;
  items: ProductDescriptionItem[];
  createdAt?: string;
  updatedAt?: string;
}

class ProductDescriptionService {
  async getSubmissions(projectId: string): Promise<{ data?: ProductDescriptionSubmission[]; error?: string }> {
    const res = await apiService.get<ProductDescriptionSubmission[]>(`/projects/${projectId}/product-descriptions`);
    const raw = res.data;
    const items = Array.isArray(raw)
      ? raw
      : (raw as any)?.data && Array.isArray((raw as any).data)
      ? (raw as any).data
      : [];
    return { data: items, error: res.error };
  }

  async createSubmission(projectId: string, payload: { items: any[] }): Promise<{ data?: ProductDescriptionSubmission; error?: string }> {
    const res = await apiService.post<any>(`/projects/${projectId}/product-descriptions`, payload);
    const item = res.data?.data && typeof res.data.data === 'object' ? res.data.data : res.data;
    return { data: item, error: res.error };
  }

  async updateSubmission(projectId: string, submissionId: string, payload: { items: any[] }): Promise<{ data?: ProductDescriptionSubmission; error?: string }> {
    const res = await apiService.put<any>(`/projects/${projectId}/product-descriptions/${submissionId}`, payload);
    const item = res.data?.data && typeof res.data.data === 'object' ? res.data.data : res.data;
    return { data: item, error: res.error };
  }

  async submitSubmission(projectId: string, submissionId: string, payload?: { items?: any[] }): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/${projectId}/product-descriptions/${submissionId}/submit`, payload || {});
    return { data: res.data, error: res.error };
  }

  async approveSubmission(projectId: string, submissionId: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/${projectId}/product-descriptions/${submissionId}/approve`, {});
    return { data: res.data, error: res.error };
  }

  async rejectSubmission(projectId: string, submissionId: string, reviewNote?: string): Promise<{ data?: any; error?: string }> {
    const res = await apiService.post(`/projects/${projectId}/product-descriptions/${submissionId}/reject`, { reviewNote });
    return { data: res.data, error: res.error };
  }

  async extractFile(projectId: string, fileUrl: string): Promise<{ data?: ProductDescriptionExtractResult; error?: string }> {
    const res = await apiService.post<ProductDescriptionExtractResult>(
      `/projects/${projectId}/product-descriptions/extract-file`,
      { fileUrl }
    );
    const rawData = res.data as any;
    const result = rawData?.data && typeof rawData.data === 'object' ? rawData.data : rawData;
    return { data: result, error: res.error };
  }

  async extractUpload(projectId: string, formData: FormData): Promise<{ data?: ProductDescriptionExtractResult; error?: string }> {
    const res = await apiService.postForm<ProductDescriptionExtractResult>(
      `/projects/${projectId}/product-descriptions/extract-upload`,
      formData
    );
    const rawData = res.data as any;
    const result = rawData?.data && typeof rawData.data === 'object' ? rawData.data : rawData;
    return { data: result, error: res.error };
  }

  async aiFormat(projectId: string, text: string, productName?: string): Promise<{ data?: ProductDescriptionAiFormatResult; error?: string }> {
    const res = await apiService.post<ProductDescriptionAiFormatResult>(
      `/projects/${projectId}/product-descriptions/ai-format`,
      { text, productName }
    );
    const rawData = res.data as any;
    const result = rawData?.data && typeof rawData.data === 'object' ? rawData.data : rawData;
    return { data: result, error: res.error };
  }
}

export const productDescriptionService = new ProductDescriptionService();