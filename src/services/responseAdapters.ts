import type { TaskItem } from './dashboardService';

/**
 * Chuẩn hóa response danh sách task giữa API phân trang hiện tại
 * (`{ data: TaskItem[], meta: ... }`) và response mảng legacy.
 */
export function normalizeTaskListResponse(response: unknown): TaskItem[] {
  if (Array.isArray(response)) {
    return response as TaskItem[];
  }

  if (response && typeof response === 'object') {
    const data = (response as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return data as TaskItem[];
    }
  }

  return [];
}
