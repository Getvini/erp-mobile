import {
  PARTNER_COMMISSION_STATUS_LABELS,
  PARTNER_TYPE_LABELS,
  computeExpectedCommission,
  getCommissionRateLabel,
  getPartnerTypeLabel,
  sumPartnerCommission,
} from '@/utils/partnerCommission';
import {
  ROUNDING_STEP,
  SERVICE_UNIT_SUGGESTIONS,
  STANDALONE_PACKAGE_NAME,
  computePackagePrice,
  computeServiceCost,
  expandPackageTemplate,
  getMinimumSellingPrice,
  getProfitMargin,
  getRecommendedSellingPrice,
  roundToTenThousands,
  toStandaloneCatalogItem,
} from '@/utils/catalogPricing';

describe('P2 — Hoa hồng đối tác giới thiệu', () => {
  it('cộng dồn hoa hồng theo đúng công thức backend', () => {
    const summary = sumPartnerCommission([
      { partnerCommission: 5_000_000, partnerCommissionStatus: 'PAID' },
      { partnerCommission: 3_000_000, partnerCommissionStatus: 'PENDING' },
      { partnerCommission: '2000000', partnerCommissionStatus: 'PAID' },
      { partnerCommission: 1_000_000, partnerCommissionStatus: 'CANCELLED' },
    ]);

    expect(summary.total).toBe(11_000_000);
    expect(summary.paid).toBe(7_000_000);
    expect(summary.pending).toBe(4_000_000);
    expect(summary.cancelled).toBe(1_000_000);
  });

  it('chấp nhận số dạng chuỗi và giữ nguyên số lẻ, KHÔNG làm tròn', () => {
    const summary = sumPartnerCommission([
      { partnerCommission: '333333.33', partnerCommissionStatus: 'PENDING' },
      { partnerCommission: 666666.67, partnerCommissionStatus: 'PENDING' },
    ]);

    expect(summary.total).toBeCloseTo(1_000_000, 6);
    expect(summary.paid).toBe(0);
    expect(summary.pending).toBeCloseTo(1_000_000, 6);
  });

  it('an toàn với dữ liệu rỗng / thiếu field', () => {
    expect(sumPartnerCommission(undefined)).toEqual({ total: 0, paid: 0, pending: 0, cancelled: 0 });
    expect(sumPartnerCommission(null)).toEqual({ total: 0, paid: 0, pending: 0, cancelled: 0 });
    expect(sumPartnerCommission([])).toEqual({ total: 0, paid: 0, pending: 0, cancelled: 0 });
    expect(
      sumPartnerCommission([{ partnerCommission: null }, {}, null as any]),
    ).toEqual({ total: 0, paid: 0, pending: 0, cancelled: 0 });
  });

  it('hoa hồng dự kiến = doanh thu × % (không làm tròn)', () => {
    expect(computeExpectedCommission(100_000_000, 5)).toBe(5_000_000);
    expect(computeExpectedCommission('200000000', '7.5')).toBe(15_000_000);
    expect(computeExpectedCommission(333.33, 7.5)).toBeCloseTo(24.99975, 5);
    expect(computeExpectedCommission(undefined, 10)).toBe(0);
    expect(computeExpectedCommission(1_000_000, null)).toBe(0);
  });

  it('nhãn tỷ lệ hoa hồng tối đa 2 chữ số thập phân', () => {
    expect(getCommissionRateLabel(5)).toBe('5%');
    expect(getCommissionRateLabel('7.5')).toBe('7.5%');
    expect(getCommissionRateLabel(7.555)).toBe('7.56%');
    expect(getCommissionRateLabel(0)).toBe('0%');
    expect(getCommissionRateLabel('')).toBe('0%');
    expect(getCommissionRateLabel(null)).toBe('0%');
    expect(getCommissionRateLabel(undefined)).toBe('0%');
    expect(getCommissionRateLabel('khong-phai-so')).toBe('0%');
  });

  it('nhãn loại đối tác có fallback về chính giá trị enum', () => {
    expect(getPartnerTypeLabel('BUSINESS')).toBe('Doanh nghiệp');
    expect(getPartnerTypeLabel('INDIVIDUAL')).toBe('Cá nhân');
    expect(getPartnerTypeLabel('KOL')).toBe('KOL');
    expect(getPartnerTypeLabel(undefined)).toBe('');
    expect(PARTNER_TYPE_LABELS.BUSINESS).toBe('Doanh nghiệp');
    expect(PARTNER_COMMISSION_STATUS_LABELS.PAID).toBe('Đã thanh toán');
    expect(PARTNER_COMMISSION_STATUS_LABELS.PENDING).toBe('Chưa thanh toán');
    expect(PARTNER_COMMISSION_STATUS_LABELS.CANCELLED).toBe('Hủy bỏ');
  });
});

