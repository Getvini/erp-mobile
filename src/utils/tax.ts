/**
 * Tra cứu thông tin doanh nghiệp theo Mã Số Thuế (MST) qua VietQR API
 * Hỗ trợ MST 10 số hoặc 13 số
 */
export interface TaxInfoResult {
  name: string;
  address: string;
  status?: string;
  internationalName?: string;
  shortName?: string;
  taxDepartment?: string;
}

export const fetchTaxInfo = async (taxId: string): Promise<TaxInfoResult | null> => {
  if (!taxId) return null;

  // Làm sạch mã số thuế: bỏ khoảng trắng và dấu gạch ngang
  const cleanTaxId = taxId.replace(/[\s-]/g, '');

  // Kiểm tra định dạng: 10 chữ số hoặc 13 chữ số
  if (!/^\d{10}(\d{3})?$/.test(cleanTaxId)) {
    return null;
  }

  try {
    const response = await fetch(`https://api.vietqr.io/v2/business/${cleanTaxId}`);
    if (!response.ok) {
      return null;
    }

    const res = await response.json();
    if (res && res.code === '00' && res.data && res.data.name) {
      return {
        name: res.data.name,
        address: res.data.address || '',
        status: res.data.status,
        internationalName: res.data.internationalName || '',
        shortName: res.data.shortName || '',
        taxDepartment: res.data.taxDepartment,
      };
    }
    return null;
  } catch (error) {
    console.log('Error fetching tax info:', error);
    return null;
  }
};
