import type { SelectedCatalogItem } from '@/utils/catalogPricing';

export interface ProjectServiceAddendumItem {
  serviceId: string;
  serviceName?: string;
  quantity: number;
  packageKey?: string;
  packageName?: string;
  packageQuantity?: number;
  isPackageService?: boolean;
  sellingPrice: number;
  cost: number;
}

export interface CreateProjectServiceAddendumPayload {
  name: string;
  description?: string;
  items: ProjectServiceAddendumItem[];
}

export interface ProjectServiceContext {
  status?: string;
  isOnHold?: boolean;
  hasAccount: boolean;
}

export function canAddProjectServices(role: string | undefined, project: ProjectServiceContext): boolean {
  return ['PM', 'ADMIN'].includes(role || '') && project.hasAccount && !project.isOnHold &&
    ['CONFIRMED', 'IN_PROGRESS', 'PENDING_PAUSE_APPROVAL'].includes(project.status || '');
}

export function validateProjectServiceAddendum(payload: CreateProjectServiceAddendumPayload): string | null {
  if (!payload.name.trim()) return 'Vui lòng nhập tên phụ lục.';
  if (!payload.items.length) return 'Vui lòng chọn ít nhất một dịch vụ.';
  if (payload.items.some((item) => !item.serviceId || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
    return 'Số lượng dịch vụ phải là số nguyên dương.';
  }
  if (payload.items.some((item) => !Number.isFinite(item.sellingPrice) || item.sellingPrice < 0 ||
    !Number.isFinite(item.cost) || item.cost < 0)) return 'Đơn giá hoặc giá vốn không hợp lệ.';
  return null;
}

/** The package key belongs to this request; quantity = norm × number of packages. */
export function toProjectServiceItems(selected: SelectedCatalogItem[], packageKey?: string): ProjectServiceAddendumItem[] {
  return selected.map((item) => ({
    serviceId: item.serviceId,
    serviceName: item.serviceName,
    quantity: Number(item.quantity ?? 1),
    cost: Number(item.costPrice),
    sellingPrice: Number(item.costPrice),
    ...(item.isPackageService ? {
      packageKey, packageName: item.packageName, packageQuantity: 1, isPackageService: true,
    } : { isPackageService: false }),
  }));
}
