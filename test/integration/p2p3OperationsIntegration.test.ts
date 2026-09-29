import { apiService } from '@/services/api';
import { vendorService } from '@/services/vendorService';
import { referralPartnerService } from '@/services/referralPartnerService';
import { catalogService, buildUniqueServiceCode } from '@/services/catalogService';
import { servicePackageService } from '@/services/servicePackageService';
import { teamService } from '@/services/teamService';
import { userService } from '@/services/userService';
import { jobService } from '@/services/jobService';
import { announcementService } from '@/services/announcementService';
import { documentLibraryService } from '@/services/documentLibraryService';
import {
  canAccessJobs,
  canAccessReferralPartners,
  canAccessServiceCatalog,
  canAccessTeams,
  canAccessUsers,
  canAccessVendors,
  canBulkDeleteServices,
  canManageAnnouncements,
  canManageDocumentLibrary,
} from '@/utils/rbac';

const ok = (data: any) => ({ status: 200, data });

describe('P2 — Vendors: endpoint & payload parity', () => {
  afterEach(() => jest.restoreAllMocks());

  it('danh sách là mảng thô, phòng thủ cả dạng { data }', async () => {
    const spy = jest
      .spyOn(apiService, 'get')
      .mockResolvedValueOnce(ok([{ id: 'v-1' }]))
      .mockResolvedValueOnce(ok({ data: [{ id: 'v-2' }] }));

    const first = await vendorService.getVendors();
    const second = await vendorService.getVendors();

    expect(spy).toHaveBeenNthCalledWith(1, '/vendors');
    expect(first.data).toHaveLength(1);
    expect(second.data).toHaveLength(1);
  });

  it('lấy vendor theo job dùng đúng URL /vendors/by-job/:jobId', async () => {
    const spy = jest.spyOn(apiService, 'get').mockResolvedValue(ok([]));
    await vendorService.getVendorsByJob('job-1');
    expect(spy).toHaveBeenCalledWith('/vendors/by-job/job-1');
  });

  it('tạo vendor LUÔN gửi đủ 10 khoá dạng chuỗi (email/phone/address NOT NULL)', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue(ok({ id: 'v-1' }));

    await vendorService.createVendor({ name: 'Công ty ABC' } as any);

    const body = spy.mock.calls[0][1] as Record<string, unknown>;
    expect(spy.mock.calls[0][0]).toBe('/vendors');
    expect(Object.keys(body).sort()).toEqual(
      [
        'address',
        'bankAccount',
        'bankName',
        'email',
        'idCardBack',
        'idCardFront',
        'name',
        'phone',
        'taxId',
        'type',
      ].sort(),
    );
    expect(body.name).toBe('Công ty ABC');
    expect(body.email).toBe('');
    expect(body.phone).toBe('');
    expect(body.address).toBe('');
    expect(body.type).toBe('BUSINESS');
  });

  it('cập nhật vendor LUÔN kèm type (tránh backend hiểu nhầm CCCD/MST)', async () => {
    const spy = jest.spyOn(apiService, 'patch').mockResolvedValue(ok({ id: 'v-1' }));

    await vendorService.updateVendor({ id: 'v-1', taxId: '0123456789' } as any);

    expect(spy).toHaveBeenCalledWith('/vendors/v-1', expect.objectContaining({ type: 'BUSINESS' }));
  });

  it('gán/gỡ hạng mục vendor dùng đúng URL và body { price, note }', async () => {
    const postSpy = jest.spyOn(apiService, 'post').mockResolvedValue(ok({ id: 'vj-1' }));
    const deleteSpy = jest.spyOn(apiService, 'delete').mockResolvedValue(ok({ message: 'ok' }));

    await vendorService.upsertVendorJob({ id: 'v-1', jobId: 'j-1', price: 1_500_000, note: 'Giá tốt' });
    await vendorService.removeVendorJob({ id: 'v-1', jobId: 'j-1' });

    expect(postSpy).toHaveBeenCalledWith('/vendors/v-1/jobs/j-1', {
      price: 1_500_000,
      note: 'Giá tốt',
    });
    expect(deleteSpy).toHaveBeenCalledWith('/vendors/v-1/jobs/j-1');
  });

  it('xóa vendor dùng DELETE /vendors/:id', async () => {
    const spy = jest.spyOn(apiService, 'delete').mockResolvedValue(ok({ message: 'Xóa nhà cung cấp thành công' }));
    await vendorService.deleteVendor('v-1');
    expect(spy).toHaveBeenCalledWith('/vendors/v-1');
  });
});

