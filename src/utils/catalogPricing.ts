/**
 * Catalog pricing utilities (Phase P2 — Dịch vụ niêm yết & Gói dịch vụ).
 *
 * Pure, dependency-free logic so it can be unit-tested without React Native.
 * The rounding rule mirrors erp-UI `QuotationModal.jsx:140-142` exactly:
 *   const roundToTenThousands = (value) => Math.ceil(value / 10000) * 10000;
 */

export const ROUNDING_STEP = 10000;

/** Minimum profit margin protected by the "giá tối thiểu" suggestion (20%). */
export const MINIMUM_PROFIT_MARGIN_RATE = 0.8;

/** Margin used by the "giá đề xuất" suggestion (40%). */
export const RECOMMENDED_PROFIT_MARGIN_RATE = 0.6;

/**
 * Làm tròn LÊN bội số 10.000 gần nhất — quy tắc làm tròn thật của giá bán niêm yết.
 * TUYỆT ĐỐI không dùng Math.round (mirror erp-UI QuotationModal.jsx:140-142).
 */
export function roundToTenThousands(value: number): number {
  return Math.ceil(Number(value || 0) / ROUNDING_STEP) * ROUNDING_STEP;
}

/** Giá bán tối thiểu — biên lợi nhuận 20% (chia 0.8) rồi làm tròn 10.000. */
export function getMinimumSellingPrice(costPrice?: number | string | null): number {
  return roundToTenThousands(Number(costPrice || 0) / MINIMUM_PROFIT_MARGIN_RATE);
}

/** Giá bán đề xuất — biên lợi nhuận 40% (chia 0.6) rồi làm tròn 10.000. */
export function getRecommendedSellingPrice(costPrice?: number | string | null): number {
  return roundToTenThousands(Number(costPrice || 0) / RECOMMENDED_PROFIT_MARGIN_RATE);
}

/**
 * Biên lợi nhuận theo giá bán (%).
 * Giữ nguyên số lẻ, KHÔNG làm tròn (mirror `calculateProfitMargin` erp-UI).
 */
export function getProfitMargin(
  sellingPrice?: number | string | null,
  costPrice?: number | string | null,
): number {
  const price = Number(sellingPrice || 0);
  if (price <= 0) return 0;
  return ((price - Number(costPrice || 0)) / price) * 100;
}

export interface ServiceJobCostInput {
  quantity?: number | string | null;
  job?: { costPrice?: number | string | null } | null;
}

/**
 * Giá vốn dịch vụ = Σ (job.costPrice × quantity).
 * KHÔNG làm tròn — mirror backend `ServiceService.recalculateCost`.
 */
export function computeServiceCost(serviceJobs?: ServiceJobCostInput[] | null): number {
  if (!Array.isArray(serviceJobs)) return 0;
  return serviceJobs.reduce((sum, serviceJob) => {
    const cost = Number(serviceJob?.job?.costPrice || 0);
    const quantity = Number(serviceJob?.quantity || 0);
    return sum + cost * quantity;
  }, 0);
}

export interface PackageItemCostInput {
  defaultQuantity?: number | string | null;
  service?: { costPrice?: number | string | null } | null;
}

/**
 * Giá vốn gói dịch vụ = Σ (service.costPrice × defaultQuantity).
 * KHÔNG làm tròn — mirror backend `ServicePackageService.recalculatePackagePrice`.
 *
 * Lưu ý: field CHÍNH XÁC của backend là `defaultQuantity` (không phải quantity/amount).
 */
export function computePackagePrice(items?: PackageItemCostInput[] | null): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const cost = Number(item?.service?.costPrice || 0);
    const quantity = Number(item?.defaultQuantity || 0);
    return sum + cost * quantity;
  }, 0);
}

/** Gợi ý đơn vị — `unit` là free-text, backend KHÔNG có enum. */
export const SERVICE_UNIT_SUGGESTIONS = ['Ngày', 'Gói', 'Item', 'Giờ'] as const;

/**
 * Dòng danh mục đã chọn, dùng để đưa vào Báo giá / Cơ hội.
 * `packageName === 'STANDALONE'` + `isPackageService === false` nghĩa là dịch vụ lẻ.
 */
export interface SelectedCatalogItem {
  serviceId: string;
  serviceName: string;
  /** Với dịch vụ lẻ luôn = 1; với gói mẫu giữ nguyên `item.defaultQuantity`. */
  quantity?: number | string | null;
  costPrice: number | string;
  packageName: string;
  servicePackageId: string | null;
  isPackageService: boolean;
}

/** Nhãn quy ước cho dịch vụ chọn lẻ (không thuộc gói mẫu nào). */
export const STANDALONE_PACKAGE_NAME = 'STANDALONE';

/** Shape tối thiểu của một gói mẫu để expand (structural typing — không import runtime). */
export interface PackageTemplateInput {
  id: string;
  name: string;
  items?: PackageTemplateItemInput[] | null;
}

export interface PackageTemplateItemInput {
  serviceId?: string | null;
  defaultQuantity?: number | string | null;
  service?: {
    name?: string | null;
    code?: string | null;
    costPrice?: number | string | null;
  } | null;
}

/**
 * Bung một gói mẫu thành các dòng danh mục đã chọn.
 * Dùng cho tab "Gói dịch vụ" của ServiceSelectorModal.
 */
export function expandPackageTemplate(template: PackageTemplateInput): SelectedCatalogItem[] {
  const items = Array.isArray(template?.items) ? template.items : [];

  return items
    .filter((item): item is PackageTemplateItemInput & { serviceId: string } =>
      Boolean(item?.serviceId),
    )
    .map((item) => ({
      serviceId: item.serviceId,
      serviceName: item.service?.name || item.service?.code || '',
      quantity: item.defaultQuantity,
      costPrice: item.service?.costPrice ?? 0,
      packageName: template.name,
      servicePackageId: template.id,
      isPackageService: true,
    }));
}

/**
 * Chuẩn hóa một dịch vụ lẻ thành dòng danh mục đã chọn.
 */
export function toStandaloneCatalogItem(service: {
  id: string;
  name?: string | null;
  code?: string | null;
  costPrice?: number | string | null;
}): SelectedCatalogItem {
  return {
    serviceId: service.id,
    serviceName: service.name || service.code || '',
    quantity: 1,
    costPrice: service.costPrice ?? 0,
    packageName: STANDALONE_PACKAGE_NAME,
    servicePackageId: null,
    isPackageService: false,
  };
}
