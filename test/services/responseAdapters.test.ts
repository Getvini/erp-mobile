import { normalizeTaskListResponse } from '@/services/responseAdapters';

const task = {
  id: 'task-1',
  name: 'Duyệt nội dung',
  status: 'AWAITING_REVIEW',
};

describe('normalizeTaskListResponse', () => {
  it('lấy danh sách task từ response phân trang của API', () => {
    expect(
      normalizeTaskListResponse({
        data: [task],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      })
    ).toEqual([task]);
  });

  it('giữ tương thích với response mảng legacy', () => {
    expect(normalizeTaskListResponse([task])).toEqual([task]);
  });

  it.each([undefined, null, {}, { data: null }, { data: {} }])(
    'trả về mảng rỗng cho response không hợp lệ: %p',
    (response) => {
      expect(normalizeTaskListResponse(response)).toEqual([]);
    }
  );
});