describe('P2 — Referral Partners: endpoint & payload parity', () => {
  afterEach(() => jest.restoreAllMocks());

  it('danh sách/chi tiết/thống kê dùng đúng URL, danh sách là mảng thô', async () => {
    const spy = jest
      .spyOn(apiService, 'get')
      .mockResolvedValueOnce(ok([{ id: 'p-1' }]))
      .mockResolvedValueOnce(ok({ id: 'p-1' }))
      .mockResolvedValueOnce(ok({ totalCommission: 5_000_000 }));

    const list = await referralPartnerService.getReferralPartners();
    await referralPartnerService.getReferralPartner('p-1');
    const stats = await referralPartnerService.getReferralPartnerStatistics('p-1');

    expect(spy).toHaveBeenNthCalledWith(1, '/referral-partners');
    expect(spy).toHaveBeenNthCalledWith(2, '/referral-partners/p-1');
    expect(spy).toHaveBeenNthCalledWith(3, '/referral-partners/p-1/statistics');
    expect(list.data).toHaveLength(1);
    expect(stats.data?.totalCommission).toBe(5_000_000);
  });

  it('cập nhật đối tác dùng PUT và gửi đủ 6 field', async () => {
    const spy = jest.spyOn(apiService, 'put').mockResolvedValue(ok({ id: 'p-1' }));

    await referralPartnerService.updateReferralPartner({
      id: 'p-1',
      name: 'CTV A',
      email: 'a@x.vn',
      phone: '0912345678',
      address: 'HN',
      taxId: '0123456789',
      type: 'INDIVIDUAL',
    } as any);

    expect(spy).toHaveBeenCalledWith('/referral-partners/p-1', {
      name: 'CTV A',
      email: 'a@x.vn',
      phone: '0912345678',
      address: 'HN',
      taxId: '0123456789',
      type: 'INDIVIDUAL',
    });
  });

  it('xóa đối tác dùng DELETE /referral-partners/:id', async () => {
    const spy = jest.spyOn(apiService, 'delete').mockResolvedValue(ok({ message: 'ok' }));
    await referralPartnerService.deleteReferralPartner('p-1');
    expect(spy).toHaveBeenCalledWith('/referral-partners/p-1');
  });
});

