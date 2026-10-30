import { Decimal } from 'decimal.js';
import type { ServiceItem } from '@/services/catalogService';
import type { ServicePackage } from '@/services/servicePackageService';

export interface ProjectServiceDraft {
  key: string;
  service: ServiceItem;
  quantity: string;
  norm: string;
  sellingPrice: string;
  cost: string;
  budget: string;
  packageKey?: string;
  packageName?: string;
  packageQuantity?: string;
}

/** Initial custom price follows newly selected quotation services (40% target margin). */
export function getDraftRecommendedPrice(cost: string, budget = '0'): Decimal {
  return new Decimal(cost || 0).plus(budget || 0).div('0.6').div(10000).ceil().mul(10000);
}

export function getPackageDraftPrice(items: ProjectServiceDraft[], key: string): Decimal {
  return items.filter((item) => item.packageKey === key).reduce(
    (sum, item) => sum.plus(new Decimal(item.sellingPrice || 0).mul(item.norm || 1)), new Decimal(0),
  );
}

/** Child custom inputs are prices at the package norm, as in quotations. */
export function updateDraftCustomPrice(item: ProjectServiceDraft, price: string): ProjectServiceDraft {
  return { ...item, sellingPrice: price ? new Decimal(price).div(item.packageKey ? item.norm : 1).toFixed() : '' };
}

