import { useAuthStore } from '@/stores/useAuthStore';
import { isManagementRole } from '@/utils/rbac';
export function assertCatalogWriteAccess() {
  if (!isManagementRole(useAuthStore.getState().user?.role)) throw new Error('Chỉ Admin/BOD được thay đổi danh mục.');
}
