import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { chatService, ChatRoom, ChatMessage } from '@/services/chatService';
import { apiService } from '@/services/api';

interface ChatStoreState {
  socket: Socket | null;
  isConnected: boolean;
  rooms: ChatRoom[];
  activeRoomId: string | null;
  messages: Record<string, ChatMessage[]>;
  onlineUsers: string[];
  typingUsers: Record<string, string[]>;
  loadingRooms: boolean;
  loadingMessages: boolean;
  currentUserId: string | null;

  // Actions
  initSocket: (userId: string) => Promise<void>;
  disconnectSocket: () => void;
  fetchRooms: () => Promise<void>;
  selectRoom: (roomId: string | null) => void;
  fetchMessages: (roomId: string) => Promise<void>;
  sendMessage: (roomId: string, content: string, attachments?: any[]) => Promise<void>;
  sendTyping: (roomId: string, isTyping: boolean) => void;
  markAsRead: (roomId: string) => Promise<void>;
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  socket: null,
  isConnected: false,
  rooms: [],
  activeRoomId: null,
  messages: {},
  onlineUsers: [],
  typingUsers: {},
  loadingRooms: false,
  loadingMessages: false,
  currentUserId: null,

  initSocket: async (userId: string) => {
    const existing = get().socket;
    if (existing && existing.connected) {
      set({ currentUserId: userId });
      return;
    }

    if (existing) {
      existing.disconnect();
    }

    const token = await apiService.getAccessToken();
    const socketUrl = apiService.getBaseOrigin();

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      set({ isConnected: true, socket });
      const { activeRoomId } = get();
      if (activeRoomId) {
        socket.emit('join_room', activeRoomId);
      }
      get().fetchRooms();
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
    });

    socket.on('connect_error', () => {
      set({ isConnected: false });
    });

    socket.on('online_users', (users: string[]) => {
      set({ onlineUsers: users || [] });
    });

    socket.on('receive_message', (message: ChatMessage) => {
      const { activeRoomId, messages, rooms, currentUserId } = get();
      const roomId = String(message.roomId);

      // Append message to cache
      const roomMsgs = messages[roomId] || [];
      const isDuplicate = roomMsgs.some((m) => String(m.id) === String(message.id));

      if (!isDuplicate) {
        // Replace optimistic message if exists
        const optimisticIdx = roomMsgs.findIndex(
          (m) => m.isOptimistic && m.content === message.content && String(m.senderId) === String(message.senderId)
        );

        let nextMsgs: ChatMessage[];
        if (optimisticIdx !== -1) {
          nextMsgs = [...roomMsgs];
          nextMsgs[optimisticIdx] = message;
        } else {
          nextMsgs = [...roomMsgs, message];
        }

        set({
          messages: {
            ...messages,
            [roomId]: nextMsgs,
          },
        });
      }

      // Update room preview & unread status
      const updatedRooms = rooms.map((r) => {
        if (String(r.id) === roomId) {
          const isViewingThisRoom = activeRoomId === roomId;
          const isFromOther = String(message.senderId) !== String(currentUserId);
          const shouldMarkUnread = isFromOther && !isViewingThisRoom;

          return {
            ...r,
            latestMessage: message,
            updatedAt: message.createdAt || new Date().toISOString(),
            unread: shouldMarkUnread ? true : isViewingThisRoom ? false : r.unread,
            unreadCount: shouldMarkUnread ? (r.unreadCount || 0) + 1 : isViewingThisRoom ? 0 : r.unreadCount,
          };
        }
        return r;
      });

      // Sort by updatedAt descending
      updatedRooms.sort((a, b) => {
        const timeA = new Date(a.latestMessage?.createdAt || a.updatedAt || 0).getTime();
        const timeB = new Date(b.latestMessage?.createdAt || b.updatedAt || 0).getTime();
        return timeB - timeA;
      });

      set({ rooms: updatedRooms });

      if (activeRoomId === roomId) {
        get().markAsRead(roomId);
      }
    });

    socket.on('user_typing', ({ roomId, username }: { roomId: string; username: string }) => {
      const { typingUsers } = get();
      const current = typingUsers[roomId] || [];
      if (!current.includes(username)) {
        set({
          typingUsers: {
            ...typingUsers,
            [roomId]: [...current, username],
          },
        });
      }
    });

    socket.on('user_stop_typing', ({ roomId, username }: { roomId: string; username: string }) => {
      const { typingUsers } = get();
      const current = typingUsers[roomId] || [];
      set({
        typingUsers: {
          ...typingUsers,
          [roomId]: current.filter((u) => u !== username),
        },
      });
    });

    set({ socket, currentUserId: userId });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  fetchRooms: async () => {
    set({ loadingRooms: true });
    try {
      const res = await chatService.getUserRooms();
      if (res.data) {
        set({ rooms: res.data });
      }
    } finally {
      set({ loadingRooms: false });
    }
  },

  selectRoom: (roomId: string | null) => {
    const { socket, activeRoomId } = get();
    if (activeRoomId && socket) {
      socket.emit('leave_room', activeRoomId);
    }

    set({ activeRoomId: roomId });

    if (roomId) {
      if (socket) {
        socket.emit('join_room', roomId);
      }
      get().fetchMessages(roomId);
      get().markAsRead(roomId);
    }
  },

  fetchMessages: async (roomId: string) => {
    set({ loadingMessages: true });
    try {
      const res = await chatService.getRoomMessages(roomId, 50);
      if (res.data) {
        set((state) => ({
          messages: {
            ...state.messages,
            [roomId]: res.data || [],
          },
        }));
      }
    } finally {
      set({ loadingMessages: false });
    }
  },

  sendMessage: async (roomId: string, content: string, attachments: any[] = []) => {
    const { socket, currentUserId, messages } = get();
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      roomId,
      senderId: currentUserId || '',
      content: trimmed,
      attachments,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    // Optimistically append
    const currentMsgs = messages[roomId] || [];
    set({
      messages: {
        ...messages,
        [roomId]: [...currentMsgs, optimisticMsg],
      },
    });

    try {
      if (socket && socket.connected) {
        socket.emit('send_message', { roomId, content: trimmed, attachments });
      } else {
        const res = await chatService.sendMessage(roomId, trimmed, attachments);
        if (res.data) {
          const updated = (get().messages[roomId] || []).map((m) =>
            m.id === tempId ? (res.data as any) : m
          );
          set((state) => ({
            messages: {
              ...state.messages,
              [roomId]: updated,
            },
          }));
        }
      }
    } catch {
      // Revert or mark error
    }
  },

  sendTyping: (roomId: string, isTyping: boolean) => {
    const { socket } = get();
    if (socket && socket.connected) {
      socket.emit(isTyping ? 'typing' : 'stop_typing', { roomId });
    }
  },

  markAsRead: async (roomId: string) => {
    try {
      await chatService.markRoomAsRead(roomId);
      set((state) => ({
        rooms: state.rooms.map((r) =>
          String(r.id) === String(roomId) ? { ...r, unread: false, unreadCount: 0 } : r
        ),
      }));
    } catch {
      // silent
    }
  },
}));