describe('P2 — Services & Service Packages: endpoint & payload parity', () => {
  afterEach(() => jest.restoreAllMocks());

  it('GET /services trả envelope { data, meta } và được chuẩn hoá', async () => {
    const spy = jest.spyOn(apiService, 'get').mockResolvedValue(
      ok({ data: [{ id: 's-1' }], meta: { total: 1, page: 1, limit: 1000, totalPages: 1 } }),
    );

    const result = await catalogService.getServices();

    expect(spy.mock.calls[0][0]).toBe('/services');
    expect(result.data).toHaveLength(1);
    expect(result.meta?.total).toBe(1);
  });

  it('tạo dịch vụ KHÔNG gửi costPrice/overheadCost (backend tự tính)', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue(ok({ id: 's-1' }));

    await catalogService.createService({
      name: 'Dịch vụ A',
      code: 'SVC-A',
      jobIds: ['j-1'],
      outputJobIds: [],
    } as any);

    const body = spy.mock.calls[0][1] as Record<string, unknown>;
    expect(spy.mock.calls[0][0]).toBe('/services');
    expect(body).not.toHaveProperty('costPrice');
    expect(body).not.toHaveProperty('overheadCost');
  });

  it('xóa hàng loạt dùng DELETE /services/bulk kèm body { ids }', async () => {
    const spy = jest
      .spyOn(apiService, 'request')
      .mockResolvedValue(ok({ message: 'ok' }) as any)
      .mockName('request');

    // apiService.delete không hỗ trợ body ⇒ service phải dùng request(...) với method DELETE.
    await catalogService.bulkDeleteServices(['s-1', 's-2']);

    expect(spy).toHaveBeenCalledWith(
      '/services/bulk',
      expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ ids: ['s-1', 's-2'] }) }),
    );
  });

  it('thêm/gỡ hạng mục dịch vụ dùng đúng URL', async () => {
    const postSpy = jest.spyOn(apiService, 'post').mockResolvedValue(ok({ id: 's-1' }));
    const deleteSpy = jest.spyOn(apiService, 'delete').mockResolvedValue(ok({ id: 's-1' }));

    await catalogService.addServiceJob({ id: 's-1', jobId: 'j-1' });
    await catalogService.removeServiceJob({ id: 's-1', jobId: 'j-1' });

    expect(postSpy.mock.calls[0][0]).toBe('/services/s-1/jobs/j-1');
    expect(deleteSpy).toHaveBeenCalledWith('/services/s-1/jobs/j-1');
  });

  it('nhân bản dịch vụ sinh mã duy nhất thay vì giữ mã gốc (backend chặn trùng)', () => {
    expect(buildUniqueServiceCode('SVC-A', [])).toBe('SVC-A-COPY');
    expect(buildUniqueServiceCode('SVC-A', ['svc-a-copy'])).toBe('SVC-A-COPY2');
    expect(buildUniqueServiceCode('SVC-A', ['SVC-A-COPY', ' svc-a-copy2 '])).toBe('SVC-A-COPY3');
    expect(buildUniqueServiceCode('', ['x'])).toBeUndefined();
    expect(buildUniqueServiceCode(null, [])).toBeUndefined();
  });

  it('nhân bản gửi POST /services với mã mới và tên có hậu tố (Copy)', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue(ok({ id: 's-2' }));

    await catalogService.duplicateService(
      { id: 's-1', name: 'Dịch vụ A', code: 'SVC-A', serviceJobs: [{ jobId: 'j-1', isOutput: true }] } as any,
      ['SVC-A'],
    );

    const body = spy.mock.calls[0][1] as Record<string, unknown>;
    expect(body.name).toBe('Dịch vụ A (Copy)');
    expect(body.code).toBe('SVC-A-COPY');
    expect(body.outputJobIds).toEqual(['j-1']);
  });

  it('gói dịch vụ: danh sách mảng thô, tạo POST có items defaultQuantity', async () => {
    const getSpy = jest
      .spyOn(apiService, 'get')
      .mockResolvedValueOnce(ok([{ id: 'pkg-1' }]))
      .mockResolvedValueOnce(ok({ data: [{ id: 'pkg-2' }] }));
    const postSpy = jest.spyOn(apiService, 'post').mockResolvedValue(ok({ id: 'pkg-1' }));

    const raw = await servicePackageService.getServicePackages();
    await servicePackageService.createServicePackage({
      name: 'Gói A',
      description: 'Mô tả',
      items: [{ serviceId: 's-1', defaultQuantity: 2 }],
    } as any);

    expect(raw.data).toHaveLength(1);
    expect(getSpy.mock.calls[0][0]).toBe('/service-packages');
    expect(postSpy).toHaveBeenCalledWith('/service-packages', {
      name: 'Gói A',
      description: 'Mô tả',
      items: [{ serviceId: 's-1', defaultQuantity: 2 }],
    });
  });

  it('gói dịch vụ: cập nhật dùng PUT (không phải PATCH)', async () => {
    const spy = jest.spyOn(apiService, 'put').mockResolvedValue(ok({ id: 'pkg-1' }));

    await servicePackageService.updateServicePackage({
      id: 'pkg-1',
      name: 'Gói A',
      description: '',
      isActive: true,
      items: [{ serviceId: 's-1', defaultQuantity: 1 }],
    } as any);

    expect(spy).toHaveBeenCalledWith('/service-packages/pkg-1', expect.objectContaining({ isActive: true }));
  });
});

