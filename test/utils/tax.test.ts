import { fetchTaxInfo } from '@/utils/tax';

describe('fetchTaxInfo (VietQR API)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('trả về null nếu taxId rỗng hoặc falsy', async () => {
    expect(await fetchTaxInfo('')).toBeNull();
    expect(await fetchTaxInfo(null as any)).toBeNull();
    expect(await fetchTaxInfo(undefined as any)).toBeNull();
  });

  it('trả về null nếu định dạng taxId không hợp lệ (< 10 số hoặc chứa chữ)', async () => {
    expect(await fetchTaxInfo('12345')).toBeNull();
    expect(await fetchTaxInfo('012345678A')).toBeNull();
    expect(await fetchTaxInfo('01234567891')).toBeNull(); // 11 chữ số
    expect(await fetchTaxInfo('012345678912')).toBeNull(); // 12 chữ số
  });

  it('gọi đúng VietQR API và parse dữ liệu thành công cho MST 10 số', async () => {
    const mockResponse = {
      code: '00',
      desc: 'Success',
      data: {
        id: '0101234567',
        name: 'CÔNG TY TNHH GETVINI MEDIA',
        address: 'Số 123 Đường ABC, Quận Cầu Giấy, Hà Nội',
        status: 'Đang hoạt động',
        internationalName: 'GETVINI MEDIA COMPANY LIMITED',
        shortName: 'GETVINI MEDIA',
      },
    };

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await fetchTaxInfo('0101234567');
    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.vietqr.io/v2/business/0101234567');
    expect(result).toEqual({
      name: 'CÔNG TY TNHH GETVINI MEDIA',
      address: 'Số 123 Đường ABC, Quận Cầu Giấy, Hà Nội',
      status: 'Đang hoạt động',
      internationalName: 'GETVINI MEDIA COMPANY LIMITED',
      shortName: 'GETVINI MEDIA',
      taxDepartment: undefined,
    });
  });

  it('hỗ trợ MST 13 số có gạch ngang và tự làm sạch khi gửi API', async () => {
    const mockResponse = {
      code: '00',
      data: {
        name: 'CHI NHÁNH CÔNG TY GETVINI TẠI TP.HCM',
        address: 'Quận 1, TP Hồ Chí Minh',
      },
    };

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const result = await fetchTaxInfo('0101234567-001');
    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.vietqr.io/v2/business/0101234567001');
    expect(result).toEqual({
      name: 'CHI NHÁNH CÔNG TY GETVINI TẠI TP.HCM',
      address: 'Quận 1, TP Hồ Chí Minh',
      status: undefined,
      internationalName: '',
      shortName: '',
      taxDepartment: undefined,
    });
  });

  it('trả về null nếu response.ok là false (404 / 500)', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await fetchTaxInfo('0101234567');
    expect(result).toBeNull();
  });

  it('trả về null nếu API trả về code khác 00 hoặc không có data.name', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ code: '51', desc: 'Mã số thuế không tồn tại' }),
    });

    const result = await fetchTaxInfo('0101234567');
    expect(result).toBeNull();
  });

  it('bắt ngoại lệ mạng an toàn và trả về null không làm crash ứng dụng', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

    const result = await fetchTaxInfo('0101234567');
    expect(result).toBeNull();
  });
});
