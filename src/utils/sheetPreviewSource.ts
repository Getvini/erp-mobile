import { qcSpellCheckService, LocalPickedFile } from '@/services/qcSpellCheckService';
import { taskResultChecksService } from '@/services/taskResultChecksService';
import type { PreviewRequest, PreviewWindow } from '@/utils/sheetScope';

export interface PreviewSource {
  key: string;
  load: (request: PreviewRequest) => Promise<PreviewWindow>;
}

const MAX_CACHE_ENTRIES = 80;

const windowCache = new Map<string, Promise<PreviewWindow>>();

const cacheKeyOf = (sourceKey: string, request: PreviewRequest) =>
  [sourceKey, request.sheet || '', request.rowStart, request.rowCount, request.colStart, request.colCount].join('|');

const createSource = (
  key: string,
  fetchWindow: (request: PreviewRequest) => Promise<{ data?: PreviewWindow; error?: string }>
): PreviewSource => ({
  key,
  load: (request) => {
    const cacheKey = cacheKeyOf(key, request);
    const cached = windowCache.get(cacheKey);
    if (cached) {
      windowCache.delete(cacheKey);
      windowCache.set(cacheKey, cached);
      return cached;
    }
    const pending = fetchWindow(request).then((res) => {
      if (res.error || !res.data) {
        throw new Error(res.error || 'Không tải được bản xem trước');
      }
      return res.data;
    });
    windowCache.set(cacheKey, pending);
    pending.catch(() => {
      if (windowCache.get(cacheKey) === pending) windowCache.delete(cacheKey);
    });
    while (windowCache.size > MAX_CACHE_ENTRIES) {
      const oldest = windowCache.keys().next().value as string;
      windowCache.delete(oldest);
    }
    return pending;
  },
});

export const createUrlSource = (fileUrl: string, fileName: string): PreviewSource =>
  createSource(`url:${fileUrl}`, (request) => qcSpellCheckService.previewFromUrl(fileUrl, fileName, request));

export const createFileSource = (file: LocalPickedFile): PreviewSource => {
  const key = `file:${file.name}:${file.uri}`;
  return createSource(key, (request) => qcSpellCheckService.previewFromFile(key, file, request));
};

export const createTaskSource = (taskId: string, recordId: string): PreviewSource =>
  createSource(`task:${taskId}:${recordId}`, (request) => taskResultChecksService.getPreview(taskId, request));
