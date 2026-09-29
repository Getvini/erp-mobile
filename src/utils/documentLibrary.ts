/**
 * Thư viện Biểu mẫu & Tài liệu — logic thuần (pure helpers).
 *
 * Đối chiếu backend thật: ERP/src/modules/document-library/services/DocumentLibrary.Service.ts
 * - `resolveCategory(fileExtension)` map đuôi file → category, mặc định 'other'.
 * - Query params: `tags` là CSV, `category` bỏ qua khi bằng 'all', `sort` theo SORT_MAP.
 * - Entity phẳng: displayName / fileExtension / mimeType / fileSizeBytes / currentVersion.
 */

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  all: 'Tất cả loại',
  document: 'Văn bản',
  spreadsheet: 'Bảng tính',
  presentation: 'Thuyết trình',
  pdf: 'PDF',
  image: 'Hình ảnh',
  video: 'Video',
  archive: 'Nén',
  other: 'Khác',
};

/** Thứ tự hiển thị chips lọc (gồm cả 'all' ở đầu). */
export const DOCUMENT_CATEGORY_ORDER = [
  'all',
  'document',
  'spreadsheet',
  'presentation',
  'pdf',
  'image',
  'video',
  'archive',
  'other',
] as const;

export const DOCUMENT_SORT_LABELS: Record<string, string> = {
  newest: 'Mới nhất',
  oldest: 'Cũ nhất',
  displayName: 'Tên A-Z',
  mostDownloaded: 'Tải nhiều nhất',
};

export const DOCUMENT_SORT_ORDER = ['newest', 'oldest', 'displayName', 'mostDownloaded'] as const;

export type DocumentSortKey = (typeof DOCUMENT_SORT_ORDER)[number];

/** Icon Feather + màu sắc theo category (dùng cho danh sách/chi tiết). */
export const DOCUMENT_CATEGORY_META: Record<
  string,
  { icon: string; color: string; bgColor: string; borderColor: string; ext: string }
> = {
  document: { icon: 'file-text', color: '#2563EB', bgColor: '#EFF6FF', borderColor: '#BFDBFE', ext: 'DOC' },
  spreadsheet: { icon: 'grid', color: '#16A34A', bgColor: '#F0FDF4', borderColor: '#BBF7D0', ext: 'XLS' },
  presentation: { icon: 'monitor', color: '#EA580C', bgColor: '#FFF7ED', borderColor: '#FED7AA', ext: 'PPT' },
  pdf: { icon: 'file', color: '#DC2626', bgColor: '#FEF2F2', borderColor: '#FECACA', ext: 'PDF' },
  image: { icon: 'image', color: '#9333EA', bgColor: '#FAF5FF', borderColor: '#E9D5FF', ext: 'IMG' },
  video: { icon: 'video', color: '#0891B2', bgColor: '#ECFEFF', borderColor: '#A5F3FC', ext: 'VIDEO' },
  archive: { icon: 'archive', color: '#B45309', bgColor: '#FFFBEB', borderColor: '#FDE68A', ext: 'ZIP' },
  other: { icon: 'file', color: '#64748B', bgColor: '#F8FAFC', borderColor: '#E2E8F0', ext: 'FILE' },
};

/** Extension → category. Bám sát CATEGORY_EXTENSIONS của backend. */
const CATEGORY_EXTENSION_MAP: Record<string, string> = {
  doc: 'document',
  docx: 'document',
  txt: 'document',
  rtf: 'document',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  csv: 'spreadsheet',
  ppt: 'presentation',
  pptx: 'presentation',
  pdf: 'pdf',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
  mp4: 'video',
  mov: 'video',
  avi: 'video',
  mkv: 'video',
  webm: 'video',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
};

/** MIME → category, dùng khi fileExtension rỗng. */
const MIME_CATEGORY_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'text/plain': 'document',
  'application/rtf': 'document',
  'text/rtf': 'document',
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'text/csv': 'spreadsheet',
  'application/vnd.ms-powerpoint': 'presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
  'application/zip': 'archive',
  'application/x-zip-compressed': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/x-tar': 'archive',
  'application/gzip': 'archive',
};

/** Chuẩn hóa đuôi file: '.PDF' / 'PDF' / 'report.final.pdf' → 'pdf'. */
export const normalizeFileExtension = (fileExtension?: string | null): string => {
  if (!fileExtension) return '';
  const raw = String(fileExtension).trim().toLowerCase();
  if (!raw) return '';
  const withoutQuery = raw.split('?')[0].split('#')[0];
  const lastSegment = withoutQuery.split('/').pop() ?? withoutQuery;
  return lastSegment.includes('.') ? (lastSegment.split('.').pop() ?? '') : lastSegment;
};

/**
 * Suy category từ đuôi file, fallback sang mimeType rồi 'other'.
 * KHÔNG bao giờ trả 'all'.
 */
export const getDocumentCategory = (
  fileExtension?: string | null,
  mimeType?: string | null,
): string => {
  const ext = normalizeFileExtension(fileExtension);
  if (ext && CATEGORY_EXTENSION_MAP[ext]) return CATEGORY_EXTENSION_MAP[ext];

  const mime = mimeType ? String(mimeType).trim().toLowerCase() : '';
  if (mime) {
    if (MIME_CATEGORY_MAP[mime]) return MIME_CATEGORY_MAP[mime];
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
  }

  // Đuôi file lạ nhưng vẫn có giá trị: vẫn là 'other' (khớp resolveCategory backend).
  return 'other';
};

/** Icon/màu theo category, luôn trả về một entry hợp lệ. */
export const getDocumentCategoryMeta = (category?: string) =>
  DOCUMENT_CATEGORY_META[category ?? ''] ?? DOCUMENT_CATEGORY_META.other;

