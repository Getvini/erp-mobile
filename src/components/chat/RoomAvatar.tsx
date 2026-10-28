import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BrandColors } from '@/constants/colors';
import { ChatRoom } from '@/services/chatService';

interface RoomAvatarProps {
  room?: ChatRoom | null;
  user?: { id?: string; fullName?: string; username?: string; avatarUrl?: string } | null;
  selfUserId?: string | null;
  allUsers?: Array<{ id: string; fullName?: string; username?: string; avatarUrl?: string }>;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
}

const SIZE_CONFIGS = {
  sm: {
    container: 32,
    mini: 21,
    miniText: 10,
    border: 1.5,
    icon: 14,
    singleText: 12,
    onlineDot: 9,
  },
  md: {
    container: 38,
    mini: 25,
    miniText: 11,
    border: 2,
    icon: 17,
    singleText: 14,
    onlineDot: 11,
  },
  lg: {
    container: 46,
    mini: 30,
    miniText: 12,
    border: 2,
    icon: 20,
    singleText: 17,
    onlineDot: 13,
  },
  xl: {
    container: 64,
    mini: 42,
    miniText: 15,
    border: 2.5,
    icon: 26,
    singleText: 22,
    onlineDot: 16,
  },
};

/**
 * SingleAvatarItem: Hiển thị 1 avatar bo tròn
 * - Nếu có ảnh hợp lệ: Hiện ảnh đại diện
 * - Nếu không có ảnh: Hiển thị Nền cam nhạt (#FFEDD5), Chữ cam đậm (#F38820) font-black đồng bộ với Web ERP
 */
const SingleAvatarItem: React.FC<{
  src?: string | null;
  name?: string | null;
  size: number;
  fontSize: number;
  borderWidth?: number;
  borderColor?: string;
}> = ({ src, name, size, fontSize, borderWidth = 1, borderColor = '#FED7AA' }) => {
  const [hasError, setHasError] = useState(false);
  const initial = (name ? name.trim()[0] : 'U')?.toUpperCase() || 'U';

  if (src && !hasError) {
    return (
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor,
          },
        ]}
      >
        <Image
          source={{ uri: src }}
          onError={() => setHasError(true)}
          style={{ width: '100%', height: '100%', borderRadius: size / 2 }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#FFEDD5',
          borderWidth,
          borderColor,
        },
      ]}
    >
      <Text
        style={{
          fontSize,
          fontWeight: '900',
          color: BrandColors.primary,
        }}
      >
        {initial}
      </Text>
    </View>
  );
};