export function updateDraftPackagePrice(items: ProjectServiceDraft[], key: string, price: string): ProjectServiceDraft[] {
  const rows = items.filter((item) => item.packageKey === key);
  if (!rows.length) return items;
  const total = new Decimal(price || 0);
  const weights = rows.map((item) => {
    const recommended = getDraftRecommendedPrice(item.cost, item.budget);
    const cost = new Decimal(item.cost || 0);
    return (recommended.isZero() ? cost.isZero() ? new Decimal(1) : cost : recommended).mul(item.norm || 1);
  });
  const weightTotal = weights.reduce((sum, value) => sum.plus(value), new Decimal(0));
  let allocated = new Decimal(0);
  let position = 0;
  return items.map((item) => {
    if (item.packageKey !== key) return item;
    const share = position === rows.length - 1 ? Decimal.max(0, total.minus(allocated))
      : total.mul(weightTotal.gt(0) ? weights[position].div(weightTotal) : new Decimal(1).div(rows.length)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    allocated = allocated.plus(share);
    position += 1;
    return { ...item, sellingPrice: share.div(item.norm || 1).toFixed() };
  });
}

export function getAddServiceBlockReason(role?: string, status?: string, isOnHold?: boolean): string | null {
  if (!['ADMIN', 'PM'].includes(role || '')) return 'Bạn không có quyền bổ sung dịch vụ cho dự án này.';
  if (['COMPLETED', 'CANCELLED'].includes(status || '')) return 'Dự án đã đóng — không thể thêm dịch vụ.';
  if (status === 'ON_HOLD' || isOnHold) return 'Dự án đang tạm dừng — không thể thêm dịch vụ.';
  if (!['IN_PROGRESS', 'CONFIRMED'].includes(status || '')) return 'Dự án chưa được xác nhận — không thể thêm dịch vụ.';
  return null;
}

export function createServiceDraft(service: ServiceItem, packageInfo?: {
  key: string; name: string; norm: string;
}): ProjectServiceDraft {
  const cost = new Decimal(service.costPrice || 0).toFixed();
  return {
    key: `${packageInfo?.key || 'standalone'}-${service.id}`,
    service, quantity: packageInfo?.norm || '1', norm: packageInfo?.norm || '1',
    sellingPrice: getDraftRecommendedPrice(cost).toFixed(), cost, budget: '0',
    packageKey: packageInfo?.key, packageName: packageInfo?.name,
    packageQuantity: packageInfo ? '1' : undefined,
  };
}

export function createPackageDrafts(template: ServicePackage, services: ServiceItem[], key: string): ProjectServiceDraft[] {
  return (template.items || []).flatMap((item) => {
    const service = services.find((entry) => String(entry.id) === String(item.serviceId || item.service?.id)) || item.service;
    return service?.id ? [createServiceDraft(service, {
      key, name: template.name, norm: new Decimal(item.defaultQuantity || 1).toFixed(),
    })] : [];
  });
}

export function updatePackageQuantity(items: ProjectServiceDraft[], key: string, quantity: string): ProjectServiceDraft[] {
  return items.map((item) => item.packageKey === key ? {
    ...item, packageQuantity: quantity,
    quantity: quantity ? new Decimal(item.norm).mul(quantity).toFixed() : '',
  } : item);
}

export function getDraftTotals(items: ProjectServiceDraft[]) {
  const totals = items.reduce((total, item) => {
    const quantity = new Decimal(item.quantity || 0);
    const taskCount = (item.service.serviceJobs || []).reduce(
      (sum, job) => sum.plus(new Decimal(job.quantity || 1).mul(quantity)), new Decimal(0),
    );
    return {
      revenue: total.revenue.plus(new Decimal(item.sellingPrice || 0).mul(quantity)),
      cost: total.cost.plus(new Decimal(item.cost || 0).plus(item.budget || 0).mul(quantity)),
      budget: total.budget.plus(new Decimal(item.budget || 0).mul(quantity)),
      taskCount: total.taskCount.plus(taskCount),
    };
  }, { revenue: new Decimal(0), cost: new Decimal(0), budget: new Decimal(0), taskCount: new Decimal(0) });
  const profit = totals.revenue.minus(totals.cost);
  return {
    ...totals, profit,
    margin: totals.revenue.gt(0) ? profit.div(totals.revenue).mul(100) : new Decimal(0),
    vat: totals.revenue.mul('0.08'), totalWithVat: totals.revenue.mul('1.08'),
  };
}

export function validateProjectServiceDrafts(items: ProjectServiceDraft[]): string | null {
  if (!items.length) return 'Vui lòng chọn ít nhất một dịch vụ';
  for (const item of items) {
    if (!item.service.id) return 'Dịch vụ bổ sung không hợp lệ';
    const budget = new Decimal(item.budget || 0);
    if (!budget.isInteger() || budget.lt(0) || budget.gt(Number.MAX_SAFE_INTEGER)) return 'Ngân sách phải là số nguyên đồng không âm hợp lệ';
    if (item.service.isBudget !== true && !budget.isZero()) return 'Dịch vụ không cho phép nhập ngân sách';
    const quantity = new Decimal(item.quantity || 0);
    if (!quantity.isInteger() || quantity.lte(0) || quantity.gt(Number.MAX_SAFE_INTEGER)) {
      return 'Số lượng dịch vụ phải là số nguyên dương hợp lệ';
    }
    if (item.packageKey) {
      const packageQuantity = new Decimal(item.packageQuantity || 0);
      if (!packageQuantity.isInteger() || packageQuantity.lte(0)) return 'Số lượng gói phải là số nguyên dương';
    }
    for (const value of [item.sellingPrice, item.cost]) {
      const amount = new Decimal(value || 0);
      if (!amount.isFinite() || amount.isNegative() || amount.gt(Number.MAX_SAFE_INTEGER)) return 'Đơn giá dịch vụ không hợp lệ';
    }
  }
  return null;
}

// Keep the numeric wire contract used by the web; all preview arithmetic stays in Decimal.
export function toProjectServiceItems(items: ProjectServiceDraft[]) {
  return items.map((item) => ({
    serviceId: item.service.id, serviceName: item.service.name,
    quantity: new Decimal(item.quantity).toNumber(),
    packageKey: item.packageKey, packageName: item.packageName,
    packageQuantity: item.packageQuantity ? new Decimal(item.packageQuantity).toNumber() : undefined,
    isPackageService: Boolean(item.packageKey),
    sellingPrice: new Decimal(item.sellingPrice || 0).toNumber(), cost: new Decimal(item.cost || 0).toNumber(),
    budget: new Decimal(item.budget || 0).toNumber(),
  }));
}
