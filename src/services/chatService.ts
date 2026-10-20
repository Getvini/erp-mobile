import { apiService } from './api';

export interface ChatParticipant {
  id?: string;
  roomId?: string;
  userId: string;
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
  attachments?: Array<{
    url: string;
    name?: string;
    type?: string;
  }>;
  createdAt: string;
  isOptimistic?: boolean;
  isError?: boolean;
  isRecalled?: boolean;
  isEdited?: boolean;
  isSystem?: boolean;
  systemMetadata?: any;
  isPinned?: boolean;
}

export interface ChatRoom {
  id: string;
  name?: string;
  isGroup: boolean;
  avatarUrl?: string;
  participants: ChatParticipant[];
  latestMessage?: ChatMessage;
  unread?: boolean;
  unreadCount?: number;
  isPinned?: boolean;
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
    attachments: any[] = []
  ): Promise<{ data?: ChatMessage; error?: string }> {
    return apiService.post<ChatMessage>(`/chat-rooms/${roomId}/messages`, {
      content,
      attachments,
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
    userIds: string[]
  ): Promise<{ data?: ChatRoom; error?: string }> {
    return apiService.post<ChatRoom>(`/chat-rooms/${roomId}/participants`, { userIds });
  }

  async removeParticipant(
    roomId: string,
    userId: string
  ): Promise<{ success?: boolean; error?: string }> {
    return apiService.delete<{ success: boolean }>(`/chat-rooms/${roomId}/participants/${userId}`);
  }

  async uploadChatAttachment(
    formData: FormData
  ): Promise<{ data?: { url: string; name?: string; type?: string }; error?: string }> {
    return apiService.postForm<{ url: string; name?: string; type?: string }>(
      '/chat-rooms/upload',
      formData
    );
  }
}

export const chatService = new ChatService();
