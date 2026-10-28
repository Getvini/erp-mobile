import type { ChatAttachment } from '@/services/chatService';

export type ChatAttachmentKind = 'image' | 'audio' | 'file';

export interface LocalChatFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

export interface UploadedChatFile {
  url: string;
  publicId?: string;
  size?: number;
}

export const isRemoteChatUrl = (url?: string | null): boolean =>
  Boolean(url && /^https:\/\//i.test(url));

export const getChatAttachmentKind = (file: {
  name?: string;
  type?: string;
  mimeType?: string;
  url?: string;
}): ChatAttachmentKind => {
  const mime = (file.mimeType || file.type || '').toLowerCase();
  const source = `${file.name || ''} ${file.url || ''}`.toLowerCase();

  if (mime.startsWith('image/') || /\.(jpe?g|png|webp|gif)(?:$|[?#\s])/i.test(source)) {
    return 'image';
  }
  if (mime.startsWith('audio/') || /\.(m4a|mp3|wav|aac|ogg|webm)(?:$|[?#\s])/i.test(source)) {
    return 'audio';
  }
  return 'file';
};

export const buildRemoteChatAttachment = (
  file: LocalChatFile,
  uploaded: UploadedChatFile
): ChatAttachment => {
  if (!isRemoteChatUrl(uploaded.url)) {
    throw new Error('Tệp tải lên không có URL từ xa hợp lệ.');
  }

  return {
    url: uploaded.url,
    name: file.name,
    type: getChatAttachmentKind({ name: file.name, mimeType: file.type }),
    mimeType: file.type,
    size: uploaded.size || file.size,
    publicId: uploaded.publicId,
  };
};

