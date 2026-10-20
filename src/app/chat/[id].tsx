import React, { useEffect, useState, useRef, useMemo } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useChatStore } from '@/stores/useChatStore';
import { useAuth } from '@/context/AuthContext';
import { ChatMessage, chatService } from '@/services/chatService';
import { BrandColors } from '@/constants/colors';
import { ChatMessageItem } from '@/components/chat/ChatMessageItem';
import { ChatAddMembersModal } from '@/components/chat/ChatAddMembersModal';
import { useTasksQuery } from '@/hooks/queries/useTasks';
import { useUsersQuery } from '@/hooks/queries/useUsers';
import { UserItem } from '@/services/userService';
import { buildTaskToken, buildUserToken, buildAllToken } from '@/utils/chatTokenHelper';

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [inputContent, setInputContent] = useState('');
  const [attachedImages, setAttachedImages] = useState<{ uri: string; name?: string; type?: string }[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  const rooms = useChatStore((s) => s.rooms);
  const messagesMap = useChatStore((s) => s.messages);
  const loadingMessages = useChatStore((s) => s.loadingMessages);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const isConnected = useChatStore((s) => s.isConnected);
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const selectRoom = useChatStore((s) => s.selectRoom);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const sendTyping = useChatStore((s) => s.sendTyping);
  const fetchRooms = useChatStore((s) => s.fetchRooms);

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
    const token = buildTaskToken(task.id, task.name || task.code || 'Task');
    const replaced = inputContent.replace(/#([a-zA-Z0-9_\-\s]*)$/, `${token} `);
    setInputContent(replaced);
  };

  const handleSelectUserToken = (targetUser: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const token = targetUser.isAll
      ? buildAllToken()
      : buildUserToken(targetUser.id, targetUser.fullName || targetUser.username || 'User');
    const replaced = inputContent.replace(/@([a-zA-Z0-9_\-\s]*)$/, `${token} `);
    setInputContent(replaced);
  };

  const handleInputChange = (text: string) => {
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
        const compressedUri = await processImage(res.assets[0].uri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setAttachedImages((prev) => [
          ...prev,
          {
            uri: compressedUri,
            name: `Ảnh_Hiện_Trường_${Date.now()}.jpg`,
            type: 'image/jpeg',
          },
        ]);
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể chụp ảnh từ Camera.');
    }
  };

  const handlePickImage = async () => {
    try {
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
        for (const asset of res.assets) {
          const compressedUri = await processImage(asset.uri);
          setAttachedImages((prev) => [
            ...prev,
            {
              uri: compressedUri,
              name: asset.fileName || `Ảnh_${Date.now()}.jpg`,
              type: 'image/jpeg',
            },
          ]);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể chọn ảnh từ thư viện.');
    }
  };

  const handleRemoveImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    const trimmed = inputContent.trim();
    if ((!trimmed && attachedImages.length === 0) || !id) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInputContent('');
    const toSendImages = [...attachedImages];
    setAttachedImages([]);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      sendTyping(id, false);
    }

    // Gửi tin nhắn kèm attachments
    try {
      setIsUploadingImage(true);
      const attachmentsPayload: any[] = [];

      for (const img of toSendImages) {
        const formData = new FormData();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (formData as any).append('file', {
          uri: img.uri,
          name: img.name || 'image.jpg',
          type: img.type || 'image/jpeg',
        });

        try {
          const uploadRes = await chatService.uploadChatAttachment(formData);
          if (uploadRes.data?.url) {
            attachmentsPayload.push({
              url: uploadRes.data.url,
              name: img.name,
              type: 'image/jpeg',
            });
          } else {
            // fallback gửi uri trực tiếp
            attachmentsPayload.push({
              url: img.uri,
              name: img.name,
              type: 'image/jpeg',
            });
          }
        } catch {
          attachmentsPayload.push({
            url: img.uri,
            name: img.name,
            type: 'image/jpeg',
          });
        }
      }

      await sendMessage(id, trimmed, attachmentsPayload);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
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
            }}
          >
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>

          {/* Avatar Icon */}
          <View style={{ position: 'relative' }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: currentRoom?.isGroup ? '#EFF6FF' : '#FFF7ED',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: currentRoom?.isGroup ? '#DBEAFE' : '#FFEDD5',
                overflow: 'hidden',
              }}
            >
              {currentRoom?.isGroup ? (
                <Feather name="users" size={17} color="#3B82F6" />
              ) : (currentRoom?.avatarUrl || otherParticipant?.user?.avatarUrl) ? (
                <Image
                  source={{ uri: currentRoom?.avatarUrl || otherParticipant?.user?.avatarUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '800', color: BrandColors.primary }}>
                  {title.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            {/* Online Status Dot */}
            {!currentRoom?.isGroup && isOtherOnline && (
              <View
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 11,
                  height: 11,
                  borderRadius: 6,
                  backgroundColor: '#10B981',
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                }}
              />
            )}
          </View>

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
        </View>

        {/* Nút xem/thêm thành viên nhóm khi là nhóm chat */}
        {currentRoom?.isGroup && (
          <TouchableOpacity
            onPress={() => setShowMembersModal(true)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: '#EFF6FF',
              borderWidth: 1,
              borderColor: '#BFDBFE',
            }}
          >
            <Feather name="users" size={14} color="#2563EB" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>
              {currentRoom.participants?.length || 0}
            </Text>
          </TouchableOpacity>
        )}
      </View>

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
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 14 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
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
          renderItem={({ item }: { item: ChatMessage }) => {
            const isMe = String(item.senderId) === String(user?.id);
            return (
              <ChatMessageItem
                message={item}
                isMe={isMe}
                selfUserId={user?.id}
                formatTime={formatMessageTime}
              />
            );
          }}
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

      {/* Attached Images Preview Bar */}
      {attachedImages.length > 0 && (
        <View
          style={{
            backgroundColor: '#FFFFFF',
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderTopWidth: 1,
            borderTopColor: '#F1F5F9',
          }}
        >
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={attachedImages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item, index }) => (
              <View style={{ position: 'relative' }}>
                <Image
                  source={{ uri: item.uri }}
                  style={{ width: 60, height: 60, borderRadius: 8 }}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => handleRemoveImage(index)}
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: '#EF4444',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather name="x" size={11} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      )}

      {/* Bottom Input Bar */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 12),
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {/* Nút Chụp Ảnh Camera Hiện Trường */}
        <TouchableOpacity
          onPress={handleCamera}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#F8FAFC',
            borderWidth: 1,
            borderColor: '#E2E8F0',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="camera" size={17} color="#475569" />
        </TouchableOpacity>

        {/* Nút Chọn Ảnh Thư Viện */}
        <TouchableOpacity
          onPress={handlePickImage}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#F8FAFC',
            borderWidth: 1,
            borderColor: '#E2E8F0',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="image" size={17} color="#475569" />
        </TouchableOpacity>

        {/* Ô nhập tin nhắn */}
        <TextInput
          value={inputContent}
          onChangeText={handleInputChange}
          placeholder="Nhập tin nhắn... (gõ # hoặc @)"
          placeholderTextColor="#94A3B8"
          multiline
          maxLength={1000}
          style={{
            flex: 1,
            minHeight: 40,
            maxHeight: 100,
            backgroundColor: '#F1F5F9',
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 10,
            fontSize: 14,
            color: '#0F172A',
          }}
        />

        {/* Nút gửi */}
        <TouchableOpacity
          onPress={handleSend}
          disabled={(!inputContent.trim() && attachedImages.length === 0) || isUploadingImage}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor:
              (inputContent.trim() || attachedImages.length > 0) && !isUploadingImage
                ? BrandColors.primary
                : '#E2E8F0',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isUploadingImage ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather
              name="send"
              size={18}
              color={inputContent.trim() || attachedImages.length > 0 ? '#FFFFFF' : '#94A3B8'}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Modal Quản Lý Thành Viên Nhóm Chat */}
      <ChatAddMembersModal
        visible={showMembersModal}
        room={currentRoom || null}
        onClose={() => setShowMembersModal(false)}
        onUpdated={() => fetchRooms()}
      />
    </KeyboardAvoidingView>
  );
}
