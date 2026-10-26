import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { chatService, ChatRoom, ChatMessage } from '@/services/chatService';
import { apiService } from '@/services/api';
import { isChatMembershipSystemMessage } from '@/utils/chatRealtime';

interface ChatStoreState {
  socket: Socket | null;
  isConnected: boolean;
  rooms: ChatRoom[];
  activeRoomId: string | null;
  lastRemovedRoomId: string | null;
  messages: Record<string, ChatMessage[]>;
  onlineUsers: string[];
  typingUsers: Record<string, Record<string, string>>; // roomId -> { [userId]: username }
  loadingRooms: boolean;
  loadingMessages: boolean;
  currentUserId: string | null;
  replyingToMessage: ChatMessage | null;
  editingMessage: ChatMessage | null;
  pinnedMessages: Record<string, ChatMessage[]>;

  // Actions
  initSocket: (userId: string) => Promise<void>;
  disconnectSocket: () => void;
  fetchRooms: () => Promise<void>;
  selectRoom: (roomId: string | null) => void;
  fetchMessages: (roomId: string) => Promise<void>;
  sendMessage: (
    roomId: string,
    content: string,
    attachments?: any[],
    replyToId?: string | null
  ) => Promise<void>;
  sendTyping: (roomId: string, isTyping: boolean) => void;
  markAsRead: (roomId: string) => Promise<void>;
  setReplyingToMessage: (message: ChatMessage | null) => void;
  setEditingMessage: (message: ChatMessage | null) => void;
  recallMessage: (roomId: string, messageId: string) => Promise<boolean>;
  editMessage: (roomId: string, messageId: string, content: string) => Promise<boolean>;
  reactToMessage: (roomId: string, messageId: string, emoji: string) => Promise<void>;
  pinMessage: (roomId: string, messageId: string, isPinned: boolean) => Promise<void>;
  fetchPinnedMessages: (roomId: string) => Promise<void>;
  forwardMessage: (roomId: string, messageId: string, targetRoomIds: string[]) => Promise<boolean>;
}

let isConnecting = false;
let roomsRefreshTimer: ReturnType<typeof setTimeout> | null = null;

