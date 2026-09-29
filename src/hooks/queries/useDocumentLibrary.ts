import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import {
  documentLibraryService,
  DocumentEntity,
  DocumentFilters,
  DocumentVersionEntity,
  RestoreDocumentVersionPayload,
  UpdateDocumentPayload,
  UploadDocumentPayload,
  UploadDocumentVersionPayload,
} from '@/services/documentLibraryService';
import { queryKeys } from '@/services/queryKeys';

export type { DocumentFilters };

/** Danh sách tài liệu — backend trả mảng thô, KHÔNG phân trang. */
export function useDocumentsQuery(params: DocumentFilters = {}) {
  return useQuery({
    queryKey: queryKeys.documents.list(params),
    queryFn: async (): Promise<DocumentEntity[]> => {
      const res = await documentLibraryService.getDocuments(params);
      if (res.error) throw new Error(res.error);
      return res.data || [];
    },
  });
}

/** Toàn bộ tags đang có trong thư viện (mảng string đã sort). */
export function useDocumentTagsQuery() {
  return useQuery({
    queryKey: queryKeys.documents.tags(),
    queryFn: async (): Promise<string[]> => {
      const res = await documentLibraryService.getDocumentTags();
      if (res.error) throw new Error(res.error);
      return res.data || [];
    },
  });
}

/** Chi tiết 1 tài liệu. */
export function useDocumentDetailQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.documents.detail(id || ''),
    queryFn: async (): Promise<DocumentEntity> => {
      if (!id) throw new Error('Thiếu ID tài liệu');
      const res = await documentLibraryService.getDocument(id);
      if (res.error || !res.data) throw new Error(res.error || 'Không tìm thấy tài liệu');
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/** Lịch sử phiên bản của 1 tài liệu (versionNumber DESC). */
export function useDocumentVersionsQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.documents.versions(id || ''),
    queryFn: async (): Promise<DocumentVersionEntity[]> => {
      if (!id) throw new Error('Thiếu ID tài liệu');
      const res = await documentLibraryService.getDocumentVersions(id);
      if (res.error) throw new Error(res.error);
      return res.data || [];
    },
    enabled: Boolean(id),
  });
}

/** Tải lên tài liệu mới (multipart). */
export function useUploadDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UploadDocumentPayload): Promise<DocumentEntity> => {
      const res = await documentLibraryService.uploadDocument(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể tải tài liệu lên');
      }
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.documents.detail(data.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.documents.versions(data.id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.tags() });
    },
  });
}

/** Tải lên phiên bản mới cho tài liệu đã có (multipart, chỉ field `file`). */
export function useUploadDocumentVersionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UploadDocumentVersionPayload): Promise<DocumentEntity> => {
      const res = await documentLibraryService.uploadDocumentVersion(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể cập nhật phiên bản mới');
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.versions(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.tags() });
    },
  });
}

/**
 * Khôi phục phiên bản cũ — backend TẠO VERSION MỚI (currentVersion + 1),
 * KHÔNG rollback và KHÔNG xóa lịch sử.
 */
export function useRestoreDocumentVersionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RestoreDocumentVersionPayload): Promise<DocumentEntity> => {
      const res = await documentLibraryService.restoreDocumentVersion(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể khôi phục phiên bản');
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.versions(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.tags() });
    },
  });
}

/** Cập nhật metadata tài liệu (`displayName` bắt buộc). */
export function useUpdateDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateDocumentPayload): Promise<DocumentEntity> => {
      const res = await documentLibraryService.updateDocument(payload);
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không thể cập nhật tài liệu');
      }
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.versions(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.tags() });
    },
  });
}

/** Xóa tài liệu (xóa cả Cloudinary + mọi version). */
export function useDeleteDocumentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const res = await documentLibraryService.deleteDocument(id);
      if (!res.success) throw new Error(res.error || 'Không thể xóa tài liệu');
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      queryClient.removeQueries({ queryKey: queryKeys.documents.detail(id) });
      queryClient.removeQueries({ queryKey: queryKeys.documents.versions(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.tags() });
    },
  });
}

/**
 * Tải tài liệu: lấy signed URL từ backend rồi mở bằng `Linking`.
 * Trả về url để UI có thể hiển thị/copy. ⚠️ Mỗi lần gọi tăng `downloadCount`.
 */
export function useDocumentDownloadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const res = await documentLibraryService.getDocumentDownloadUrl(id);
      if (res.error || !res.data?.downloadUrl) {
        throw new Error(res.error || 'Không lấy được liên kết tải tài liệu');
      }
      const downloadUrl = res.data.downloadUrl;
      await Linking.openURL(downloadUrl);
      return downloadUrl;
    },
    onSuccess: () => {
      // downloadCount đã tăng ở backend → làm mới danh sách & chi tiết.
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
    },
  });
}

/**
 * Tải 1 phiên bản cụ thể: lấy URL rồi mở bằng `Linking`.
 * Endpoint version KHÔNG tăng `downloadCount` của document.
 */
export function useDocumentVersionDownloadMutation() {
  return useMutation({
    mutationFn: async ({ id, versionId }: { id: string; versionId: string }): Promise<string> => {
      const res = await documentLibraryService.getDocumentVersionDownloadUrl({ id, versionId });
      if (res.error || !res.data?.downloadUrl) {
        throw new Error(res.error || 'Không lấy được liên kết tải phiên bản');
      }
      const downloadUrl = res.data.downloadUrl;
      await Linking.openURL(downloadUrl);
      return downloadUrl;
    },
  });
}