describe('P3 — Users: endpoint & payload parity', () => {
  afterEach(() => jest.restoreAllMocks());

  it('GET /users chỉ gửi role/month/year và trả mảng thô', async () => {
    const spy = jest.spyOn(apiService, 'get').mockResolvedValue(ok([{ id: 'u-1' }]));

    const result = await userService.getUsers({ role: 'PM', month: 9, year: 2026 });

    expect(spy.mock.calls[0][0]).toBe('/users');
    expect(spy.mock.calls[0][1]).toEqual({ role: 'PM', month: 9, year: 2026 });
    expect(result.data).toHaveLength(1);
  });

  it('tạo user gửi đúng payload tối thiểu', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue(ok({ message: 'Tạo người dùng thành công' }));

    await userService.createUser({
      username: 'nhanvien.a',
      password: 'Secret123',
      fullName: 'Nguyễn Văn A',
      role: 'STAFF_A',
    } as any);

    expect(spy).toHaveBeenCalledWith('/users', {
      username: 'nhanvien.a',
      password: 'Secret123',
      fullName: 'Nguyễn Văn A',
      role: 'STAFF_A',
    });
  });

  it('đổi vai trò dùng PUT /users/:id (KHÔNG có PATCH /users/:id/role)', async () => {
    const putSpy = jest.spyOn(apiService, 'put').mockResolvedValue(ok({ id: 'u-1' }));
    const patchSpy = jest.spyOn(apiService, 'patch').mockResolvedValue(ok({ id: 'u-1' }));

    await userService.updateUser({ id: 'u-1', role: 'PM' } as any);

    expect(putSpy).toHaveBeenCalledWith('/users/u-1', { role: 'PM' });
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it('hợp đồng lao động dùng PATCH /users/:id/labor-contracts (không multipart)', async () => {
    const spy = jest.spyOn(apiService, 'patch').mockResolvedValue(ok({ id: 'u-1' }));

    await userService.updateUserLaborContracts({
      id: 'u-1',
      laborContract: [{ name: 'hd.pdf', url: 'https://cdn/hd.pdf' }],
    } as any);

    expect(spy).toHaveBeenCalledWith('/users/u-1/labor-contracts', {
      laborContract: [{ name: 'hd.pdf', url: 'https://cdn/hd.pdf' }],
    });
  });

  it('xóa user dùng DELETE /users/:id', async () => {
    const spy = jest.spyOn(apiService, 'delete').mockResolvedValue(ok({ message: 'Xóa người dùng thành công' }));
    await userService.deleteUser('u-1');
    expect(spy).toHaveBeenCalledWith('/users/u-1');
  });
});

describe('P3 — Teams: endpoint & payload parity', () => {
  afterEach(() => jest.restoreAllMocks());

  it('danh sách team là mảng thô', async () => {
    const spy = jest.spyOn(apiService, 'get').mockResolvedValue(ok([{ id: 't-1' }]));
    const result = await teamService.getTeams();
    expect(spy.mock.calls[0][0]).toBe('/teams');
    expect(result.data).toHaveLength(1);
  });

  it('tạo team BẮT BUỘC kèm teamLeadId', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue(ok({ id: 't-1' }));

    await teamService.createTeam({ name: 'Đội A', teamLeadId: 'u-1' } as any);

    expect(spy).toHaveBeenCalledWith('/teams', { name: 'Đội A', teamLeadId: 'u-1' });
  });

  it('đổi Team Lead dùng PUT /teams/:id/lead với body { newLeadId }', async () => {
    const spy = jest.spyOn(apiService, 'put').mockResolvedValue(ok({ id: 't-1' }));

    await teamService.changeTeamLead({ id: 't-1', newLeadId: 'u-2' } as any);

    expect(spy).toHaveBeenCalledWith('/teams/t-1/lead', { newLeadId: 'u-2' });
  });

  it('thêm thành viên gửi roles dạng MẢNG', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue(ok({ id: 'm-1' }));

    await teamService.addTeamMembers({ id: 't-1', userId: 'u-3', roles: ['EDITOR', 'ACCOUNT'] } as any);

    expect(spy).toHaveBeenCalledWith('/teams/t-1/members', {
      userId: 'u-3',
      roles: ['EDITOR', 'ACCOUNT'],
    });
  });

  it('cập nhật vai trò thành viên dùng PUT .../members/:userId/roles với mảng roles', async () => {
    const spy = jest.spyOn(apiService, 'put').mockResolvedValue(ok([{ id: 'm-1' }]));

    await teamService.updateMemberRoles({ id: 't-1', userId: 'u-3', roles: ['ACCOUNT'] } as any);

    expect(spy).toHaveBeenCalledWith('/teams/t-1/members/u-3/roles', { roles: ['ACCOUNT'] });
  });

  it('gỡ thành viên dùng DELETE /teams/members/:memberId', async () => {
    const spy = jest.spyOn(apiService, 'delete').mockResolvedValue(ok({ message: 'Xóa thành viên thành công' }));
    await teamService.removeTeamMemberById('m-1');
    expect(spy).toHaveBeenCalledWith('/teams/members/m-1');
  });
});