/** Nhãn category an toàn cho UI. */
export const getDocumentCategoryLabel = (category?: string): string =>
  DOCUMENT_CATEGORY_LABELS[category ?? ''] ?? DOCUMENT_CATEGORY_LABELS.other;

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** Thêm dấu '.' phân cách hàng nghìn cho phần nguyên. */
const withThousandSeparator = (integerPart: string): string =>
  integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Định dạng dung lượng file: B / KB / MB / GB, tối đa 2 chữ số thập phân (dấu `.`),
 * phần nguyên ≥ 1000 dùng dấu `.` phân cách hàng nghìn. Rỗng/không hợp lệ → '0 B'.
 */
export const formatFileSize = (bytes?: number | string | null): string => {
  if (bytes === null || bytes === undefined || bytes === '') return '0 B';

  const numeric = typeof bytes === 'number' ? bytes : Number(String(bytes).trim());
  if (!Number.isFinite(numeric) || isNaN(numeric) || numeric < 0) return '0 B';
  if (numeric === 0) return '0 B';

  let value = numeric;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const unit = BYTE_UNITS[unitIndex];
  if (unitIndex === 0) return `${withThousandSeparator(String(Math.round(value)))} ${unit}`;

  const fixed = value.toFixed(2).replace(/\.?0+$/, '');
  const [integerPart, decimalPart] = fixed.split('.');
  const formattedInteger = withThousandSeparator(integerPart);
  return `${decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger} ${unit}`;
};

/** Ảnh & PDF xem trước trong app bằng DocumentPreviewModal; còn lại mở ngoài. */
export const isPreviewableInApp = (fileExtension?: string | null): boolean => {
  const ext = normalizeFileExtension(fileExtension);
  if (!ext) return false;
  return getDocumentCategory(ext) === 'image' || ext === 'pdf';
};

/** Tách chuỗi nhập tags: theo dấu phẩy, trim, bỏ rỗng, loại trùng, giữ thứ tự. */
export const parseTagsInput = (input: string): string[] => {
  if (!input) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of String(input).split(',')) {
    const tag = raw.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }

  return result;
};

/** Chuỗi hiển thị cho ô nhập tags (ngược của parseTagsInput). */
export const formatTagsInput = (tags?: string[] | null): string =>
  Array.isArray(tags) ? tags.filter(Boolean).join(', ') : '';

export interface DocumentFilters {
  search?: string;
  category?: string;
  tags?: string[];
  uploadedById?: string;
  fromDate?: string;
  toDate?: string;
  sort?: string;
}

/**
 * Chuyển filters của UI → params gửi API `/document-library`.
 * Bỏ toàn bộ giá trị rỗng và `'all'`; `tags` nối bằng dấu phẩy.
 */
export const buildDocumentQueryParams = (filters?: DocumentFilters | null): Record<string, any> => {
  const params: Record<string, any> = {};
  if (!filters) return params;

  const search = typeof filters.search === 'string' ? filters.search.trim() : '';
  if (search) params.search = search;

  const category = typeof filters.category === 'string' ? filters.category.trim() : '';
  if (category && category !== 'all') params.category = category;

  const tags = Array.isArray(filters.tags)
    ? filters.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];
  if (tags.length > 0) params.tags = tags.join(',');

  const uploadedById = typeof filters.uploadedById === 'string' ? filters.uploadedById.trim() : '';
  if (uploadedById && uploadedById !== 'all') params.uploadedById = uploadedById;

  const fromDate = typeof filters.fromDate === 'string' ? filters.fromDate.trim() : '';
  if (fromDate) params.fromDate = fromDate;

  const toDate = typeof filters.toDate === 'string' ? filters.toDate.trim() : '';
  if (toDate) params.toDate = toDate;

  const sort = typeof filters.sort === 'string' ? filters.sort.trim() : '';
  if (sort && sort !== 'all') params.sort = sort;

  return params;
};

/** Tên hiển thị an toàn cho người tải lên (backend trả `uploadedBy.username`). */
export const getUploaderName = (uploadedBy?: { username?: string } | null): string =>
  uploadedBy?.username || 'Không xác định';

/**
 * Phiên bản sẽ được tạo khi khôi phục = `currentVersion + 1`.
 * ⚠️ Backend KHÔNG rollback — luôn sinh version mới và giữ nguyên lịch sử.
 * Nhận cả `number` lẫn chuỗi số (bigint Postgres có thể trả về string).
 */
export const getNextVersionNumber = (currentVersion?: number | string | null): number => {
  const current = typeof currentVersion === 'number' ? currentVersion : Number(currentVersion);
  if (!Number.isFinite(current) || current < 1) return 2;
  return Math.floor(current) + 1;
};

/**
 * Nội dung cảnh báo trước khi khôi phục phiên bản.
 * Nêu rõ: tạo phiên bản MỚI, không xóa lịch sử.
 */
export const buildRestoreConfirmationMessage = (
  versionNumber: number,
  currentVersion?: number | string | null,
): string =>
  `Khôi phục sẽ tạo một phiên bản MỚI (v${getNextVersionNumber(currentVersion)}), ` +
  `không xóa lịch sử. Toàn bộ phiên bản hiện có vẫn được giữ nguyên và có thể tải lại ` +
  `bất kỳ lúc nào (bạn đang khôi phục từ v${versionNumber}).`;

/** Có filter nào đang bật không (dùng để tô đậm nút "Lọc"). */
export const hasActiveDocumentFilters = (filters?: DocumentFilters | null): boolean => {
  if (!filters) return false;
  const params = buildDocumentQueryParams(filters);
  return Object.keys(params).length > 0;
};
