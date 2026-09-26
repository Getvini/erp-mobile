/**
 * File Detector & Preview URL Utility for Mobile
 * Adapted from Web erp-UI/src/utils/fileDetector.js
 */

export const FILE_TYPES = {
  DOCX: 'DOCX',
  DOC: 'DOC',
  PDF: 'PDF',
  EXCEL: 'EXCEL',
  POWERPOINT: 'POWERPOINT',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  TEXT: 'TEXT',
  GDOCS: 'GDOCS',
  GSHEETS: 'GSHEETS',
  GSLIDES: 'GSLIDES',
  GDRIVE: 'GDRIVE',
  LINK: 'LINK',
  UNKNOWN: 'UNKNOWN',
} as const;

export type FileType = (typeof FILE_TYPES)[keyof typeof FILE_TYPES];

export const getGoogleDocId = (url: string = ''): string | null => {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
};

export const getGoogleSheetId = (url: string = ''): string | null => {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/docs\.google\.com\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
};

export const getGoogleSlideId = (url: string = ''): string | null => {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/docs\.google\.com\/presentation\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
};

export const getGoogleDriveFileId = (url: string = ''): string | null => {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(
    /drive\.google\.com\/(?:file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)|(?:open|uc)\?(?:.*&)?id=([a-zA-Z0-9_-]+))/i
  );
  return match ? match[1] || match[2] : null;
};

export const isGoogleDocUrl = (url: string = ''): boolean => Boolean(getGoogleDocId(url));
export const isGoogleSheetUrl = (url: string = ''): boolean => Boolean(getGoogleSheetId(url));
export const isGoogleSlideUrl = (url: string = ''): boolean => Boolean(getGoogleSlideId(url));
export const isGoogleDriveUrl = (url: string = ''): boolean => Boolean(getGoogleDriveFileId(url));
export const isGoogleUrl = (url: string = ''): boolean =>
  isGoogleDocUrl(url) || isGoogleSheetUrl(url) || isGoogleSlideUrl(url) || isGoogleDriveUrl(url);

export const getGoogleEmbedUrl = (url: string = ''): string | null => {
  const docId = getGoogleDocId(url);
  if (docId) return `https://docs.google.com/document/d/${docId}/preview`;

  const sheetId = getGoogleSheetId(url);
  if (sheetId) return `https://docs.google.com/spreadsheets/d/${sheetId}/preview`;

  const slideId = getGoogleSlideId(url);
  if (slideId) return `https://docs.google.com/presentation/d/${slideId}/preview`;

  const driveId = getGoogleDriveFileId(url);
  if (driveId) return `https://drive.google.com/file/d/${driveId}/preview`;

  return null;
};

export const detectFileType = (url: string = '', fileName: string = ''): FileType => {
  if (!url) return FILE_TYPES.UNKNOWN;

  if (isGoogleDocUrl(url)) return FILE_TYPES.GDOCS;
  if (isGoogleSheetUrl(url)) return FILE_TYPES.GSHEETS;
  if (isGoogleSlideUrl(url)) return FILE_TYPES.GSLIDES;
  if (isGoogleDriveUrl(url)) return FILE_TYPES.GDRIVE;

  const target = (fileName || url).split('?')[0].split('#')[0].toLowerCase();

  if (target.endsWith('.docx')) return FILE_TYPES.DOCX;
  if (target.endsWith('.doc')) return FILE_TYPES.DOC;
  if (target.endsWith('.pdf')) return FILE_TYPES.PDF;
  if (target.endsWith('.xlsx') || target.endsWith('.xls') || target.endsWith('.csv'))
    return FILE_TYPES.EXCEL;
  if (target.endsWith('.pptx') || target.endsWith('.ppt')) return FILE_TYPES.POWERPOINT;
  if (
    target.endsWith('.jpg') ||
    target.endsWith('.jpeg') ||
    target.endsWith('.png') ||
    target.endsWith('.webp') ||
    target.endsWith('.gif')
  )
    return FILE_TYPES.IMAGE;

  if (url.startsWith('http://') || url.startsWith('https://')) return FILE_TYPES.LINK;

  return FILE_TYPES.UNKNOWN;
};

export const getFileMeta = (fileType: FileType) => {
  switch (fileType) {
    case FILE_TYPES.DOCX:
    case FILE_TYPES.DOC:
    case FILE_TYPES.GDOCS:
      return {
        label: 'Tài liệu Word',
        ext: 'DOCX',
        icon: 'file-text',
        color: '#2563EB',
        bgColor: '#EFF6FF',
        borderColor: '#BFDBFE',
      };
    case FILE_TYPES.EXCEL:
    case FILE_TYPES.GSHEETS:
      return {
        label: 'Bảng tính Excel',
        ext: 'XLSX',
        icon: 'grid',
        color: '#16A34A',
        bgColor: '#F0FDF4',
        borderColor: '#BBF7D0',
      };
    case FILE_TYPES.PDF:
      return {
        label: 'Tệp PDF',
        ext: 'PDF',
        icon: 'file',
        color: '#DC2626',
        bgColor: '#FEF2F2',
        borderColor: '#FECACA',
      };
    case FILE_TYPES.IMAGE:
      return {
        label: 'Hình ảnh',
        ext: 'IMG',
        icon: 'image',
        color: '#9333EA',
        bgColor: '#FAF5FF',
        borderColor: '#E9D5FF',
      };
    default:
      return {
        label: 'Đường dẫn liên kết',
        ext: 'LINK',
        icon: 'link-2',
        color: '#0891B2',
        bgColor: '#ECFEFF',
        borderColor: '#A5F3FC',
      };
  }
};

export const getDocumentViewerUrl = (url: string = ''): string => {
  if (!url) return '';
  const googleEmbed = getGoogleEmbedUrl(url);
  if (googleEmbed) return googleEmbed;

  const lower = url.toLowerCase();
  // Cloudinary or direct office files: use Google Docs Viewer for live rendered preview
  if (
    lower.endsWith('.docx') ||
    lower.endsWith('.doc') ||
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.pptx') ||
    lower.endsWith('.ppt') ||
    lower.endsWith('.pdf') ||
    lower.includes('res.cloudinary.com')
  ) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  }

  return url;
};

export const getFileNameFromUrl = (url: string = '', defaultName: string = ''): string => {
  if (defaultName) return defaultName;
  if (!url) return 'Tai-lieu';

  try {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const segments = cleanUrl.split('/');
    const last = segments[segments.length - 1];
    return decodeURIComponent(last) || 'Tai-lieu';
  } catch {
    return 'Tai-lieu';
  }
};