describe('P3 — Jobs & Job Criteria: endpoint & payload parity', () => {
  afterEach(() => jest.restoreAllMocks());

  it('danh sách hạng mục là mảng thô; chi tiết trả object', async () => {
    const spy = jest
      .spyOn(apiService, 'get')
      .mockResolvedValueOnce(ok([{ id: 'j-1' }]))
      .mockResolvedValueOnce(ok({ id: 'j-1', name: 'Quay phim' }));

    const list = await jobService.getJobs();
    const detail = await jobService.getJob('j-1');

    expect(list.data).toHaveLength(1);
    expect(detail.data?.name).toBe('Quay phim');
  });

  it('tạo hạng mục dùng POST /jobs', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue(ok({ id: 'j-1' }));

    await jobService.createJob({ name: 'Quay phim', code: 'JOB-QP' } as any);

    expect(spy.mock.calls[0][0]).toBe('/jobs');
  });

  it('đồng bộ tiêu chí dùng PUT /job-criteria/job/:jobId với body là MẢNG TRẦN', async () => {
    const spy = jest.spyOn(apiService, 'put').mockResolvedValue(ok([{ id: 'c-1' }]));

    await jobService.syncJobCriterias({
      jobId: 'j-1',
      criteria: [
        { id: 'c-1', name: 'Đúng brief' },
        { name: 'Đúng deadline' },
      ],
    });

    const [url, body] = spy.mock.calls[0];
    expect(url).toBe('/job-criteria/job/j-1');
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual(expect.objectContaining({ name: 'Đúng brief' }));
    expect(body[1]).toEqual(expect.objectContaining({ name: 'Đúng deadline' }));
  });

  it('xóa hạng mục dùng DELETE /jobs/:id', async () => {
    const spy = jest.spyOn(apiService, 'delete').mockResolvedValue(ok({ message: 'ok' }));
    await jobService.deleteJob('j-1');
    expect(spy).toHaveBeenCalledWith('/jobs/j-1');
  });
});

