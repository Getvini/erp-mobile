import {
  ALL_MEMBER_ROLES,
  ASSIGNABLE_MEMBER_ROLES,
  TEAM_MEMBER_ROLE_LABELS,
  canRemoveAccountRole,
  canRemoveMember,
  countAccountMembers,
  normalizeRoles,
  validateMemberRoles,
} from '@/utils/teamMemberRoles';
import {
  decodeHtmlEntities,
  extractMediaFromHtml,
  htmlToPlainText,
  parseRichTextBlocks,
  truncatePlainText,
} from '@/utils/htmlText';
import {
  DOCUMENT_CATEGORY_LABELS,
  buildDocumentQueryParams,
  formatFileSize,
  formatTagsInput,
  getDocumentCategory,
  getDocumentCategoryLabel,
  getNextVersionNumber,
  getUploaderName,
  hasActiveDocumentFilters,
  isPreviewableInApp,
  normalizeFileExtension,
  parseTagsInput,
} from '@/utils/documentLibrary';

const member = (id: string, roles: unknown) => ({ id: `m-${id}`, user: { id }, roles });

describe('P3 — Vai trò thành viên đội dự án', () => {
  it('có đúng 9 vai trò, và PROJECT_MANAGER không gán được qua endpoint member', () => {
    expect(ALL_MEMBER_ROLES).toHaveLength(9);
    expect(ASSIGNABLE_MEMBER_ROLES).toHaveLength(8);
    expect(ASSIGNABLE_MEMBER_ROLES).not.toContain('PROJECT_MANAGER');
    expect(ASSIGNABLE_MEMBER_ROLES).toContain('ACCOUNT');
    expect(TEAM_MEMBER_ROLE_LABELS.ACCOUNT).toBe('Account');
    expect(TEAM_MEMBER_ROLE_LABELS.PROJECT_MANAGER).toBe('Quản lý dự án');
  });

  it('chuẩn hóa mọi dạng roles về mảng string không trùng', () => {
    expect(normalizeRoles(['EDITOR', 'EDITOR', ' ACCOUNT '])).toEqual(['EDITOR', 'ACCOUNT']);
    expect(normalizeRoles([{ role: 'ACCOUNT' }, { role: 'EDITOR' }])).toEqual(['ACCOUNT', 'EDITOR']);
    expect(normalizeRoles('EDITOR')).toEqual(['EDITOR']);
    expect(normalizeRoles({ role: 'ACCOUNT' })).toEqual(['ACCOUNT']);
    expect(normalizeRoles(null)).toEqual([]);
    expect(normalizeRoles(undefined)).toEqual([]);
    expect(normalizeRoles([null, 5, {}, { role: 7 }])).toEqual([]);
  });

  it('đếm thành viên giữ vai trò Account (có loại trừ chính mình)', () => {
    const members = [
      member('u1', ['ACCOUNT', 'EDITOR']),
      member('u2', ['EDITOR']),
      member('u3', { role: 'ACCOUNT' }),
    ];

    expect(countAccountMembers(members)).toBe(2);
    expect(countAccountMembers(members, 'u1')).toBe(1);
    expect(countAccountMembers(members, 'u3')).toBe(1);
    expect(countAccountMembers([])).toBe(0);
    expect(countAccountMembers(null)).toBe(0);
  });

  it('chặn bỏ vai trò ACCOUNT khi đội chỉ còn 1 Account', () => {
    const soleAccount = [member('u1', ['ACCOUNT']), member('u2', ['EDITOR'])];
    expect(canRemoveAccountRole(soleAccount, 'u1')).toBe(false);

    const twoAccounts = [member('u1', ['ACCOUNT']), member('u2', ['ACCOUNT'])];
    expect(canRemoveAccountRole(twoAccounts, 'u1')).toBe(true);

    // Thành viên không giữ ACCOUNT luôn được bỏ vai trò.
    expect(canRemoveAccountRole(soleAccount, 'u2')).toBe(true);
    // Không tìm thấy thành viên ⇒ không chặn.
    expect(canRemoveAccountRole(soleAccount, 'u9')).toBe(true);
  });

  it('quyết định gỡ thành viên khỏi đội', () => {
    const members = [member('lead-1', ['ACCOUNT']), member('u2', ['EDITOR'])];

    const leadResult = canRemoveMember(members, members[0], 'lead-1');
    expect(leadResult.allowed).toBe(false);
    expect(leadResult.message).toContain('Team Lead');

    const soleAccount = canRemoveMember(
      [member('u1', ['ACCOUNT'])],
      member('u1', ['ACCOUNT']),
      undefined,
    );
    expect(soleAccount.allowed).toBe(false);
    expect(soleAccount.message).toContain('ít nhất 1 nhân sự giữ vai trò Account');

    expect(canRemoveMember(members, members[1], 'lead-1')).toEqual({ allowed: true });
    expect(canRemoveMember(members, null, 'lead-1').allowed).toBe(false);
  });

  it('validate danh sách vai trò trước khi gửi API', () => {
    expect(validateMemberRoles(['EDITOR'])).toEqual({ valid: true });
    expect(validateMemberRoles([]).valid).toBe(false);
    expect(validateMemberRoles([]).message).toBe('Nhân sự phải có ít nhất một vai trò');
    expect(validateMemberRoles(['KHONG_TON_TAI']).message).toBe('Vai trò không hợp lệ');
    // PROJECT_MANAGER là vai trò hợp lệ của enum nhưng vẫn qua được validate (backend chặn ở endpoint member).
    expect(validateMemberRoles(['PROJECT_MANAGER']).valid).toBe(true);
  });
});

