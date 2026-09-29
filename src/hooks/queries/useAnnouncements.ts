import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import {
  announcementService,
  AnnouncementFilters,
  AnnouncementItem,
  AnnouncementListResult,
  CreateAnnouncementPayload,
  UpdateAnnouncementPayload,
} from '@/services/announcementService';
import { queryKeys } from '@/services/queryKeys';

/**
 * HOOKS — BẢNG TIN CÔNG TY (Announcements) — Phase P3
 *
 * List có phân trang server-side thật (`{ data, total, page, limit, totalPages }`)
 * nên dùng `useInfiniteQuery` + nút "Tải thêm".
 */

export type AnnouncementListParams = AnnouncementFilters & { enabled?: boolean };

const DEFAULT_PAGE_SIZE = 10;

type AnnouncementListCache = InfiniteData<AnnouncementListResult, number>;

/** Cập nhật `isRead` cho MỌI cache list (infinite + dạng phẳng) và cache detail. */
const applyReadToCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
): { restore: () => void } => {
  const listKey = queryKeys.announcements.lists();
  const detailKey = queryKeys.announcements.detail(id);

  const previousLists = queryClient.getQueriesData<AnnouncementListCache>({ queryKey: listKey });
  const previousDetail = queryClient.getQueryData<AnnouncementItem>(detailKey);

  queryClient.setQueriesData<AnnouncementListCache>({ queryKey: listKey }, (current) => {
    if (!current) return current;

    // Dạng infinite: { pages, pageParams }
    if (Array.isArray((current as AnnouncementListCache).pages)) {
      const infinite = current as AnnouncementListCache;
      return {
        ...infinite,
        pages: infinite.pages.map((page) => ({
          ...page,
          data: (page.data || []).map((item) =>
            item.id === id ? { ...item, isRead: true } : item,
          ),
        })),
      };
    }

    // Dạng phẳng (phòng khi cache được set bởi consumer khác)
    const flat = current as unknown as AnnouncementListResult;
    return {
      ...flat,
      data: (flat.data || []).map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    } as unknown as AnnouncementListCache;
  });

  if (previousDetail && previousDetail.id === id) {
    queryClient.setQueryData<AnnouncementItem>(detailKey, { ...previousDetail, isRead: true });
  }

  return {
    restore: () => {
      previousLists.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      if (previousDetail) {
        queryClient.setQueryData(detailKey, previousDetail);
      }
    },
  };
};

/** Danh sách thông báo có phân trang server-side (infinite scroll / nút Tải thêm). */
export function useAnnouncementsQuery(params: AnnouncementListParams = {}) {
  const { enabled, ...filters } = params;
  const limit = filters.limit || DEFAULT_PAGE_SIZE;

  return useInfiniteQuery({
    queryKey: queryKeys.announcements.list({ ...filters, limit }),
    queryFn: async ({ pageParam }) => {
      const res = await announcementService.getAnnouncements({
        ...filters,
        page: pageParam,
        limit,
      });
      if (res.error) throw new Error(res.error);
      return (
        res.data || { data: [], total: 0, page: pageParam, limit, totalPages: 1 }
      );
    },
    initialPageParam: filters.page || 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages, data } = lastPage;
      if (!data.length) return undefined;
      if (page >= totalPages) return undefined;
      return page + 1;
    },
    enabled: enabled ?? true,
  });
}

/** Chi tiết một thông báo (kèm số liệu đọc nếu là manager/người tạo). */
export function useAnnouncementDetailQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.announcements.detail(id || ''),
    queryFn: async () => {
      const res = await announcementService.getAnnouncement(id as string);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/** Bình luận của thông báo (backend trả ASC). */
export function useAnnouncementCommentsQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.announcements.comments(id || ''),
    queryFn: async () => {
      const res = await announcementService.getAnnouncementComments(id as string);
      if (res.error) throw new Error(res.error);
      return res.data || [];
    },
    enabled: Boolean(id),
  });
}

/**
 * Số thông báo chưa đọc — backend KHÔNG có endpoint đếm riêng nên đếm client-side
 * trên list `{ page: 1, limit: 10, status: 'SENT' }` (giống Web Header).
 */
export function useUnreadAnnouncementsCountQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.announcements.unreadCount(),
    queryFn: async () => {
      const res = await announcementService.getAnnouncements({
        page: 1,
        limit: 10,
        status: 'SENT',
      });
      if (res.error) throw new Error(res.error);
      const items = res.data?.data || [];
      return items.filter((item) => !item.isRead).length;
    },
    enabled,
  });
}

export function useCreateAnnouncementMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateAnnouncementPayload) => {
      const res = await announcementService.createAnnouncement(payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
    },
  });
}

export function useUpdateAnnouncementMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateAnnouncementPayload) => {
      const res = await announcementService.updateAnnouncement(payload);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.detail(variables.id) });
    },
  });
}

export function useDeleteAnnouncementMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await announcementService.deleteAnnouncement(id);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.comments(id) });
    },
  });
}

/**
 * Đánh dấu đã đọc — optimistic + rollback.
 * Truyền `{ id, wasRead: true }` để bỏ qua network (item đã đọc).
 */
export function useMarkAnnouncementReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, wasRead }: { id: string; wasRead?: boolean }) => {
      if (wasRead) return null;
      const res = await announcementService.markAnnouncementAsRead(id);
      // Backend có thể trả body rỗng ⇒ KHÔNG đọc thuộc tính của `res.data`.
      if (res.error) throw new Error(res.error);
      return res.data ?? null;
    },
    onMutate: async ({ id, wasRead }) => {
      if (wasRead) return { restore: () => undefined };
      await queryClient.cancelQueries({ queryKey: queryKeys.announcements.lists() });
      await queryClient.cancelQueries({ queryKey: queryKeys.announcements.detail(id) });
      return applyReadToCaches(queryClient, id);
    },
    onError: (_error, _variables, context) => {
      context?.restore?.();
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.lists() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.announcements.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.unreadCount() });
    },
  });
}

export function useAddAnnouncementCommentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await announcementService.addAnnouncementComment({ id, content });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.announcements.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.announcements.comments(variables.id),
      });
    },
  });
}

export function useDeleteAnnouncementCommentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, commentId }: { id: string; commentId: string }) => {
      const res = await announcementService.deleteAnnouncementComment({ id, commentId });
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.announcements.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.announcements.comments(variables.id),
      });
    },
  });
}