export const useChatStore = create<ChatStoreState>((set, get) => ({
  socket: null,
  isConnected: false,
  rooms: [],
  activeRoomId: null,
  lastRemovedRoomId: null,
  messages: {},
  onlineUsers: [],
  typingUsers: {},
  loadingRooms: false,
  loadingMessages: false,
  currentUserId: null,
  replyingToMessage: null,
  editingMessage: null,
  pinnedMessages: {},

  initSocket: async (userId: string) => {
    const existing = get().socket;
    if (existing && existing.connected) {
      set({ currentUserId: userId });
      return;
    }

    if (isConnecting) {
      return;
    }
    isConnecting = true;

    try {
      if (existing) {
        existing.disconnect();
      }

      const token = await apiService.getAccessToken();
      const cookieHeader = apiService.getCookieHeader();
      const socketUrl = apiService.getBaseOrigin();

      console.log('📡 [Socket.io] Connecting to:', socketUrl, '| Token:', token ? 'Có token' : 'Không có token');

      const socket = io(socketUrl, {
        auth: { token },
        extraHeaders: cookieHeader ? { Cookie: cookieHeader } : {},
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
      });

    const scheduleRoomsRefresh = () => {
      if (roomsRefreshTimer) clearTimeout(roomsRefreshTimer);
      roomsRefreshTimer = setTimeout(() => {
        roomsRefreshTimer = null;
        get().fetchRooms();
      }, 150);
    };

    socket.on('connect', () => {
      console.log('✅ [Socket.io] Connected successfully! Socket ID:', socket.id);
      set({ isConnected: true, socket });
      const { activeRoomId } = get();
      if (activeRoomId) {
        socket.emit('join_room', activeRoomId);
      }
      get().fetchRooms();
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 [Socket.io] Disconnected:', reason);
      set({ isConnected: false });
    });

    socket.on('connect_error', (error) => {
      console.log('❌ [Socket.io] Connect error:', error?.message || error);
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

      if (isChatMembershipSystemMessage(message)) {
        scheduleRoomsRefresh();
      }
    });

    socket.on('room_added', () => {
      scheduleRoomsRefresh();
    });

    socket.on('room_removed', ({ roomId }: { roomId?: string } = {}) => {
      if (!roomId) return;
      set((state) => {
        const nextMessages = { ...state.messages };
        const nextPinnedMessages = { ...state.pinnedMessages };
        delete nextMessages[roomId];
        delete nextPinnedMessages[roomId];
        return {
          rooms: state.rooms.filter((room) => String(room.id) !== String(roomId)),
          messages: nextMessages,
          pinnedMessages: nextPinnedMessages,
          activeRoomId:
            String(state.activeRoomId) === String(roomId) ? null : state.activeRoomId,
          lastRemovedRoomId: roomId,
        };
      });
      scheduleRoomsRefresh();
    });

    // Tin nhắn bị thu hồi từ client khác (Web/Mobile)
    socket.on('message_recalled', (data: { messageId: string; roomId: string }) => {
      set((state) => {
        const roomMsgs = state.messages[data.roomId] || [];
        return {
          messages: {
            ...state.messages,
            [data.roomId]: roomMsgs.map((m) =>
              String(m.id) === String(data.messageId)
                ? { ...m, content: '⛔ Tin nhắn đã bị thu hồi', isRecalled: true }
                : m
            ),
          },
        };
      });
    });

    // Tin nhắn bị sửa từ client khác (Web/Mobile)
    socket.on('message_edited', (data: { messageId: string; roomId: string; content: string }) => {
      set((state) => {
        const roomMsgs = state.messages[data.roomId] || [];
        return {
          messages: {
            ...state.messages,
            [data.roomId]: roomMsgs.map((m) =>
              String(m.id) === String(data.messageId)
                ? { ...m, content: data.content, isEdited: true }
                : m
            ),
          },
        };
      });
    });

    // Cập nhật cảm xúc realtime từ client khác
    socket.on('message_reaction', ({ messageId, roomId, reactions }: { messageId: string; roomId: string; reactions: any[] }) => {
      set((state) => {
        const roomMsgs = state.messages[roomId] || [];
        return {
          messages: {
            ...state.messages,
            [roomId]: roomMsgs.map((m) =>
              String(m.id) === String(messageId) ? { ...m, reactions } : m
            ),
          },
        };
      });
    });

    // Cập nhật tin nhắn ghim realtime
    socket.on('message_pinned', ({ messageId, roomId, isPinned, pinnedAt, pinnedById, message }: any) => {
      set((state) => {
        const roomMsgs = state.messages[roomId] || [];
        const currentPinned = state.pinnedMessages[roomId] || [];
        let nextPinned = [...currentPinned];

        const updatedMsgs = roomMsgs.map((m) =>
          String(m.id) === String(messageId)
            ? { ...m, isPinned, pinnedAt, pinnedById, ...(message ? message : {}) }
            : m
        );

        if (isPinned) {
          const targetMsg = message || updatedMsgs.find((m) => String(m.id) === String(messageId));
          if (targetMsg && !nextPinned.some((p) => String(p.id) === String(messageId))) {
            nextPinned = [targetMsg, ...nextPinned];
          }
        } else {
          nextPinned = nextPinned.filter((p) => String(p.id) !== String(messageId));
        }

        return {
          messages: {
            ...state.messages,
            [roomId]: updatedMsgs,
          },
          pinnedMessages: {
            ...state.pinnedMessages,
            [roomId]: nextPinned,
          },
        };
      });
    });

    socket.on('user_typing', ({ roomId, userId, username }: { roomId: string; userId: string; username: string }) => {
      if (!roomId || !userId) return;
      set((state) => ({
        typingUsers: {
          ...state.typingUsers,
          [roomId]: {
            ...(state.typingUsers[roomId] || {}),
            [userId]: username || userId,
          },
        },
      }));
    });

    socket.on('user_stop_typing', ({ roomId, userId }: { roomId: string; userId: string }) => {
      if (!roomId || !userId) return;
      set((state) => {
        const current = { ...(state.typingUsers[roomId] || {}) };
        delete current[userId];
        return {
          typingUsers: {
            ...state.typingUsers,
            [roomId]: current,
          },
        };
      });
    });

    set({ socket, currentUserId: userId });
  } catch (err) {
    console.log('💥 [Socket.io] Error initializing socket:', err);
  } finally {
    isConnecting = false;
  }
},

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false, lastRemovedRoomId: null });
    }
    if (roomsRefreshTimer) {
      clearTimeout(roomsRefreshTimer);
      roomsRefreshTimer = null;
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

    set({
      activeRoomId: roomId,
      lastRemovedRoomId: roomId && get().lastRemovedRoomId === roomId ? null : get().lastRemovedRoomId,
    });

    if (roomId) {
      if (socket) {
        socket.emit('join_room', roomId);
      }
      get().fetchMessages(roomId);
      get().fetchPinnedMessages(roomId);
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

  sendMessage: async (
    roomId: string,
    content: string,
    attachments: any[] = [],
    replyToId?: string | null
  ) => {
    const { socket, currentUserId, replyingToMessage } = get();
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;

    const targetReplyTo = replyToId || replyingToMessage?.id || null;
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      roomId,
      senderId: currentUserId || '',
      content: trimmed,
      attachments,
      replyToId: targetReplyTo,
      replyTo: replyingToMessage || undefined,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    // Reset trạng thái đang trả lời
    set({ replyingToMessage: null });

    // Optimistic append ngay lập tức
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: [...(state.messages[roomId] || []), optimisticMsg],
      },
    }));

    // Fallback gọi REST nếu socket không khả dụng hoặc timeout
    const sendViaRest = async () => {
      try {
        const res = await chatService.sendMessage(
          roomId,
          trimmed,
          attachments,
          targetReplyTo
        );
        if (res.data) {
          set((state) => ({
            messages: {
              ...state.messages,
              [roomId]: (state.messages[roomId] || []).map((m) =>
                m.id === tempId ? res.data! : m
              ),
            },
          }));
        }
      } catch {
        // Đánh dấu lỗi trên tin nhắn optimistic để UI hiển thị trạng thái lỗi
        set((state) => ({
          messages: {
            ...state.messages,
            [roomId]: (state.messages[roomId] || []).map((m) =>
              m.id === tempId ? { ...m, isError: true, isOptimistic: false } : m
            ),
          },
        }));
      }
    };

    if (socket && socket.connected) {
      // Gửi qua socket với ack timeout 5s; nếu fail tự động fallback sang REST
      socket.timeout(5000).emit(
        'send_message',
        { roomId, content: trimmed, attachments, replyToId: targetReplyTo },
        (err: any, response: { ok: boolean; message?: ChatMessage }) => {
          if (err || !response?.ok) {
            sendViaRest();
            return;
          }
          if (response.message) {
            // Thay thế tin nhắn optimistic bằng server message thực
            set((state) => ({
              messages: {
                ...state.messages,
                [roomId]: (state.messages[roomId] || []).map((m) =>
                  m.id === tempId ? response.message! : m
                ),
              },
            }));
          }
        }
      );
    } else {
      await sendViaRest();
    }
  },

  sendTyping: (roomId: string, isTyping: boolean) => {
    const { socket } = get();
    if (!socket || !socket.connected) return;
    socket.emit(isTyping ? 'typing' : 'stop_typing', roomId);
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

  setReplyingToMessage: (message: ChatMessage | null) => {
    set({ replyingToMessage: message, editingMessage: null });
  },

  setEditingMessage: (message: ChatMessage | null) => {
    set({ editingMessage: message, replyingToMessage: null });
  },

  recallMessage: async (roomId: string, messageId: string) => {
    try {
      const res = await chatService.recallMessage(roomId, messageId);
      if (res.data?.success) {
        set((state) => {
          const roomMsgs = state.messages[roomId] || [];
          return {
            messages: {
              ...state.messages,
              [roomId]: roomMsgs.map((m) =>
                String(m.id) === String(messageId)
                  ? { ...m, content: '⛔ Tin nhắn đã bị thu hồi', isRecalled: true }
                  : m
              ),
            },
          };
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  editMessage: async (roomId: string, messageId: string, content: string) => {
    try {
      const res = await chatService.editMessage(roomId, messageId, content);
      if (res.data) {
        set((state) => {
          const roomMsgs = state.messages[roomId] || [];
          return {
            editingMessage: null,
            messages: {
              ...state.messages,
              [roomId]: roomMsgs.map((m) =>
                String(m.id) === String(messageId)
                  ? { ...m, content: res.data!.content, isEdited: true, editedAt: res.data!.editedAt }
                  : m
              ),
            },
          };
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  reactToMessage: async (roomId: string, messageId: string, emoji: string) => {
    try {
      await chatService.reactToMessage(roomId, messageId, emoji);
    } catch (err) {
      console.log('Error reacting to message:', err);
    }
  },

  pinMessage: async (roomId: string, messageId: string, isPinned: boolean) => {
    try {
      await chatService.pinMessage(roomId, messageId, isPinned);
    } catch (err) {
      console.log('Error pinning message:', err);
    }
  },

  fetchPinnedMessages: async (roomId: string) => {
    try {
      const res = await chatService.getPinnedMessages(roomId);
      if (res.data) {
        set((state) => ({
          pinnedMessages: {
            ...state.pinnedMessages,
            [roomId]: res.data || [],
          },
        }));
      }
    } catch (err) {
      console.log('Error fetching pinned messages:', err);
    }
  },

  forwardMessage: async (roomId: string, messageId: string, targetRoomIds: string[]) => {
    try {
      const res = await chatService.forwardMessage(roomId, messageId, targetRoomIds);
      if (res.data?.success) {
        get().fetchRooms();
        return true;
      }
      return false;
    } catch (err) {
      console.log('Error forwarding message:', err);
      return false;
    }
  },
}));