describe('P3 — Tiện ích HTML cho bảng tin', () => {
  it('giải mã entity phổ biến gồm dạng thập phân và hex', () => {
    expect(decodeHtmlEntities('A&nbsp;B &amp; C &lt;tag&gt; &quot;x&quot; &#39;y&#39;')).toBe(
      'A B & C <tag> "x" \'y\'',
    );
    expect(decodeHtmlEntities('&#233;')).toBe('é');
    expect(decodeHtmlEntities('&#xE9;')).toBe('é');
    expect(decodeHtmlEntities('&khongton;')).toBe('&khongton;');
    expect(decodeHtmlEntities(undefined)).toBe('');
  });

  it('HTML → plain text, giữ xuống dòng giữa các khối và gộp khoảng trắng', () => {
    expect(htmlToPlainText('<p>Xin <strong>chào</strong></p><p>Dòng 2</p>')).toBe(
      'Xin chào\nDòng 2',
    );
    expect(htmlToPlainText('<div>A</div><div>B</div>')).toBe('A\nB');
    expect(htmlToPlainText('Dòng 1<br/>Dòng 2')).toBe('Dòng 1\nDòng 2');
    expect(htmlToPlainText('<p>Nhiều    khoảng   trắng</p>')).toBe('Nhiều khoảng trắng');
    expect(htmlToPlainText('<!-- chú thích --><p>Nội dung</p>')).toBe('Nội dung');
    expect(htmlToPlainText('')).toBe('');
    expect(htmlToPlainText(undefined)).toBe('');
  });

  it('trích ảnh/video trong HTML, loại trùng URL', () => {
    const html = `
      <p>Nội dung</p>
      <img src="https://cdn/a.png" />
      <img src="https://cdn/a.png" />
      <img src="https://cdn/b.png" data-media-type="video" />
      <video src="https://cdn/c.mp4"></video>
    `;

    const media = extractMediaFromHtml(html);
    expect(media).toEqual([
      { url: 'https://cdn/a.png', type: 'image' },
      { url: 'https://cdn/b.png', type: 'video' },
      { url: 'https://cdn/c.mp4', type: 'video' },
    ]);
    expect(extractMediaFromHtml(undefined)).toEqual([]);
    expect(extractMediaFromHtml('<img />')).toEqual([]);
  });

  it('tách HTML thành các block để render', () => {
    const blocks = parseRichTextBlocks(
      '<h2>Tiêu đề</h2><p>Đoạn <strong>đậm</strong></p><ul><li>Mục 1</li><li>Mục 2</li></ul><blockquote>Trích dẫn</blockquote>',
    );

    expect(blocks).toEqual([
      { type: 'heading', text: 'Tiêu đề', level: 2 },
      { type: 'paragraph', text: 'Đoạn đậm', bold: true },
      { type: 'listItem', text: 'Mục 1' },
      { type: 'listItem', text: 'Mục 2' },
      { type: 'quote', text: 'Trích dẫn' },
    ]);
  });

  it('block rỗng bị loại bỏ; HTML không có thẻ block thì fallback 1 paragraph', () => {
    expect(parseRichTextBlocks('<p></p><p>   </p>')).toEqual([]);
    expect(parseRichTextBlocks('<span>Chỉ có inline</span>')).toEqual([
      { type: 'paragraph', text: 'Chỉ có inline' },
    ]);
    expect(parseRichTextBlocks(undefined)).toEqual([]);
  });

  it('cắt ngắn preview', () => {
    expect(truncatePlainText('Ngắn', 120)).toBe('Ngắn');
    expect(truncatePlainText('  Nhiều   khoảng   trắng  ', 120)).toBe('Nhiều khoảng trắng');
    expect(truncatePlainText('abcdefghij', 5)).toBe('abcde…');
    expect(truncatePlainText('abc', 0)).toBe('');
    expect(truncatePlainText('', 10)).toBe('');
  });
});