describe('P3 — Announcements: endpoint & payload parity', () => {
  afterEach(() => jest.restoreAllMocks());

  it('danh sách phân trang dạng { data, total, page, limit, totalPages }', async () => {
    const spy = jest
      .spyOn(apiService, 'get')
      .mockResolvedValue(ok({ data: [{ id: 'a-1', isRead: false }], total: 1, page: 1, limit: 10, totalPages: 1 }));

    const result = await announcementService.getAnnouncements({ page: 1, limit: 10, status: 'SENT' });

    expect(spy.mock.calls[0][0]).toBe('/announcements');
    // Service bọc kết quả phân trang trong `data` (giữ nguyên shape backend, KHÔNG phải {data,meta}).
    expect(result.data?.data).toHaveLength(1);
    expect(result.data?.total).toBe(1);
    expect(result.data?.totalPages).toBe(1);
  });

  it('đánh dấu đã đọc coi body rỗng là thành công', async () => {
    const spy = jest.spyOn(apiService, 'put').mockResolvedValue(ok(null));

    const result = await announcementService.markAnnouncementAsRead('a-1');

    expect(spy).toHaveBeenCalledWith('/announcements/a-1/read');
    expect(result.error).toBeUndefined();
  });

  it('bình luận: thêm và xoá đúng URL/body', async () => {
    const postSpy = jest.spyOn(apiService, 'post').mockResolvedValue(ok({ id: 'cm-1' }));
    const deleteSpy = jest.spyOn(apiService, 'delete').mockResolvedValue(ok({ success: true }));

    await announcementService.addAnnouncementComment({ id: 'a-1', content: 'Nội dung bình luận' });
    await announcementService.deleteAnnouncementComment({ id: 'a-1', commentId: 'cm-1' });

    expect(postSpy).toHaveBeenCalledWith('/announcements/a-1/comments', { content: 'Nội dung bình luận' });
    expect(deleteSpy).toHaveBeenCalledWith('/announcements/a-1/comments/cm-1');
  });

  it('xóa thông báo chuẩn hoá 2 nhánh: đã gửi (huỷ mềm) vs nháp (xoá thật)', async () => {
    const spy = jest
      .spyOn(apiService, 'delete')
      .mockResolvedValueOnce(ok({ id: 'a-1', status: 'CANCELLED' }))
      .mockResolvedValueOnce(ok({ success: true }));

    const cancelled = await announcementService.deleteAnnouncement('a-1');
    const deleted = await announcementService.deleteAnnouncement('a-2');

    expect(cancelled.data?.kind).toBe('cancelled');
    expect(deleted.data?.kind).toBe('deleted');
  });
});

describe('P3 — Document Library: endpoint & payload parity', () => {
  afterEach(() => jest.restoreAllMocks());

  it('danh sách/tags/versions đúng URL và là mảng thô', async () => {
    const spy = jest
      .spyOn(apiService, 'get')
      .mockResolvedValueOnce(ok([{ id: 'd-1' }]))
      .mockResolvedValueOnce(ok(['hr', 'policy']))
      .mockResolvedValueOnce(ok([{ id: 'ver-1' }]));

    const list = await documentLibraryService.getDocuments({ category: 'pdf' });
    const tags = await documentLibraryService.getDocumentTags();
    const versions = await documentLibraryService.getDocumentVersions('d-1');

    expect(spy.mock.calls[0][0]).toBe('/document-library');
    expect(spy.mock.calls[1][0]).toBe('/document-library/tags');
    expect(spy.mock.calls[2][0]).toBe('/document-library/d-1/versions');
    expect(list.data).toHaveLength(1);
    expect(tags.data).toEqual(['hr', 'policy']);
    expect(versions.data).toHaveLength(1);
  });

  it('endpoint download trả JSON { downloadUrl } (không stream file)', async () => {
    const spy = jest.spyOn(apiService, 'get').mockResolvedValue(ok({ downloadUrl: 'https://cdn/file.pdf' }));

    const result = await documentLibraryService.getDocumentDownloadUrl('d-1');

    expect(spy).toHaveBeenCalledWith('/document-library/d-1/download');
    expect(result.data?.downloadUrl).toBe('https://cdn/file.pdf');
  });

  it('upload dùng multipart field "file" + displayName + tags JSON string', async () => {
    const spy = jest.spyOn(apiService, 'postForm').mockResolvedValue(ok({ id: 'd-1' }));

    await documentLibraryService.uploadDocument({
      file: { uri: 'file://a.pdf', name: 'a.pdf', type: 'application/pdf' },
      displayName: 'Biểu mẫu A',
      description: 'Mô tả A',
      tags: ['hr', 'policy'],
    } as any);

    expect(spy.mock.calls[0][0]).toBe('/document-library/upload');
    const formData = spy.mock.calls[0][1] as FormData;
    expect(formData.get('displayName')).toBe('Biểu mẫu A');
    expect(formData.get('description')).toBe('Mô tả A');
    expect(formData.get('tags')).toBe(JSON.stringify(['hr', 'policy']));
    expect(formData.get('file')).toBeTruthy();
  });

  it('upload phiên bản mới chỉ gửi field file', async () => {
    const spy = jest.spyOn(apiService, 'postForm').mockResolvedValue(ok({ id: 'd-1' }));

    await documentLibraryService.uploadDocumentVersion({
      id: 'd-1',
      file: { uri: 'file://b.pdf', name: 'b.pdf', type: 'application/pdf' },
    } as any);

    expect(spy.mock.calls[0][0]).toBe('/document-library/d-1/versions');
    const formData = spy.mock.calls[0][1] as FormData;
    expect(formData.get('displayName')).toBeNull();
    expect(formData.get('file')).toBeTruthy();
  });

  it('khôi phục phiên bản dùng POST không body (tạo version mới, không rollback)', async () => {
    const spy = jest.spyOn(apiService, 'post').mockResolvedValue(ok({ id: 'd-1' }));

    await documentLibraryService.restoreDocumentVersion({ id: 'd-1', versionId: 'ver-1' } as any);

    const [url, body] = spy.mock.calls[0];
    expect(url).toBe('/document-library/d-1/versions/ver-1/restore');
    expect(body === undefined || body === null || Object.keys(body as object).length === 0).toBe(true);
  });

  it('cập nhật và xoá tài liệu đúng URL/method', async () => {
    const putSpy = jest.spyOn(apiService, 'put').mockResolvedValue(ok({ id: 'd-1' }));
    const deleteSpy = jest.spyOn(apiService, 'delete').mockResolvedValue(ok({ message: 'ok' }));

    await documentLibraryService.updateDocument({ id: 'd-1', displayName: 'Tên mới' } as any);
    await documentLibraryService.deleteDocument('d-1');

    expect(putSpy).toHaveBeenCalledWith('/document-library/d-1', expect.objectContaining({ displayName: 'Tên mới' }));
    expect(deleteSpy).toHaveBeenCalledWith('/document-library/d-1');
  });
});

