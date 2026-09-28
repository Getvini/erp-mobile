import { apiService } from './api';
import { buildDocumentQueryParams, DocumentFilters } from '@/utils/documentLibrary';

/**
 * Bộ lọc chuẩn dùng chung cho service + hook (định nghĩa gốc ở `@/utils/documentLibrary`).
 */
export type { DocumentFilters };


/** `resourceType` Cloudinary. */
export type DocumentResourceType = 'image' | 'video' | 'raw';

/** Người tải lên — UI hiển thị `uploadedBy.username` (KHÔNG phải fullName). */
export interface DocumentUploader {
  id: string;
  username?: string;
  fullName?: string;
  email?: string;
  role?: string;
}

/** File gửi kèm cho multipart upload. */
export interface DocumentUploadFile {
  uri: string;
  name: string;
  mimeType?: string;
  type?: string;
  size?: number;
}

/**
 * Entity `Documents` (backend) — mọi field đều PHẲNG trên document,
 * KHÔNG có object lồng `file: { url, name, size, format }`.
 */
export interface DocumentEntity {
  id: string;
  /** BẮT BUỘC — tên field là `displayName`, KHÔNG phải `name`. */
  displayName: string;
  description?: string | null;
  /** simple-array string[] từ backend. */
  tags?: string[] | null;
  fileUrl: string;
  publicId: string;
  originalFileName: string;
  fileExtension?: string | null;
  mimeType?: string | null;
  resourceType: DocumentResourceType;
  /** bigint từ Postgres → có thể về dạng string. */
  fileSizeBytes?: number | string | null;
  /** Bắt đầu từ 1. */
  currentVersion: number;
  downloadCount: number;
  uploadedById: string;
  uploadedBy?: DocumentUploader | null;
  versions?: DocumentVersionEntity[];
  createdAt: string;
  updatedAt?: string;
  /** Backend gắn thêm khi list: suy từ `fileExtension`. */
  category?: string;
}

/** Entity `DocumentVersions` — cùng shape phẳng, thêm `versionNumber`. */
export interface DocumentVersionEntity {
  id: string;
  documentId: string;
  versionNumber: number;
  fileUrl: string;
  publicId: string;
  originalFileName: string;
  fileExtension?: string | null;
  mimeType?: string | null;
  resourceType: DocumentResourceType;
  fileSizeBytes?: number | string | null;
  uploadedById: string;
  uploadedBy?: DocumentUploader | null;
  createdAt: string;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
}

export interface UploadDocumentPayload {
  file: DocumentUploadFile;
  /** Bắt buộc — backend trả 400 nếu thiếu. */
  displayName: string;
  description?: string;
  tags?: string[];
}

export interface UploadDocumentVersionPayload {
  id: string;
  file: DocumentUploadFile;
}

export interface UpdateDocumentPayload {
  id: string;
  /** Bắt buộc — backend trả 400 nếu thiếu. */
  displayName: string;
  description?: string;
  tags?: string[];
}

export interface RestoreDocumentVersionPayload {
  id: string;
  versionId: string;
}

export interface DocumentVersionDownloadPayload {
  id: string;
  versionId: string;
}

type ServiceResult<T> = { data?: T; error?: string };

/**
 * Nguyên nhân phải tự append thủ công: FormData của React Native yêu cầu object
 * `{ uri, name, type }` chứ không nhận `Blob`/`File` như web.
 */
const toFormDataFile = (file: DocumentUploadFile) => ({
  uri: file.uri,
  name: file.name,
  type: file.type || file.mimeType || 'application/octet-stream',
});

class DocumentLibraryService {
  /**
   * GET /document-library → **mảng thô, KHÔNG phân trang**.
   * `tags` gửi dạng CSV, `category`/`sort` bỏ qua khi rỗng hoặc 'all'.
   */
  async getDocuments(filters?: DocumentFilters): Promise<ServiceResult<DocumentEntity[]>> {
    const params = buildDocumentQueryParams(filters);
    const res = await apiService.get<DocumentEntity[]>('/document-library', params);
    if (res.error) return { error: res.error };
    return { data: Array.isArray(res.data) ? res.data : [] };
  }

  /** GET /document-library/tags → mảng string đã sort sẵn từ backend. */
  async getDocumentTags(): Promise<ServiceResult<string[]>> {
    const res = await apiService.get<string[]>('/document-library/tags');
    if (res.error) return { error: res.error };
    if (!Array.isArray(res.data)) return { data: [] };
    return { data: res.data.filter((tag): tag is string => typeof tag === 'string') };
  }

  /** GET /document-library/:id */
  async getDocument(id: string): Promise<ServiceResult<DocumentEntity>> {
    const res = await apiService.get<DocumentEntity>(`/document-library/${id}`);
    if (res.error) return { error: res.error };
    if (!res.data) return { error: 'Không tìm thấy tài liệu' };
    return { data: res.data };
  }