describe('P2 — Số học giá niêm yết (dịch vụ & gói)', () => {
  it('quy tắc làm tròn LÊN bội số 10.000 (KHÔNG phải Math.round)', () => {
    expect(ROUNDING_STEP).toBe(10000);
    expect(roundToTenThousands(10_000_000)).toBe(10_000_000);
    expect(roundToTenThousands(10_000_001)).toBe(10_010_000);
    expect(roundToTenThousands(9_999)).toBe(10_000);
    expect(roundToTenThousands(0)).toBe(0);
    // Math.round(10_000_001 / 10000) * 10000 sẽ là 10_000_000 ⇒ khác hẳn.
    expect(roundToTenThousands(10_000_001)).not.toBe(Math.round(10_000_001 / 10000) * 10000);
  });

  it('giá tối thiểu = ceil(cost/0.8), giá đề xuất = ceil(cost/0.6)', () => {
    expect(getMinimumSellingPrice(8_000_000)).toBe(10_000_000);
    expect(getRecommendedSellingPrice(6_000_000)).toBe(10_000_000);
    expect(getMinimumSellingPrice(8_000_001)).toBe(10_010_000);
    expect(getMinimumSellingPrice(0)).toBe(0);
    expect(getMinimumSellingPrice(null)).toBe(0);
  });

  it('biên lợi nhuận giữ nguyên số lẻ', () => {
    expect(getProfitMargin(10_000_000, 8_000_000)).toBe(20);
    expect(getProfitMargin(10_000_000, 6_000_000)).toBe(40);
    expect(getProfitMargin(3_000_000, 1_000_000)).toBeCloseTo(66.6666, 3);
    expect(getProfitMargin(0, 1_000_000)).toBe(0);
    expect(getProfitMargin(null, null)).toBe(0);
  });

  it('giá vốn dịch vụ = Σ(job.costPrice × quantity), không làm tròn', () => {
    expect(
      computeServiceCost([
        { quantity: 2, job: { costPrice: 1_000_000 } },
        { quantity: 3, job: { costPrice: 500_000 } },
      ]),
    ).toBe(3_500_000);

    expect(computeServiceCost([{ quantity: 1.5, job: { costPrice: 333.33 } }])).toBeCloseTo(499.995, 5);
    expect(computeServiceCost([])).toBe(0);
    expect(computeServiceCost(null)).toBe(0);
    expect(computeServiceCost([{ quantity: 2 }, { job: { costPrice: 100 } }])).toBe(0);
  });

  it('giá gói = Σ(service.costPrice × defaultQuantity) — dùng đúng field defaultQuantity', () => {
    expect(
      computePackagePrice([
        { defaultQuantity: 2, service: { costPrice: 1_000_000 } },
        { defaultQuantity: 1, service: { costPrice: 4_500_000 } },
      ]),
    ).toBe(6_500_000);

    // Gửi nhầm field `quantity` (không phải defaultQuantity) ⇒ không được tính.
    expect(computePackagePrice([{ quantity: 3, service: { costPrice: 1_000_000 } } as any])).toBe(0);
    expect(computePackagePrice(undefined)).toBe(0);
  });

  it('bung gói mẫu thành các dòng danh mục đã chọn', () => {
    const items = expandPackageTemplate({
      id: 'pkg-1',
      name: 'Gói Social tháng',
      items: [
        { serviceId: 'sv-1', defaultQuantity: 4, service: { name: 'Thiết kế bài', costPrice: 200_000 } },
        { serviceId: 'sv-2', defaultQuantity: 1, service: { code: 'VIDEO', costPrice: 1_500_000 } },
        { serviceId: null, defaultQuantity: 2, service: { name: 'Bỏ qua vì thiếu serviceId' } },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      serviceId: 'sv-1',
      serviceName: 'Thiết kế bài',
      quantity: 4,
      costPrice: 200_000,
      packageName: 'Gói Social tháng',
      servicePackageId: 'pkg-1',
      isPackageService: true,
    });
    // serviceName fallback sang code khi thiếu name.
    expect(items[1].serviceName).toBe('VIDEO');
    expect(items[1].quantity).toBe(1);
  });

  it('bung gói thiếu items trả mảng rỗng', () => {
    expect(expandPackageTemplate({ id: 'p', name: 'Gói rỗng' })).toEqual([]);
    expect(expandPackageTemplate({ id: 'p', name: 'Gói rỗng', items: null })).toEqual([]);
  });

  it('chuẩn hóa dịch vụ lẻ thành dòng danh mục', () => {
    expect(toStandaloneCatalogItem({ id: 'sv-9', name: 'Chụp ảnh', costPrice: 900_000 })).toEqual({
      serviceId: 'sv-9',
      serviceName: 'Chụp ảnh',
      quantity: 1,
      costPrice: 900_000,
      packageName: STANDALONE_PACKAGE_NAME,
      servicePackageId: null,
      isPackageService: false,
    });
    expect(toStandaloneCatalogItem({ id: 'sv-9', code: 'PHOTO' }).serviceName).toBe('PHOTO');
    expect(toStandaloneCatalogItem({ id: 'sv-9' }).costPrice).toBe(0);
    expect(SERVICE_UNIT_SUGGESTIONS).toEqual(['Ngày', 'Gói', 'Item', 'Giờ']);
  });
});
