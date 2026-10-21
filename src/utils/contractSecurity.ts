import { isManagementRole } from './rbac';

/**
 * P0 Security Guard: Bảo vệ giá vốn (Cost Price) của hợp đồng/dự án.
 * Chỉ cho phép Quản trị cấp cao (ADMIN, BOD) được xem giá vốn.
 * Tất cả các vai trò khác (PM, BD, Sales, Dev, Content...) bị ẩn hoàn toàn.
 */
export function shouldDisplayCostPrice(role?: string): boolean {
  return isManagementRole(role);
}
