import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface ReactionItem {
  emoji: string;
  count?: number;
  userId?: string;
  user?: {
    id: string;
    fullName?: string;
    username?: string;
    avatarUrl?: string;
  };
}

interface ChatMessageReactionsBadgeProps {
  reactions?: ReactionItem[];
  selfUserId?: string | null;
  isMe: boolean;
  onPressReactEmoji?: (emoji: string) => void;
}

const ChatMessageReactionsBadgeComponent: React.FC<ChatMessageReactionsBadgeProps> = ({
  reactions,
  selfUserId,
  isMe,
  onPressReactEmoji,
}) => {
  const insets = useSafeAreaInsets();
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFilterEmoji, setSelectedFilterEmoji] = useState<string>('ALL');

  const grouped = useMemo(() => {
    if (!reactions || !Array.isArray(reactions) || reactions.length === 0) return [];
    const map: Record<
      string,
      { emoji: string; count: number; users: Array<{ name: string; avatarUrl?: string }>; hasMe: boolean }
    > = {};

    reactions.forEach((r) => {
      if (!r || !r.emoji) return;
      if (!map[r.emoji]) {
        map[r.emoji] = { emoji: r.emoji, count: 0, users: [], hasMe: false };
      }
      const count = Number(r.count) || 1;
      map[r.emoji].count += count;
      const name = r.user?.fullName || r.user?.username || 'Thành viên';
      map[r.emoji].users.push({ name, avatarUrl: r.user?.avatarUrl });
      if (String(r.userId) === String(selfUserId)) {
        map[r.emoji].hasMe = true;
      }
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [reactions, selfUserId]);

  if (grouped.length === 0) return null;

  const totalCount = grouped.reduce((sum, g) => sum + g.count, 0);

  // Danh sách người dùng để hiển thị trong modal
  const filteredUsers = useMemo(() => {
    if (!reactions) return [];
    if (selectedFilterEmoji === 'ALL') {
      return reactions.map((r) => ({
        emoji: r.emoji,
        name: r.user?.fullName || r.user?.username || 'Thành viên',
        avatarUrl: r.user?.avatarUrl,
        isMe: String(r.userId) === String(selfUserId),
      }));
    }
    return reactions
      .filter((r) => r.emoji === selectedFilterEmoji)
      .map((r) => ({
        emoji: r.emoji,
        name: r.user?.fullName || r.user?.username || 'Thành viên',
        avatarUrl: r.user?.avatarUrl,
        isMe: String(r.userId) === String(selfUserId),
      }));
  }, [reactions, selectedFilterEmoji, selfUserId]);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setShowDetailModal(true);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          paddingHorizontal: 6,
          paddingVertical: 2.5,
          borderWidth: 1,
          borderColor: '#E2E8F0',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
          marginTop: -8,
          alignSelf: isMe ? 'flex-end' : 'flex-start',
          marginRight: isMe ? 4 : 0,
          marginLeft: isMe ? 0 : 4,
          zIndex: 5,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {grouped.slice(0, 3).map((g) => (
            <Text key={g.emoji} style={{ fontSize: 13, marginRight: -2 }}>
              {g.emoji}
            </Text>
          ))}
        </View>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginLeft: 4 }}>
          {totalCount}
        </Text>
      </TouchableOpacity>

      {/* Modal Danh sách chi tiết người thả cảm xúc */}
      <Modal visible={showDetailModal} transparent animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '60%',
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 16),
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#CBD5E1',
                alignSelf: 'center',
                marginBottom: 12,
              }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>Cảm xúc tin nhắn</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10 }}>
              <TouchableOpacity
                onPress={() => setSelectedFilterEmoji('ALL')}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 14,
                  backgroundColor: selectedFilterEmoji === 'ALL' ? '#FFF7ED' : '#F1F5F9',
                  borderWidth: 1,
                  borderColor: selectedFilterEmoji === 'ALL' ? '#F97316' : 'transparent',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: selectedFilterEmoji === 'ALL' ? '#EA580C' : '#64748B' }}>
                  Tất cả {totalCount}
                </Text>
              </TouchableOpacity>
              {grouped.map((g) => (
                <TouchableOpacity
                  key={g.emoji}
                  onPress={() => setSelectedFilterEmoji(g.emoji)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 14,
                    backgroundColor: selectedFilterEmoji === g.emoji ? '#FFF7ED' : '#F1F5F9',
                    borderWidth: 1,
                    borderColor: selectedFilterEmoji === g.emoji ? '#F97316' : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 13 }}>{g.emoji}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: selectedFilterEmoji === g.emoji ? '#EA580C' : '#64748B' }}>
                    {g.count}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* User List */}
            <FlatList
              data={filteredUsers}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
              renderItem={({ item }) => (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: '#EFF6FF',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {item.avatarUrl ? (
                        <Image source={{ uri: item.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 17 }} />
                      ) : (
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563EB' }}>
                          {item.name.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#0F172A' }}>
                      {item.isMe ? `${item.name} (Bạn)` : item.name}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

export const ChatMessageReactionsBadge = React.memo(ChatMessageReactionsBadgeComponent);