  /**
   * GET /document-library/:id/download → JSON `{ downloadUrl }`, KHÔNG stream file.
   * ⚠️ Mỗi lần gọi backend tăng `downloadCount` thêm 1.
   */
  async getDocumentDownloadUrl(id: string): Promise<ServiceResult<DownloadUrlResponse>> {
    const res = await apiService.get<DownloadUrlResponse>(`/document-library/${id}/download`);
    if (res.error) return { error: res.error };
    if (!res.data?.downloadUrl) return { error: 'Không lấy được liên kết tải tài liệu' };
    return { data: res.data };
  }

  /** GET /document-library/:id/versions → mảng thô, `versionNumber DESC`. */
  async getDocumentVersions(id: string): Promise<ServiceResult<DocumentVersionEntity[]>> {
    const res = await apiService.get<DocumentVersionEntity[]>(`/document-library/${id}/versions`);
    if (res.error) return { error: res.error };
    return { data: Array.isArray(res.data) ? res.data : [] };
  }

  /** GET /document-library/:id/versions/:versionId/download → `{ downloadUrl }`. */
  async getDocumentVersionDownloadUrl({
    id,
    versionId,
  }: DocumentVersionDownloadPayload): Promise<ServiceResult<DownloadUrlResponse>> {
    const res = await apiService.get<DownloadUrlResponse>(
      `/document-library/${id}/versions/${versionId}/download`,
    );
    if (res.error) return { error: res.error };
    if (!res.data?.downloadUrl) return { error: 'Không lấy được liên kết tải phiên bản' };
    return { data: res.data };
  }

  /**
   * POST /document-library/upload (multipart).
   * Field file tên chính xác là `file`; `tags` PHẢI là JSON string.
   * KHÔNG tự set header `Content-Type` để boundary của FormData tự sinh.
   */
  async uploadDocument({
    file,
    displayName,
    description,
    tags,
  }: UploadDocumentPayload): Promise<ServiceResult<DocumentEntity>> {
    const formData = new FormData();
    formData.append('file', toFormDataFile(file) as any);
    formData.append('displayName', displayName);
    if (description) formData.append('description', description);
    if (tags && tags.length > 0) formData.append('tags', JSON.stringify(tags));

    const res = await apiService.postForm<DocumentEntity>('/document-library/upload', formData);
    if (res.error) return { error: res.error };
    if (!res.data) return { error: 'Không nhận được dữ liệu tài liệu sau khi tải lên' };
    return { data: res.data };
  }

  /** POST /document-library/:id/versions (multipart) — CHỈ field `file`. */
  async uploadDocumentVersion({
    id,
    file,
  }: UploadDocumentVersionPayload): Promise<ServiceResult<DocumentEntity>> {
    const formData = new FormData();
    formData.append('file', toFormDataFile(file) as any);

    const res = await apiService.postForm<DocumentEntity>(
      `/document-library/${id}/versions`,
      formData,
    );
    if (res.error) return { error: res.error };
    if (!res.data) return { error: 'Không nhận được dữ liệu tài liệu sau khi cập nhật phiên bản' };
    return { data: res.data };
  }

  /**
   * POST /document-library/:id/versions/:versionId/restore — KHÔNG body.
   * ⚠️ Backend TẠO VERSION MỚI (`currentVersion + 1`) copy metadata từ bản được chọn;
   * KHÔNG rollback và KHÔNG xóa lịch sử.
   */
  async restoreDocumentVersion({
    id,
    versionId,
  }: RestoreDocumentVersionPayload): Promise<ServiceResult<DocumentEntity>> {
    const res = await apiService.post<DocumentEntity>(
      `/document-library/${id}/versions/${versionId}/restore`,
    );
    if (res.error) return { error: res.error };
    if (!res.data) return { error: 'Không nhận được dữ liệu tài liệu sau khi khôi phục' };
    return { data: res.data };
  }

  /** PUT /document-library/:id — `displayName` bắt buộc. */
  async updateDocument({
    id,
    displayName,
    description,
    tags,
  }: UpdateDocumentPayload): Promise<ServiceResult<DocumentEntity>> {
    const body: Record<string, any> = { displayName };
    // Gửi mảng rỗng để backend thực sự xóa hết tags (Object.assign).
    body.description = description ?? '';
    body.tags = tags ?? [];

    const res = await apiService.put<DocumentEntity>(`/document-library/${id}`, body);
    if (res.error) return { error: res.error };
    if (!res.data) return { error: 'Không nhận được dữ liệu tài liệu sau khi cập nhật' };
    return { data: res.data };
  }

  /** DELETE /document-library/:id — xóa cả Cloudinary + mọi version. */
  async deleteDocument(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await apiService.delete(`/document-library/${id}`);
    if (res.error) return { success: false, error: res.error };
    return { success: true };
  }
}

export const documentLibraryService = new DocumentLibraryService();
