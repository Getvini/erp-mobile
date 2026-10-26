import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import { useChatStore } from '@/stores/useChatStore';
import { useAuth } from '@/context/AuthContext';
import { ChatAttachment, ChatMessage, chatService } from '@/services/chatService';
import { uploadToCloudinary } from '@/services/cloudinaryService';
import { BrandColors } from '@/constants/colors';
import { ChatMessageItem } from '@/components/chat/ChatMessageItem';
import { ChatAddMembersModal } from '@/components/chat/ChatAddMembersModal';
import { ChatRenameModal } from '@/components/chat/ChatRenameModal';
import { PinnedMessageBanner } from '@/components/chat/PinnedMessageBanner';
import { PinnedMessagesModal } from '@/components/chat/PinnedMessagesModal';
import { VoiceRecorderBar } from '@/components/chat/VoiceRecorderBar';
import { ChatForwardModal } from '@/components/chat/ChatForwardModal';
import { ChatEmojiPicker } from '@/components/chat/ChatEmojiPicker';
import { RoomAvatar } from '@/components/chat/RoomAvatar';
import { ChatComposerInput } from '@/components/chat/ChatComposerInput';
import { useTasksQuery } from '@/hooks/queries/useTasks';
import { useUsersQuery } from '@/hooks/queries/useUsers';
import { UserItem } from '@/services/userService';
import {
  ComposerTokenRange,
  deserializeComposerContent,
  insertComposerToken,
  reconcileComposerRanges,
  serializeComposerContent,
} from '@/utils/chatComposerTokens';
import { buildRemoteChatAttachment } from '@/utils/chatAttachments';
import {
  validateChatFile,
  MAX_CHAT_FILE_SIZE_MB,
  CHAT_ALLOWED_MIME_TYPES,
  formatBytes,
} from '@/utils/chatFileValidation';

interface AttachedMediaItem {
  id: string;
  uri: string;
  name: string;
  type: string;
  size?: number;
  isImage: boolean;
  uploadState: 'pending' | 'uploading' | 'uploaded' | 'error';
  uploadProgress?: number;
  remoteAttachment?: ChatAttachment;
  error?: string;
}

