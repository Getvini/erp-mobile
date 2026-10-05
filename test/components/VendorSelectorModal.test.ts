import { VendorItem, VendorType, VENDOR_TYPE_LABELS } from '../../src/services/vendorService';

describe('VendorSelectorModal Filter and Search Logic', () => {
  const sampleVendors: VendorItem[] = [
    {
      id: 'v-1',
      name: 'Công ty TNHH Media Pro',
      type: 'BUSINESS',
      phone: '0901234567',
      email: 'contact@mediapro.vn',
      taxId: '0101234567',
    },
    {
      id: 'v-2',
      name: 'Nguyễn Văn A (Quay phim)',
      type: 'INDIVIDUAL',
      phone: '0912345678',
      email: 'anguyen@gmail.com',
      taxId: '123456789',
    },
    {
      id: 'v-3',
      name: 'Trần Thị B (KOL Lifestyle)',
      type: 'KOL',
      phone: '0988776655',
      email: 'tranthib@kol.vn',
    },
    {
      id: 'v-4',
      name: 'Lê Hoàng C (KOC Review)',
      type: 'KOC',
      phone: '0977665544',
    },
  ];

  const filterVendors = (
    vendors: VendorItem[],
    searchQuery: string,
    typeFilter: string,
    selectedVendorId: string
  ) => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = vendors.filter((vendor) => {
      if (!vendor?.id) return false;

      if (typeFilter !== 'ALL' && vendor.type !== typeFilter) {
        return false;
      }

      if (q) {
        const nameMatch = (vendor.name || '').toLowerCase().includes(q);
        const phoneMatch = (vendor.phone || '').toLowerCase().includes(q);
        const emailMatch = (vendor.email || '').toLowerCase().includes(q);
        const taxMatch = (vendor.taxId || '').toLowerCase().includes(q);
        const typeLabel = vendor.type
          ? (VENDOR_TYPE_LABELS[vendor.type as VendorType] || '')
          : '';
        const typeMatch = typeLabel.toLowerCase().includes(q);

        if (!nameMatch && !phoneMatch && !emailMatch && !taxMatch && !typeMatch) {
          return false;
        }
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      if (a.id === selectedVendorId) return -1;
      if (b.id === selectedVendorId) return 1;

      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB, 'vi');
    });
  };

  it('filters vendors by name search query', () => {
    const results = filterVendors(sampleVendors, 'Media', 'ALL', '');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('v-1');
  });

  it('filters vendors by phone search query', () => {
    const results = filterVendors(sampleVendors, '098877', 'ALL', '');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('v-3');
  });

  it('filters vendors by tax ID (MST)', () => {
    const results = filterVendors(sampleVendors, '0101234567', 'ALL', '');
    expect(results).toHaveLength(1);
    expect(results[0].name).toContain('Media Pro');
  });

  it('filters vendors by type label search query', () => {
    const results = filterVendors(sampleVendors, 'Doanh nghiệp', 'ALL', '');
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('BUSINESS');
  });

  it('filters vendors by vendor type chip filter', () => {
    const results = filterVendors(sampleVendors, '', 'KOL', '');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('v-3');

    const businessResults = filterVendors(sampleVendors, '', 'BUSINESS', '');
    expect(businessResults).toHaveLength(1);
    expect(businessResults[0].id).toBe('v-1');
  });

  it('places currently selected vendor at the top of the sorted list', () => {
    const results = filterVendors(sampleVendors, '', 'ALL', 'v-4');
    expect(results[0].id).toBe('v-4');
  });
});