describe('P2/P3 — RBAC theo Sidebar & route backend', () => {
  it('Vendors & Users chỉ ADMIN/BOD', () => {
    ['ADMIN', 'BOD'].forEach((role) => {
      expect(canAccessVendors(role)).toBe(true);
      expect(canAccessUsers(role)).toBe(true);
    });
    ['BD', 'PM', 'ADMIN_SALE', 'STAFF_A'].forEach((role) => {
      expect(canAccessVendors(role)).toBe(false);
      expect(canAccessUsers(role)).toBe(false);
    });
    expect(canAccessVendors(undefined)).toBe(false);
  });

  it('Referral Partners & Catalog cho Kinh doanh, Teams & Jobs thêm PM', () => {
    ['ADMIN', 'BOD', 'BD', 'ADMIN_SALE'].forEach((role) => {
      expect(canAccessReferralPartners(role)).toBe(true);
      expect(canAccessServiceCatalog(role)).toBe(true);
    });
    expect(canAccessReferralPartners('PM')).toBe(false);
    expect(canAccessServiceCatalog('PM')).toBe(false);

    ['ADMIN', 'BOD', 'BD', 'ADMIN_SALE', 'PM'].forEach((role) => {
      expect(canAccessTeams(role)).toBe(true);
      expect(canAccessJobs(role)).toBe(true);
    });
    expect(canAccessTeams('STAFF_B')).toBe(false);
  });

  it('xóa hàng loạt dịch vụ chỉ ADMIN/BOD (Service.Route.ts roleMiddleware)', () => {
    expect(canBulkDeleteServices('ADMIN')).toBe(true);
    expect(canBulkDeleteServices('BOD')).toBe(true);
    expect(canBulkDeleteServices('BD')).toBe(false);
    expect(canBulkDeleteServices('ADMIN_SALE')).toBe(false);
  });

  it('quản lý bảng tin BOD/ADMIN/PM; quản lý tài liệu BOD/ADMIN/ADMIN_SALE', () => {
    expect(canManageAnnouncements('PM')).toBe(true);
    expect(canManageAnnouncements('BOD')).toBe(true);
    expect(canManageAnnouncements('BD')).toBe(false);

    expect(canManageDocumentLibrary('ADMIN_SALE')).toBe(true);
    expect(canManageDocumentLibrary('BOD')).toBe(true);
    expect(canManageDocumentLibrary('PM')).toBe(false);
  });
});