const createAttachmentId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const getDocFileColor = (fileName?: string) => {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return { icon: 'file-text' as const, color: '#EF4444', bg: '#FEE2E2', label: 'PDF' };
    case 'xls':
    case 'xlsx':
    case 'csv':
      return { icon: 'grid' as const, color: '#10B981', bg: '#D1FAE5', label: 'EXCEL' };
    case 'doc':
    case 'docx':
      return { icon: 'file-text' as const, color: '#2563EB', bg: '#DBEAFE', label: 'WORD' };
    case 'zip':
    case 'rar':
    case '7z':
      return { icon: 'archive' as const, color: '#F59E0B', bg: '#FEF3C7', label: 'NÉN' };
    default:
      return { icon: 'file' as const, color: '#64748B', bg: '#F1F5F9', label: (ext || 'FILE').toUpperCase() };
  }
};

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [inputContent, setInputContent] = useState('');
  const [inputTokenRanges, setInputTokenRanges] = useState<ComposerTokenRange[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedMediaItem[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  // Lắng nghe trạng thái bàn phím để căn chỉnh offset và tự cuộn tin nhắn mượt mà
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setShowEmojiPicker(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Tự động cuộn xuống khi có tệp đính kèm mới để không bị che tin nhắn cuối
  useEffect(() => {
    if (attachedFiles.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [attachedFiles.length]);

  const rooms = useChatStore((s) => s.rooms);
  const messagesMap = useChatStore((s) => s.messages);
  const pinnedMessagesMap = useChatStore((s) => s.pinnedMessages);
  const loadingMessages = useChatStore((s) => s.loadingMessages);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const isConnected = useChatStore((s) => s.isConnected);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const selectRoom = useChatStore((s) => s.selectRoom);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const sendTyping = useChatStore((s) => s.sendTyping);
  const fetchRooms = useChatStore((s) => s.fetchRooms);
  const fetchPinnedMessages = useChatStore((s) => s.fetchPinnedMessages);
  const replyingToMessage = useChatStore((s) => s.replyingToMessage);
  const editingMessage = useChatStore((s) => s.editingMessage);
  const setReplyingToMessage = useChatStore((s) => s.setReplyingToMessage);
  const setEditingMessage = useChatStore((s) => s.setEditingMessage);
  const recallMessage = useChatStore((s) => s.recallMessage);
  const editMessage = useChatStore((s) => s.editMessage);
  const reactToMessage = useChatStore((s) => s.reactToMessage);
  const pinMessage = useChatStore((s) => s.pinMessage);

  // Kích hoạt phòng chat và lấy tin nhắn đã ghim
  useEffect(() => {
    if (id) {
      selectRoom(id);
      fetchPinnedMessages(id);
    }
    return () => {
      selectRoom(null);
    };
  }, [id, selectRoom, fetchPinnedMessages]);

  // Điền nội dung tin nhắn khi bật chế độ chỉnh sửa
  useEffect(() => {
    if (editingMessage) {
      const draft = deserializeComposerContent(editingMessage.content || '');
      setInputContent(draft.text);
      setInputTokenRanges(draft.ranges);
    }
  }, [editingMessage]);

  // Queries cho mention & task tag
  const { data: tasksResp } = useTasksQuery({ limit: 100 });
  const { data: allUsers = [] } = useUsersQuery();

  const allTasks = useMemo(() => {
    return Array.isArray(tasksResp?.data) ? tasksResp.data : [];
  }, [tasksResp]);

  const currentRoom = useMemo(() => {
    return rooms.find((r) => String(r.id) === String(id));
  }, [rooms, id]);

  const otherParticipant = useMemo(() => {
    if (!currentRoom || currentRoom.isGroup) return null;
    return currentRoom.participants?.find(
      (p) => String(p.userId || p.user?.id) !== String(user?.id)
    );
  }, [currentRoom, user?.id]);

  const isOtherOnline = useMemo(() => {
    const oId = otherParticipant?.userId || otherParticipant?.user?.id;
    return Boolean(oId && onlineUsers.includes(String(oId)));
  }, [otherParticipant, onlineUsers]);

  const messages = useMemo(() => {
    return id ? messagesMap[id] || [] : [];
  }, [messagesMap, id]);

  const roomTypingList = useMemo(() => {
    if (!id) return [];
    const roomTyping = typingUsers[id] || {};
    return Object.values(roomTyping); // array of username strings
  }, [typingUsers, id]);

  // Autocomplete Detection: kiểm tra từ cuối cùng người dùng đang gõ
  const autocompleteState = useMemo(() => {
    const taskMatch = inputContent.match(/#([a-zA-Z0-9_\-\s]*)$/);
    if (taskMatch) {
      const q = taskMatch[1].toLowerCase().trim();
      const filtered = allTasks
        .filter((t: any) => !q || t.name?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q))
        .slice(0, 5);
      return { type: 'TASK' as const, query: q, items: filtered };
    }

    const userMatch = inputContent.match(/@([a-zA-Z0-9_\-\s]*)$/);
    if (userMatch) {
      const q = userMatch[1].toLowerCase().trim();
      const items: any[] = [];

      // Nếu là nhóm chat, cho phép @all nếu query khớp
      if (currentRoom?.isGroup && (!q || 'tất cả'.includes(q) || 'all'.includes(q) || 'nhóm'.includes(q))) {
        items.push({
          id: 'all',
          fullName: 'Tất cả mọi người',
          username: 'all',
          role: 'Nhắc tên cả nhóm',
          isAll: true,
        });
      }

      // Ưu tiên thành viên trong phòng chat
      if (currentRoom?.participants) {
        currentRoom.participants.forEach((p) => {
          const u = p.user;
          if (!u || String(u.id) === String(user?.id)) return;
          const name = u.fullName || u.username || '';
          if (!q || name.toLowerCase().includes(q)) {
            if (!items.some((it) => it.id === u.id)) {
              items.push({
                id: u.id,
                fullName: u.fullName || u.username,
                role: 'Thành viên nhóm',
                avatarUrl: u.avatarUrl,
              });
            }
          }
        });
      }

      // Nếu chưa đủ 5 items, nạp thêm từ danh bạ allUsers
      if (items.length < 5) {
        allUsers.forEach((u: UserItem) => {
          if (items.length >= 5) return;
          if (String(u.id) === String(user?.id)) return;
          const name = u.fullName || u.account?.username || '';
          if (!q || name.toLowerCase().includes(q)) {
            if (!items.some((it) => it.id === u.id)) {
              items.push({
                id: u.id,
                fullName: name,
                role: u.account?.role || 'Đồng nghiệp',
              });
            }
          }
        });
      }

      return { type: 'USER' as const, query: q, items: items.slice(0, 5) };
    }

    return null;
  }, [inputContent, allTasks, allUsers, currentRoom, user?.id]);

  const handleSelectTaskToken = (task: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const match = inputContent.match(/#([a-zA-Z0-9_\-\s]*)$/);
    if (!match || match.index === undefined) return;
    const draft = insertComposerToken(
      inputContent,
      inputTokenRanges,
      match.index,
      inputContent.length,
      {
        type: 'task',
        id: task.id,
        display: task.code || task.nickname || task.name || 'TASK',
      }
    );
    setInputContent(draft.text);
    setInputTokenRanges(draft.ranges);
  };

  const handleSelectUserToken = (targetUser: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const match = inputContent.match(/@([a-zA-Z0-9_\-\s]*)$/);
    if (!match || match.index === undefined) return;
    const draft = insertComposerToken(
      inputContent,
      inputTokenRanges,
      match.index,
      inputContent.length,
      {
        type: targetUser.isAll ? 'all' : 'user',
        id: targetUser.isAll ? 'all' : targetUser.id,
        display: targetUser.isAll
          ? 'Tất cả mọi người'
          : targetUser.fullName || targetUser.username || 'Thành viên',
      }
    );
    setInputContent(draft.text);
    setInputTokenRanges(draft.ranges);
  };

  const handleInputChange = (text: string) => {
    setInputTokenRanges((ranges) => reconcileComposerRanges(inputContent, text, ranges));
    setInputContent(text);
    if (!id) return;
    sendTyping(id, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(id, false);
    }, 2000);
  };

  // Nén ảnh chuẩn Master Plan < 1MB
  const processImage = async (originalUri: string) => {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        originalUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return manipulated.uri;
    } catch {
      return originalUri;
    }
  };

  const handleCamera = async () => {
    try {
      if (attachedFiles.length >= 10) {
        Alert.alert('Giới hạn', 'Chỉ được gửi tối đa 10 tệp cùng một lúc.');
        return;
      }

      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền mở Camera để chụp ảnh hiện trường.');
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!res.canceled && res.assets && res.assets[0]) {
        const asset = res.assets[0];
        const validation = validateChatFile(
          {
            name: asset.fileName || 'Ảnh_Hiện_Trường.jpg',
            size: asset.fileSize,
            mimeType: asset.mimeType || 'image/jpeg',
          },
          { requireImage: true }
        );

        if (!validation.valid) {
          Alert.alert('Tệp không hợp lệ', validation.error || 'Ảnh không hợp lệ.');
          return;
        }

        const compressedUri = await processImage(asset.uri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setAttachedFiles((prev) => [
          ...prev,
          {
            id: createAttachmentId(),
            uri: compressedUri,
            name: asset.fileName || `Ảnh_Hiện_Trường_${Date.now()}.jpg`,
            type: 'image/jpeg',
            size: asset.fileSize,
            isImage: true,
            uploadState: 'pending',
          },
        ]);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể chụp ảnh từ Camera.');
    }
  };

  const handlePickImage = async () => {
    try {
      if (attachedFiles.length >= 10) {
        Alert.alert('Giới hạn', 'Chỉ được gửi tối đa 10 tệp cùng một lúc.');
        return;
      }

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền xem thư viện ảnh.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!res.canceled && res.assets) {
        const validItems: AttachedMediaItem[] = [];
        const errors: string[] = [];

        for (const asset of res.assets) {
          const validation = validateChatFile(
            {
              name: asset.fileName || 'image.jpg',
              size: asset.fileSize,
              mimeType: asset.mimeType || 'image/jpeg',
            },
            { requireImage: true }
          );

          if (!validation.valid) {
            errors.push(validation.error || `Ảnh ${asset.fileName || ''} không hợp lệ.`);
          } else {
            const compressedUri = await processImage(asset.uri);
            validItems.push({
              id: createAttachmentId(),
              uri: compressedUri,
              name: asset.fileName || `Ảnh_${Date.now()}.jpg`,
              type: 'image/jpeg',
              size: asset.fileSize,
              isImage: true,
              uploadState: 'pending',
            });
          }
        }

        if (errors.length > 0) {
          Alert.alert('Tệp không hợp lệ', errors.join('\n\n'));
        }

        if (validItems.length > 0) {
          setAttachedFiles((prev) => {
            const combined = [...prev, ...validItems];
            if (combined.length > 10) {
              Alert.alert('Giới hạn', 'Chỉ được gửi tối đa 10 tệp cùng một lúc.');
              return combined.slice(0, 10);
            }
            return combined;
          });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể chọn ảnh từ thư viện.');
    }
  };

  const handlePickDocument = async () => {
    try {
      if (attachedFiles.length >= 10) {
        Alert.alert('Giới hạn', 'Chỉ được gửi tối đa 10 tệp cùng một lúc.');
        return;
      }

      const res = await DocumentPicker.getDocumentAsync({
        type: CHAT_ALLOWED_MIME_TYPES,
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!res.canceled && res.assets) {
        const validItems: AttachedMediaItem[] = [];
        const errors: string[] = [];

        for (const asset of res.assets) {
          const validation = validateChatFile({
            name: asset.name,
            size: asset.size,
            mimeType: asset.mimeType,
          });

          if (!validation.valid) {
            errors.push(validation.error || `Tệp ${asset.name} không hợp lệ.`);
          } else {
            validItems.push({
              id: createAttachmentId(),
              uri: asset.uri,
              name: asset.name || `Tep_${Date.now()}`,
              type: asset.mimeType || 'application/octet-stream',
              size: asset.size,
              isImage: validation.isImage,
              uploadState: 'pending',
            });
          }
        }

        if (errors.length > 0) {
          Alert.alert('Tệp không hợp lệ', errors.join('\n\n'));
        }

        if (validItems.length > 0) {
          setAttachedFiles((prev) => {
            const combined = [...prev, ...validItems];
            if (combined.length > 10) {
              Alert.alert('Giới hạn', 'Chỉ được gửi tối đa 10 tệp cùng một lúc.');
              return combined.slice(0, 10);
            }
            return combined;
          });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mở trình chọn tài liệu.');
    }
  };

  const handleRemoveFile = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleEmojiPicker = () => {
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
    } else {
      Keyboard.dismiss();
      setShowEmojiPicker(true);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 120);
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    setInputContent((prev) => prev + emoji);
  };

  const handleBackspaceEmoji = () => {
    setInputContent((prev) => {
      if (!prev) return '';
      const chars = Array.from(prev);
      chars.pop();
      return chars.join('');
    });
  };

  const handleQuickLike = async () => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await sendMessage(id, '👍', [], replyingToMessage?.id);
    setReplyingToMessage(null);
  };

  const handleSend = async () => {
    const trimmed = inputContent.trim();
    if ((!trimmed && attachedFiles.length === 0) || !id) return;

    setShowEmojiPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Nếu đang ở chế độ chỉnh sửa tin nhắn
    if (editingMessage) {
      if (!trimmed) return;
      const msgToEdit = editingMessage;
      setEditingMessage(null);
      setInputContent('');
      await editMessage(id, msgToEdit.id, trimmed);
      return;
    }

    setInputContent('');
    const toSendFiles = [...attachedFiles];
    setAttachedFiles([]);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      sendTyping(id, false);
    }

    // Gửi tin nhắn kèm attachments và replyToId
    try {
      setIsUploading(true);
      const attachmentsPayload: any[] = [];

      for (const file of toSendFiles) {
        const formData = new FormData();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (formData as any).append('file', {
          uri: file.uri,
          name: file.name,
          type: file.type || 'application/octet-stream',
        });

        try {
          const uploadRes = await chatService.uploadChatAttachment(formData);
          if (uploadRes.data?.url) {
            attachmentsPayload.push({
              url: uploadRes.data.url,
              name: file.name,
              type: file.type,
              size: file.size,
            });
          } else {
            attachmentsPayload.push({
              url: file.uri,
              name: file.name,
              type: file.type,
              size: file.size,
            });
          }
        } catch {
          attachmentsPayload.push({
            url: file.uri,
            name: file.name,
            type: file.type,
            size: file.size,
          });
        }
      }

      await sendMessage(id, trimmed, attachmentsPayload, replyingToMessage?.id);
    } catch {
      Alert.alert('Lỗi', 'Không thể tải tệp lên hoặc gửi tin nhắn.');
    } finally {
      setIsUploading(false);
    }
  };

  const roomPinnedMessages = useMemo(() => {
    return id ? pinnedMessagesMap[id] || [] : [];
  }, [pinnedMessagesMap, id]);

  const handleScrollToMessage = (targetMsg: ChatMessage) => {
    const idx = messages.findIndex((m) => String(m.id) === String(targetMsg.id));
    if (idx !== -1 && flatListRef.current) {
      try {
        flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
      } catch {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }
  };

  const handleSendAudio = async (uri: string, durationSeconds: number) => {
    if (!id) return;
    try {
      setIsUploading(true);
      const formData = new FormData();
      const filename = `voice_${Date.now()}.m4a`;
      // @ts-ignore
      formData.append('file', {
        uri,
        name: filename,
        type: 'audio/m4a',
      });

      const res = await chatService.uploadChatAttachment(formData);
      const audioUrl = res.data?.url || uri;
      await sendMessage(
        id,
        '',
        [
          {
            url: audioUrl,
            name: `Tin nhắn thoại (${durationSeconds}s)`,
            type: 'audio/m4a',
          },
        ],
        replyingToMessage?.id
      );
      setReplyingToMessage(null);
      setIsRecordingVoice(false);
    } catch {
      Alert.alert('Lỗi', 'Không thể tải tin nhắn thoại lên.');
    } finally {
      setIsUploading(false);
    }
  };

  // In-room Message Search & Forwarding State
  const [isSearchingInRoom, setIsSearchingInRoom] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);

  const searchMatchingIndices = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    if (!q) return [];
    const indices: number[] = [];
    messages.forEach((m, idx) => {
      if (m.content && m.content.toLowerCase().includes(q) && !m.isRecalled) {
        indices.push(idx);
      }
    });
    return indices;
  }, [messages, searchKeyword]);

  const handleNextSearchMatch = () => {
    if (searchMatchingIndices.length === 0) return;
    const nextIdx = (searchMatchIndex + 1) % searchMatchingIndices.length;
    setSearchMatchIndex(nextIdx);
    const targetMsgIdx = searchMatchingIndices[nextIdx];
    try {
      flatListRef.current?.scrollToIndex({ index: targetMsgIdx, animated: true, viewPosition: 0.5 });
    } catch {}
  };

  const handlePrevSearchMatch = () => {
    if (searchMatchingIndices.length === 0) return;
    const prevIdx =
      (searchMatchIndex - 1 + searchMatchingIndices.length) % searchMatchingIndices.length;
    setSearchMatchIndex(prevIdx);
    const targetMsgIdx = searchMatchingIndices[prevIdx];
    try {
      flatListRef.current?.scrollToIndex({ index: targetMsgIdx, animated: true, viewPosition: 0.5 });
    } catch {}
  };

  const formatMessageTime = useCallback((dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return '';
    }
  }, []);

  const handleReplyMessage = useCallback((msg: ChatMessage) => {
    setReplyingToMessage(msg);
  }, []);

  const handleForwardMessage = useCallback((msg: ChatMessage) => {
    setForwardingMessage(msg);
  }, []);

  const handleEditMessage = useCallback((msg: ChatMessage) => {
    setEditingMessage(msg);
    setInputContent(msg.content);
  }, []);

  const handleRecallMessage = useCallback(
    (msg: ChatMessage) => {
      if (id) recallMessage(id, msg.id);
    },
    [id, recallMessage]
  );

  const handlePinMessage = useCallback(
    (msg: ChatMessage) => {
      if (id) pinMessage(id, msg.id, !msg.isPinned);
    },
    [id, pinMessage]
  );

  const handleReactMessage = useCallback(
    (msg: ChatMessage, emoji: string) => {
      if (id) reactToMessage(id, msg.id, emoji);
    },
    [id, reactToMessage]
  );

  const shouldShowDateDivider = useCallback((currentMsg: ChatMessage, prevMsg: ChatMessage | null) => {
    if (!prevMsg) return true; // Tin nhắn đầu tiên luôn có mốc thời gian
    try {
      const currTime = new Date(currentMsg.createdAt).getTime();
      const prevTime = new Date(prevMsg.createdAt).getTime();
      const isDifferentDay =
        new Date(currentMsg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
      // Nếu khác ngày hoặc cách nhau hơn 20 phút
      return isDifferentDay || currTime - prevTime > 20 * 60 * 1000;
    } catch {
      return false;
    }
  }, []);

  const formatDateDivider = useCallback((dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');

      if (isToday) {
        return `${hours}:${minutes}`;
      }

      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) {
        return `Hôm qua ${hours}:${minutes}`;
      }

      const dayNames = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'];
      const dayName = dayNames[d.getDay()];
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${dayName}, ${day}/${month} lúc ${hours}:${minutes}`;
    } catch {
      return '';
    }
  }, []);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const renderMessageItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isMe = String(item.senderId) === String(user?.id);
      const prevMsg = index > 0 ? messages[index - 1] : null;
      const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;

      const timeDiffWithPrev =
        prevMsg && item.createdAt && prevMsg.createdAt
          ? Math.abs(new Date(item.createdAt).getTime() - new Date(prevMsg.createdAt).getTime())
          : 0;

      const timeDiffWithNext =
        nextMsg && item.createdAt && nextMsg.createdAt
          ? Math.abs(new Date(nextMsg.createdAt).getTime() - new Date(item.createdAt).getTime())
          : 0;

      const isConsecutive = Boolean(
        prevMsg &&
        !prevMsg.isSystem &&
        !item.isSystem &&
        String(prevMsg.senderId) === String(item.senderId) &&
        timeDiffWithPrev < 10 * 60 * 1000
      );

      const isNextConsecutive = Boolean(
        nextMsg &&
        !nextMsg.isSystem &&
        !item.isSystem &&
        String(nextMsg.senderId) === String(item.senderId) &&
        timeDiffWithNext < 10 * 60 * 1000
      );

      const showSenderName = !isConsecutive;
      const showAvatar = Boolean(
        !nextMsg ||
        nextMsg.isSystem ||
        String(nextMsg.senderId) !== String(item.senderId)
      );

      const showDivider = shouldShowDateDivider(item, prevMsg);

      return (
        <View key={item.id}>
          {showDivider && (
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                marginVertical: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: '#94A3B8',
                  backgroundColor: '#F1F5F9',
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                {formatDateDivider(item.createdAt)}
              </Text>
            </View>
          )}

          <ChatMessageItem
            message={item}
            isMe={isMe}
            selfUserId={user?.id}
            formatTime={formatMessageTime}
            showSenderName={showSenderName}
            showAvatar={showAvatar}
            isConsecutive={isConsecutive}
            isNextConsecutive={isNextConsecutive}
            onReply={handleReplyMessage}
            onForward={handleForwardMessage}
            onEdit={handleEditMessage}
            onRecall={handleRecallMessage}
            onPin={handlePinMessage}
            onReact={handleReactMessage}
          />
        </View>
      );
    },
    [
      user?.id,
      messages,
      formatMessageTime,
      shouldShowDateDivider,
      formatDateDivider,
      handleReplyMessage,
      handleForwardMessage,
      handleEditMessage,
      handleRecallMessage,
      handlePinMessage,
      handleReactMessage,
    ]
  );

  const getRoomTitle = () => {
    if (!currentRoom) return 'Hội thoại';
    if (currentRoom.isGroup) {
      return currentRoom.name || 'Nhóm không tên';
    }
    const otherParticipant = currentRoom.participants?.find(
      (p) => String(p.userId || p.user?.id) !== String(user?.id)
    );
    return otherParticipant?.user?.fullName || otherParticipant?.user?.username || 'Hội thoại';
  };

  const title = getRoomTitle();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F8FAFC' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.select({
        ios: 0,
        android: 0,
      })}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#E2E8F0',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: '#F1F5F9',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => id && router.push(`/chat/${id}/info` as any)}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
        >
          {/* Avatar Icon chuẩn Web ERP (Messenger style cho nhóm, Cam Getvini cho 1-1) */}
          <RoomAvatar
            room={currentRoom}
            selfUserId={user?.id}
            allUsers={allUsers}
            size="md"
            isOnline={isOtherOnline}
          />

          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
              {title}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 11, color: roomTypingList.length > 0 ? BrandColors.primary : '#64748B' }}>
              {roomTypingList.length > 0
                ? `${roomTypingList.join(', ')} đang soạn tin...`
                : currentRoom?.isGroup
                ? `${currentRoom.participants?.length || 0} thành viên`
                : isOtherOnline
                ? 'Đang hoạt động'
                : 'Hoạt động gần đây'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Right Action Buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Nút Tìm Kiếm Tin Nhắn */}
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setIsSearchingInRoom(!isSearchingInRoom);
              if (isSearchingInRoom) {
                setSearchKeyword('');
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isSearchingInRoom ? '#FFF7ED' : '#F8FAFC',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: isSearchingInRoom ? '#FED7AA' : '#E2E8F0',
            }}
          >
            <Feather
              name="search"
              size={17}
              color={isSearchingInRoom ? BrandColors.primary : '#64748B'}
            />
          </TouchableOpacity>

          {currentRoom?.isGroup && (
            <TouchableOpacity
              onPress={() => setShowMembersModal(true)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: '#FFF7ED',
                borderWidth: 1,
                borderColor: '#FED7AA',
              }}
            >
              <Feather name="users" size={14} color={BrandColors.primary} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: BrandColors.primary }}>
                {currentRoom.participants?.length || 0}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => id && router.push(`/chat/${id}/info` as any)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#F8FAFC',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Feather name="info" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* In-room Search Bar */}
      {isSearchingInRoom && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderBottomWidth: 1,
            borderBottomColor: '#E2E8F0',
            paddingHorizontal: 12,
            paddingVertical: 8,
            gap: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F1F5F9',
              borderRadius: 10,
              paddingHorizontal: 10,
              height: 38,
            }}
          >
            <Feather name="search" size={16} color="#94A3B8" />
            <TextInput
              style={{ flex: 1, marginLeft: 8, fontSize: 13, color: '#0F172A' }}
              placeholder="Tìm kiếm nội dung tin nhắn..."
              placeholderTextColor="#94A3B8"
              value={searchKeyword}
              onChangeText={(text) => {
                setSearchKeyword(text);
                setSearchMatchIndex(0);
              }}
              autoFocus
            />
            {searchKeyword.length > 0 && (
              <TouchableOpacity onPress={() => setSearchKeyword('')}>
                <Feather name="x-circle" size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {searchKeyword.trim().length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 11, color: '#64748B', marginRight: 2 }}>
                {searchMatchingIndices.length > 0
                  ? `${searchMatchIndex + 1}/${searchMatchingIndices.length}`
                  : '0/0'}
              </Text>
              <TouchableOpacity
                onPress={handlePrevSearchMatch}
                disabled={searchMatchingIndices.length === 0}
                style={{ padding: 6, borderRadius: 6, backgroundColor: '#F8FAFC' }}
              >
                <Feather name="chevron-up" size={16} color="#64748B" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNextSearchMatch}
                disabled={searchMatchingIndices.length === 0}
                style={{ padding: 6, borderRadius: 6, backgroundColor: '#F8FAFC' }}
              >
                <Feather name="chevron-down" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={() => {
              setIsSearchingInRoom(false);
              setSearchKeyword('');
            }}
            style={{ padding: 6 }}
          >
            <Feather name="x" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>
      )}

      {/* Pinned Messages Banner */}
      <PinnedMessageBanner
        pinnedMessages={roomPinnedMessages}
        onPressBanner={handleScrollToMessage}
        onOpenList={() => setShowPinnedModal(true)}
      />

      {/* Messages List */}
      {loadingMessages && messages.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text style={{ marginTop: 12, fontSize: 13, color: '#64748B' }}>
            Đang tải tin nhắn...
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingVertical: 14 }}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          updateCellsBatchingPeriod={50}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            currentRoom?.isGroup ? (
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: 16,
                  paddingBottom: 16,
                  paddingHorizontal: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#1E293B',
                    textAlign: 'center',
                    marginBottom: 14,
                  }}
                >
                  {user?.id && currentRoom?.creatorId && String(currentRoom.creatorId) === String(user.id)
                    ? 'Bạn đã tạo nhóm này'
                    : `${
                        currentRoom?.participants?.find((p) => String(p.userId) === String(currentRoom?.creatorId))
                          ?.user?.fullName ||
                        currentRoom?.participants?.find((p) => String(p.userId) === String(currentRoom?.creatorId))
                          ?.user?.username ||
                        'Ai đó'
                      } đã tạo nhóm này`}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 32,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setShowMembersModal(true)}
                    activeOpacity={0.7}
                    style={{ alignItems: 'center', gap: 6 }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: '#F1F5F9',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                      }}
                    >
                      <Feather name="user-plus" size={18} color="#475569" />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: '#475569' }}>
                      Thêm
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowRenameModal(true)}
                    activeOpacity={0.7}
                    style={{ alignItems: 'center', gap: 6 }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: '#F1F5F9',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                      }}
                    >
                      <Feather name="edit-2" size={18} color="#475569" />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: '#475569' }}>
                      Tên
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
              <MaterialIcons name="forum" size={44} color="#CBD5E1" />
              <Text style={{ marginTop: 10, fontSize: 14, fontWeight: '600', color: '#64748B' }}>
                Bắt đầu trò chuyện trong phòng này
              </Text>
              <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                Gõ # để tag công việc hoặc @ để nhắc tên đồng nghiệp
              </Text>
            </View>
          }
          renderItem={renderMessageItem}
        />
      )}

      {/* Autocomplete Suggestion Popup (khi gõ # hoặc @) */}
      {autocompleteState && autocompleteState.items.length > 0 && (
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: '#E2E8F0',
            maxHeight: 180,
            paddingVertical: 4,
          }}
        >
          <View style={{ paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#F8FAFC' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>
              {autocompleteState.type === 'TASK' ? 'GỢI Ý CÔNG VIỆC (#)' : 'GỢI Ý ĐỒNG NGHIỆP (@)'}
            </Text>
          </View>
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={autocompleteState.items}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item }: { item: any }) => {
              const isTask = autocompleteState.type === 'TASK';
              const name = isTask ? item.name : (item.fullName || item.username);
              const sub = isTask ? (item.code || item.project?.name || 'Công việc') : (item.role || 'Thành viên');

              return (
                <TouchableOpacity
                  onPress={() => isTask ? handleSelectTaskToken(item) : handleSelectUserToken(item)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F1F5F9',
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: isTask ? '#FFF7ED' : '#EFF6FF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather
                      name={isTask ? 'check-square' : 'at-sign'}
                      size={14}
                      color={isTask ? '#F38820' : '#2563EB'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>
                      {name}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 11, color: '#64748B' }}>
                      {sub}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* Attached Files & Images Preview Bar */}
      {attachedFiles.length > 0 && (
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E2E8F0',
            paddingTop: 8,
            paddingBottom: 6,
          }}
        >
          {/* Header xem trước tệp */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 14,
              marginBottom: 4,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>
              TỆP ĐÍNH KÈM ({attachedFiles.length}/10)
            </Text>
            <TouchableOpacity
              onPress={() => setAttachedFiles([])}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '600' }}>
                Xóa tất cả
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={attachedFiles}
            keyExtractor={(_, i) => String(i)}
            style={{ overflow: 'visible' }}
            contentContainerStyle={{
              paddingHorizontal: 14,
              paddingTop: 10,
              paddingBottom: 8,
              gap: 12,
              alignItems: 'center',
            }}
            renderItem={({ item, index }) => {
              if (item.isImage) {
                return (
                  <View style={{ position: 'relative' }}>
                    <Image
                      source={{ uri: item.uri }}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 10,
                        backgroundColor: '#F1F5F9',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                      }}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() => handleRemoveFile(index)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: '#EF4444',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: '#FFFFFF',
                        elevation: 3,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.2,
                        shadowRadius: 2,
                        zIndex: 10,
                      }}
                    >
                      <Feather name="x" size={11} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                );
              }

              const docColor = getDocFileColor(item.name);
              return (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: '#F8FAFC',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    minWidth: 160,
                    maxWidth: 220,
                    position: 'relative',
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      backgroundColor: docColor.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Feather name={docColor.icon} size={18} color={docColor.color} />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: '#0F172A' }}>
                      {item.name}
                    </Text>
                    {Boolean(item.size) && (
                      <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                        {formatBytes(item.size)}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveFile(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: '#EF4444',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: '#FFFFFF',
                      elevation: 3,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.2,
                      shadowRadius: 2,
                      zIndex: 10,
                    }}
                  >
                    <Feather name="x" size={11} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* Thanh hiển thị Đang chỉnh sửa tin nhắn */}
      {editingMessage && (
        <View
          style={{
            backgroundColor: '#F0FDF4',
            borderTopWidth: 1,
            borderTopColor: '#BBF7D0',
            borderLeftWidth: 4,
            borderLeftColor: '#16A34A',
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Feather name="edit-2" size={15} color="#16A34A" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#16A34A' }}>
                ĐANG CHỈNH SỬA TIN NHẮN
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 12, color: '#334155' }}>
                {editingMessage.content}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              setEditingMessage(null);
              setInputContent('');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: '#DCFCE7',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="x" size={13} color="#16A34A" />
          </TouchableOpacity>
        </View>
      )}

      {/* Thanh hiển thị Đang trả lời tin nhắn (Quote Reply Bar) */}
      {replyingToMessage && (
        <View
          style={{
            backgroundColor: '#F8FAFC',
            borderTopWidth: 1,
            borderTopColor: '#E2E8F0',
            borderLeftWidth: 4,
            borderLeftColor: BrandColors.primary,
            paddingHorizontal: 12,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Feather name="corner-up-left" size={15} color={BrandColors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: BrandColors.primary }}>
                Đang trả lời {replyingToMessage.sender?.fullName || replyingToMessage.sender?.username || 'Tin nhắn'}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 12, color: '#475569' }}>
                {replyingToMessage.content || (replyingToMessage.attachments?.length ? '[Tệp đính kèm]' : '...')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setReplyingToMessage(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="x" size={13} color="#64748B" />
          </TouchableOpacity>
        </View>
      )}

      {/* Voice Recorder Bar hoặc Bottom Input Bar */}
      {isRecordingVoice ? (
        <VoiceRecorderBar
          onSendAudio={handleSendAudio}
          onCancel={() => setIsRecordingVoice(false)}
        />
      ) : (
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#F1F5F9',
            paddingHorizontal: 8,
            paddingTop: 6,
            paddingBottom: showEmojiPicker ? 4 : (isKeyboardVisible ? 6 : Math.max(insets.bottom, 8)),
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {/* Nút Chụp Ảnh Camera Hiện Trường */}
          <TouchableOpacity
            onPress={handleCamera}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="camera" size={19} color={BrandColors.primary} />
          </TouchableOpacity>

          {/* Nút Chọn Ảnh Thư Viện */}
          <TouchableOpacity
            onPress={handlePickImage}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="image" size={19} color={BrandColors.primary} />
          </TouchableOpacity>

          {/* Nút Đính Kèm Tệp Tài Liệu */}
          <TouchableOpacity
            onPress={handlePickDocument}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="paperclip" size={19} color={BrandColors.primary} />
          </TouchableOpacity>

          {/* Nút Ghi Âm Giọng Nói (Voice Note) */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setIsRecordingVoice(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="mic" size={19} color={BrandColors.primary} />
          </TouchableOpacity>

          {/* Ô nhập tin nhắn dạng Capsule kiểu Messenger */}
          <View
            style={{
              flex: 1,
              minHeight: 36,
              maxHeight: 96,
              backgroundColor: '#F1F5F9',
              borderRadius: 18,
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: 12,
              paddingRight: 6,
              marginHorizontal: 3,
            }}
          >
            <TextInput
              value={inputContent}
              onChangeText={handleInputChange}
              onFocus={() => {
                setShowEmojiPicker(false);
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 120);
              }}
              placeholder="Nhắn tin... (@ tag, # task)"
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={1000}
              style={{
                flex: 1,
                paddingVertical: Platform.OS === 'ios' ? 6 : 2,
                fontSize: 14,
                lineHeight: 19,
                color: '#0F172A',
              }}
            />

            {/* Nút Emoji (Mặt cười) bên phải trong ô input */}
            <TouchableOpacity
              onPress={handleToggleEmojiPicker}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: showEmojiPicker ? '#FFEDD5' : 'transparent',
              }}
            >
              <Feather
                name="smile"
                size={20}
                color={BrandColors.primary}
              />
            </TouchableOpacity>
          </View>

          {/* Nút gửi hoặc Thích nhanh 👍 theo Messenger */}
          {inputContent.trim() || attachedFiles.length > 0 ? (
            <TouchableOpacity
              onPress={handleSend}
              disabled={isUploading}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: BrandColors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="send" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleQuickLike}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 20 }}>👍</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Khay chọn Emoji */}
      <ChatEmojiPicker
        visible={showEmojiPicker}
        onSelectEmoji={handleSelectEmoji}
        onBackspace={handleBackspaceEmoji}
        onClose={() => setShowEmojiPicker(false)}
      />

      {/* Modal Quản Lý Thành Viên Nhóm Chat */}
      <ChatAddMembersModal
        visible={showMembersModal}
        room={currentRoom || null}
        onClose={() => setShowMembersModal(false)}
        onUpdated={() => fetchRooms()}
      />

      {/* Modal Đổi Tên Nhóm Chat */}
      <ChatRenameModal
        visible={showRenameModal}
        room={currentRoom || null}
        onClose={() => setShowRenameModal(false)}
        onSuccess={() => fetchRooms()}
      />

      {/* Modal Danh Sách Tin Nhắn Đã Ghim */}
      <PinnedMessagesModal
        visible={showPinnedModal}
        pinnedMessages={roomPinnedMessages}
        onClose={() => setShowPinnedModal(false)}
        onSelectMessage={handleScrollToMessage}
        onUnpin={(msg) => id && pinMessage(id, msg.id, false)}
      />

      {/* Modal Chuyển Tiếp Tin Nhắn */}
      <ChatForwardModal
        visible={Boolean(forwardingMessage)}
        message={forwardingMessage}
        currentRoomId={String(id)}
        onClose={() => setForwardingMessage(null)}
        onSuccess={() => setForwardingMessage(null)}
      />
    </KeyboardAvoidingView>
  );
}
