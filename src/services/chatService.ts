import { apiService } from './api';
import { uploadToCloudinary, PickedFile } from './cloudinaryService';

export interface ChatAttachment {
  url: string;
  name?: string;
  type?: string;
  mimeType?: string;
  size?: number;
  publicId?: string;
}

export interface ChatParticipant {
  id?: string;
  roomId?: string;
  userId: string;
  role?: 'ADMIN' | 'MEMBER' | string;
  isMuted?: boolean;
  isPinned?: boolean;
  user?: {
    id: string;
    fullName?: string;
    username?: string;
    avatarUrl?: string;
    role?: string;
  };
  lastReadAt?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  sender?: {
    id: string;
    fullName?: string;
    username?: string;
    avatarUrl?: string;
  };
  content: string;
  attachments?: ChatAttachment[];
  createdAt: string;
  isOptimistic?: boolean;
  isError?: boolean;
  isRecalled?: boolean;
  isEdited?: boolean;
  editedAt?: string;
  isSystem?: boolean;
  systemMetadata?: any;
  isPinned?: boolean;
  pinnedAt?: string;
  pinnedById?: string;
  replyToId?: string | null;
  replyTo?: ChatMessage | null;
  reactions?: Array<{
    emoji: string;
    count?: number;
    userId?: string;
    user?: {
      id: string;
      fullName?: string;
      username?: string;
      avatarUrl?: string;
    };
  }>;
}

export interface ChatRoom {
  id: string;
  name?: string;
  description?: string;
  isGroup: boolean;
  avatarUrl?: string;
  participants: ChatParticipant[];
  latestMessage?: ChatMessage;
  unread?: boolean;
  unreadCount?: number;
  isPinned?: boolean;
  isMuted?: boolean;
  creatorId?: string;
  creator?: any;
  createdAt?: string;
  updatedAt: string;
}

class ChatService {
  async getUserRooms(): Promise<{ data?: ChatRoom[]; error?: string }> {
    return apiService.get<ChatRoom[]>('/chat-rooms');
  }

  async getRoomMessages(
    roomId: string,
    limit: number = 50,
    cursor?: string
  ): Promise<{ data?: ChatMessage[]; error?: string }> {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (cursor) params.append('cursor', cursor);

    return apiService.get<ChatMessage[]>(`/chat-rooms/${roomId}/messages?${params.toString()}`);
  }

  async sendMessage(
    roomId: string,
    content: string,
    attachments: any[] = [],
    replyToId?: string | null
  ): Promise<{ data?: ChatMessage; error?: string }> {
    return apiService.post<ChatMessage>(`/chat-rooms/${roomId}/messages`, {
      content,
      attachments,
      replyToId: replyToId || undefined,
    });
  }

  async createGroupRoom(
    name: string,
    participantIds: string[]
  ): Promise<{ data?: ChatRoom; error?: string }> {
    return apiService.post<ChatRoom>('/chat-rooms', {
      isGroup: true,
      name,
      participantIds,
    });
  }

  async getOrCreateDM(recipientId: string): Promise<{ data?: ChatRoom; error?: string }> {
    return apiService.post<ChatRoom>('/chat-rooms', {
      isGroup: false,
      recipientId,
    });
  }

  async markRoomAsRead(roomId: string): Promise<{ success?: boolean; error?: string }> {
    return apiService.post<{ success: boolean }>(`/chat-rooms/${roomId}/read`, {});
  }

  async addParticipants(
    roomId: string,
    participantIds: string[]
  ): Promise<{ data?: ChatRoom; error?: string }> {
    return apiService.post<ChatRoom>(`/chat-rooms/${roomId}/participants`, { participantIds });
  }

  async removeParticipant(
    roomId: string,
    userId: string
  ): Promise<{ success?: boolean; error?: string }> {
    return apiService.delete<{ success: boolean }>(`/chat-rooms/${roomId}/participants/${userId}`);
  }

  async updateParticipantRole(
    roomId: string,
    userId: string,
    role: 'ADMIN' | 'DEPUTY' | 'MEMBER'
  ): Promise<{ data?: ChatRoom; error?: string }> {
    return apiService.patch<ChatRoom>(`/chat-rooms/${roomId}/participants/${userId}/role`, { role });
  }

  async reactToMessage(
    roomId: string,
    messageId: string,
    emoji: string
  ): Promise<{ data?: { success: boolean }; error?: string }> {
    return apiService.post(`/chat-rooms/${roomId}/messages/${messageId}/reaction`, { emoji });
  }

  async pinMessage(
    roomId: string,
    messageId: string,
    isPinned: boolean
  ): Promise<{ data?: { success: boolean }; error?: string }> {
    return apiService.post(`/chat-rooms/${roomId}/messages/${messageId}/pin`, { isPinned });
  }

  async getPinnedMessages(
    roomId: string
  ): Promise<{ data?: ChatMessage[]; error?: string }> {
    return apiService.get<ChatMessage[]>(`/chat-rooms/${roomId}/pinned-messages`);
  }

  async recallMessage(
    roomId: string,
    messageId: string
  ): Promise<{ data?: { success: boolean }; error?: string }> {
    return apiService.post(`/chat-rooms/${roomId}/messages/${messageId}/recall`, {});
  }

  async editMessage(
    roomId: string,
    messageId: string,
    content: string
  ): Promise<{ data?: ChatMessage; error?: string }> {
    return apiService.put<ChatMessage>(`/chat-rooms/${roomId}/messages/${messageId}`, { content });
  }

  async updateRoom(
    roomId: string,
    data: { name?: string; avatarUrl?: string; description?: string }
  ): Promise<{ data?: ChatRoom; error?: string }> {
    return apiService.patch<ChatRoom>(`/chat-rooms/${roomId}`, data);
  }

  async updatePreferences(
    roomId: string,
    data: { isMuted?: boolean; isPinned?: boolean }
  ): Promise<{ data?: { success: boolean }; error?: string }> {
    return apiService.patch(`/chat-rooms/${roomId}/preferences`, data);
  }

  async forwardMessage(
    roomId: string,
    messageId: string,
    targetRoomIds: string[]
  ): Promise<{ data?: { success: boolean }; error?: string }> {
    return apiService.post(`/chat-rooms/${roomId}/messages/${messageId}/forward`, { targetRoomIds });
  }

  async uploadChatAttachment(
    file: PickedFile,
    folder: string = 'GETVINI/ERP/chat/attachments',
    onProgress?: (progressPercent: number) => void
  ): Promise<{ data?: { url: string; secure_url?: string }; error?: string }> {
    try {
      const uploaded = await uploadToCloudinary(file, folder, onProgress);
      return { data: { url: uploaded.url, secure_url: uploaded.url } };
    } catch (err: any) {
      console.error('[chatService] Lỗi upload tệp lên Cloudinary:', err);
      return { error: err.message || 'Lỗi khi tải tệp lên Cloudinary' };
    }
  }
}

export const chatService = new ChatService();