export const RoomAvatar: React.FC<RoomAvatarProps> = ({
  room,
  user,
  selfUserId,
  allUsers = [],
  size = 'lg',
  isOnline = false,
}) => {
  const config = SIZE_CONFIGS[size] || SIZE_CONFIGS.lg;

  // 1. Trường hợp là User liên hệ trực tiếp (khi tìm kiếm danh bạ hoặc màn danh bạ)
  if (user && !room) {
    const name = user.fullName || user.username || 'User';
    return (
      <View style={{ position: 'relative', width: config.container, height: config.container }}>
        <SingleAvatarItem
          src={user.avatarUrl}
          name={name}
          size={config.container}
          fontSize={config.singleText}
        />
        {isOnline && <OnlineBadge dotSize={config.onlineDot} />}
      </View>
    );
  }

  if (!room) {
    return (
      <View
        style={[
          styles.circle,
          {
            width: config.container,
            height: config.container,
            borderRadius: config.container / 2,
            backgroundColor: '#FFEDD5',
            borderWidth: 1,
            borderColor: '#FED7AA',
          },
        ]}
      >
        <Feather name="users" size={config.icon} color={BrandColors.primary} />
      </View>
    );
  }

  // 2. Chat 1-1 (Direct Message)
  if (!room.isGroup) {
    let otherUser = user;
    if (!otherUser) {
      const participant = room.participants?.find((p) => String(p.userId) !== String(selfUserId));
      otherUser =
        participant?.user ||
        (allUsers.length && participant?.userId
          ? allUsers.find((u) => String(u.id) === String(participant.userId))
          : null);
    }

    const name = otherUser?.fullName || otherUser?.username || room.name || 'Chat';
    return (
      <View style={{ position: 'relative', width: config.container, height: config.container }}>
        <SingleAvatarItem
          src={otherUser?.avatarUrl}
          name={name}
          size={config.container}
          fontSize={config.singleText}
        />
        {isOnline && <OnlineBadge dotSize={config.onlineDot} />}
      </View>
    );
  }

  // 3. Nhóm chat CÓ ảnh đại diện tùy chỉnh (room.avatarUrl)
  if (room.avatarUrl) {
    return (
      <View style={{ position: 'relative', width: config.container, height: config.container }}>
        <SingleAvatarItem
          src={room.avatarUrl}
          name={room.name || 'Nhóm'}
          size={config.container}
          fontSize={config.singleText}
        />
      </View>
    );
  }

  // 4. Nhóm chat KHÔNG có avatar riêng:
  // -> Hiển thị 2 avatar lồng nhau chuẩn Facebook Messenger trên nền tone cam nhạt (#FFEDD5 / #F38820)
  const participants = room.participants || [];
  let memberList = participants
    .filter((p) => String(p.userId) !== String(selfUserId))
    .map((p) => p.user || allUsers.find((u) => String(u.id) === String(p.userId)) || { id: p.userId, fullName: 'Thành viên' });

  // Nếu nhóm chỉ có bản thân
  if (memberList.length === 0) {
    memberList = participants.map((p) => p.user || allUsers.find((u) => String(u.id) === String(p.userId)) || { id: p.userId, fullName: 'Thành viên' });
  }

  // Không có thành viên nào
  if (memberList.length === 0) {
    return (
      <View
        style={[
          styles.circle,
          {
            width: config.container,
            height: config.container,
            borderRadius: config.container / 2,
            backgroundColor: '#FFEDD5',
            borderWidth: 1,
            borderColor: '#FED7AA',
          },
        ]}
      >
        <Feather name="users" size={config.icon} color={BrandColors.primary} />
      </View>
    );
  }

  // Nếu chỉ có 1 thành viên khác
  if (memberList.length === 1) {
    const single = memberList[0];
    return (
      <View style={{ position: 'relative', width: config.container, height: config.container }}>
        <SingleAvatarItem
          src={single.avatarUrl}
          name={single.fullName || single.username}
          size={config.container}
          fontSize={config.singleText}
        />
      </View>
    );
  }

  // Từ 2 thành viên trở lên: Hiển thị 2 avatar lồng nhau kiểu Messenger
  const member1 = memberList[0]; // Góc trên - bên phải
  const member2 = memberList[1]; // Góc dưới - bên trái (đè lên với viền trắng nổi)

  return (
    <View style={{ position: 'relative', width: config.container, height: config.container }}>
      {/* Thành viên 1: Nằm ở phía trên - bên phải */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          zIndex: 1,
        }}
      >
        <SingleAvatarItem
          src={member1?.avatarUrl}
          name={member1?.fullName || member1?.username}
          size={config.mini}
          fontSize={config.miniText}
        />
      </View>

      {/* Thành viên 2: Nằm ở phía dưới - bên trái, đè lên với viền trắng nổi */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          zIndex: 2,
        }}
      >
        <SingleAvatarItem
          src={member2?.avatarUrl}
          name={member2?.fullName || member2?.username}
          size={config.mini}
          fontSize={config.miniText}
          borderWidth={config.border}
          borderColor="#FFFFFF"
        />
      </View>
    </View>
  );
};

const OnlineBadge: React.FC<{ dotSize: number }> = ({ dotSize }) => (
  <View
    style={{
      position: 'absolute',
      bottom: -1,
      right: -1,
      width: dotSize,
      height: dotSize,
      borderRadius: dotSize / 2,
      backgroundColor: '#10B981',
      borderWidth: 2,
      borderColor: '#FFFFFF',
      zIndex: 10,
    }}
  />
);

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default RoomAvatar;
