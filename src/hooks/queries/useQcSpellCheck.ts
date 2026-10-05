import { useQuery } from '@tanstack/react-query';
import type { PreviewRequest } from '@/utils/sheetScope';
import type { PreviewSource } from '@/utils/sheetPreviewSource';
import { qcSpellCheckService, LocalPickedFile } from '@/services/qcSpellCheckService';
import { queryKeys } from '@/services/queryKeys';
import { isSpreadsheetFile } from '@/utils/spellCheckLink';

export function useSpellCheckSheetsFromUrlQuery(fileUrl?: string, fileName?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.spellingCheck.sheetsFromUrl(fileUrl, fileName),
    queryFn: async () => {
      const res = await qcSpellCheckService.getSheetsFromUrl(fileUrl as string, fileName);
      if (res.error) {
        throw Object.assign(new Error(res.error), { status: res.status });
      }
      return res.data || { sheets: [], scenarios: {} };
    },
    enabled: Boolean(fileUrl) && isSpreadsheetFile(fileName || '') && enabled,
  });
}

export function useSpellCheckSheetsFromFileQuery(file?: LocalPickedFile, enabled = true) {
  return useQuery({
    queryKey: queryKeys.spellingCheck.sheetsFromFile(file?.uri, file?.name),
    queryFn: async () => {
      const res = await qcSpellCheckService.getSheetsFromFile(file as LocalPickedFile);
      if (res.error) {
        throw Object.assign(new Error(res.error), { status: res.status });
      }
      return res.data || { sheets: [], scenarios: {} };
    },
    enabled: Boolean(file?.uri) && isSpreadsheetFile(file?.name || '') && enabled,
  });
}

export function useQcProductInfoQuery(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.qc.productInfo(projectId || ''),
    queryFn: async () => {
      const res = await qcSpellCheckService.getProductInfo(projectId as string);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    enabled: Boolean(projectId) && enabled,
  });
}

export function useSheetPreviewQuery(source: PreviewSource | undefined, request: PreviewRequest, enabled = true) {
  return useQuery({
    queryKey: queryKeys.spellingCheck.preview(
      source?.key || '',
      request.sheet || '',
      request.rowStart,
      request.rowCount,
      request.colStart,
      request.colCount
    ),
    queryFn: () => (source as PreviewSource).load(request),
    enabled: Boolean(source) && enabled,
    staleTime: 120000,
  });
}