describe('P3 — Thư viện biểu mẫu & tài liệu', () => {
  it('chuẩn hóa đuôi file', () => {
    expect(normalizeFileExtension('.PDF')).toBe('pdf');
    expect(normalizeFileExtension('DOCX')).toBe('docx');
    expect(normalizeFileExtension('report.final.xlsx')).toBe('xlsx');
    expect(normalizeFileExtension('path/to/file.pdf?v=2')).toBe('pdf');
    expect(normalizeFileExtension('')).toBe('');
    expect(normalizeFileExtension(undefined)).toBe('');
  });

  it('suy category từ đuôi file, fallback mimeType, cuối cùng là other', () => {
    expect(getDocumentCategory('pdf')).toBe('pdf');
    expect(getDocumentCategory('.PDF')).toBe('pdf');
    expect(getDocumentCategory('docx')).toBe('document');
    expect(getDocumentCategory('xlsx')).toBe('spreadsheet');
    expect(getDocumentCategory('pptx')).toBe('presentation');
    expect(getDocumentCategory('png')).toBe('image');
    expect(getDocumentCategory('mp4')).toBe('video');
    expect(getDocumentCategory('zip')).toBe('archive');
    expect(getDocumentCategory('xyz')).toBe('other');
    expect(getDocumentCategory('')).toBe('other');

    // Fallback theo mimeType khi thiếu đuôi.
    expect(getDocumentCategory('', 'application/pdf')).toBe('pdf');
    expect(getDocumentCategory(undefined, 'image/png')).toBe('image');
    expect(getDocumentCategory(undefined, 'video/mp4')).toBe('video');
    expect(getDocumentCategory(undefined, 'application/unknown')).toBe('other');

    // Không bao giờ trả 'all'.
    expect(getDocumentCategory('anything')).not.toBe('all');
  });

  it('nhãn category an toàn', () => {
    expect(getDocumentCategoryLabel('pdf')).toBe('PDF');
    expect(getDocumentCategoryLabel('khong-co')).toBe('Khác');
    expect(getDocumentCategoryLabel(undefined)).toBe('Khác');
    expect(DOCUMENT_CATEGORY_LABELS.all).toBe('Tất cả loại');
  });

  it('định dạng dung lượng file', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1048576)).toBe('1 MB');
    expect(formatFileSize(1234567)).toBe('1.18 MB');
    expect(formatFileSize(1073741824)).toBe('1 GB');
    expect(formatFileSize(null)).toBe('0 B');
    expect(formatFileSize(undefined)).toBe('0 B');
    expect(formatFileSize('')).toBe('0 B');
    expect(formatFileSize(-5)).toBe('0 B');
    expect(formatFileSize('khong-phai-so')).toBe('0 B');
  });

  it('chỉ ảnh và pdf xem trước trong app', () => {
    expect(isPreviewableInApp('pdf')).toBe(true);
    expect(isPreviewableInApp('PNG')).toBe(true);
    expect(isPreviewableInApp('jpg')).toBe(true);
    expect(isPreviewableInApp('docx')).toBe(false);
    expect(isPreviewableInApp('mp4')).toBe(false);
    expect(isPreviewableInApp('')).toBe(false);
  });

  it('tách và hiển thị tags', () => {
    expect(parseTagsInput('a, b , a,,c  ')).toEqual(['a', 'b', 'c']);
    expect(parseTagsInput('')).toEqual([]);
    expect(formatTagsInput(['a', 'b'])).toBe('a, b');
    expect(formatTagsInput(null)).toBe('');
  });

  it('dựng query params gửi API: bỏ rỗng và bỏ "all", tags nối bằng dấu phẩy', () => {
    expect(
      buildDocumentQueryParams({
        search: '  biểu mẫu ',
        category: 'all',
        tags: ['hr', ' policy '],
        sort: 'newest',
      }),
    ).toEqual({ search: 'biểu mẫu', tags: 'hr,policy', sort: 'newest' });

    expect(buildDocumentQueryParams({ category: 'pdf', sort: 'all' })).toEqual({ category: 'pdf' });
    expect(buildDocumentQueryParams({})).toEqual({});
    expect(buildDocumentQueryParams(null)).toEqual({});
    expect(buildDocumentQueryParams({ uploadedById: 'all' })).toEqual({});
  });

  it('phát hiện đang có filter hoạt động', () => {
    expect(hasActiveDocumentFilters({})).toBe(false);
    expect(hasActiveDocumentFilters({ category: 'all' })).toBe(false);
    expect(hasActiveDocumentFilters({ search: 'a' })).toBe(true);
    expect(hasActiveDocumentFilters({ tags: ['hr'] })).toBe(true);
    expect(hasActiveDocumentFilters(null)).toBe(false);
  });

  it('phiên bản kế tiếp khi khôi phục = currentVersion + 1 (không rollback)', () => {
    expect(getNextVersionNumber(1)).toBe(2);
    expect(getNextVersionNumber(3)).toBe(4);
    expect(getNextVersionNumber(null)).toBe(2);
    expect(getNextVersionNumber(0)).toBe(2);
    expect(getNextVersionNumber(undefined)).toBe(2);
  });

  it('tên người tải lên dùng username, có fallback', () => {
    expect(getUploaderName({ username: 'getvini.admin' })).toBe('getvini.admin');
    expect(getUploaderName(null)).toBe('Không xác định');
    expect(getUploaderName({})).toBe('Không xác định');
  });
});
