import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useChatStore } from '@/stores/useChatStore';
import { BrandColors } from '@/constants/colors';

const BUBBLE_SIZE = 54;
const STORAGE_KEY = 'erp_floating_bubble_pos';

export const FloatingChatBubble: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const rooms = useChatStore((s) => s.rooms);
  const totalUnreadChats = rooms.reduce(
    (sum, r) => sum + (r.unread ? r.unreadCount || 1 : 0),
    0
  );

  // Vùng biên an toàn cho tọa độ kéo thả
  const minX = insets.left + 12;
  const maxX = screenWidth - insets.right - BUBBLE_SIZE - 12;
  const minY = Math.max(insets.top + 16, 40);
  const maxY = screenHeight - insets.bottom - BUBBLE_SIZE - 80; // Tránh thanh bottom tab

  const translateX = useSharedValue(maxX);
  const translateY = useSharedValue(maxY - 40);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const [isReady, setIsReady] = useState(false);

  // 1. Phục hồi vị trí bong bóng đã lưu từ AsyncStorage
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && isMounted) {
          const { x, y } = JSON.parse(saved);
          const clampedX = Math.max(minX, Math.min(x, maxX));
          const clampedY = Math.max(minY, Math.min(y, maxY));
          translateX.value = clampedX;
          translateY.value = clampedY;
        } else if (isMounted) {
          translateX.value = maxX;
          translateY.value = maxY - 40;
        }
      } catch {
        // Fallback default
      } finally {
        if (isMounted) setIsReady(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [screenWidth, screenHeight, minX, maxX, minY, maxY, translateX, translateY]);

  // 2. Lưu vị trí sau khi thả tay
  const persistPosition = (x: number, y: number) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y })).catch(() => {});
  };

  // 3. Xử lý chạm mở trang chat
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/chat' as any);
  };

  // 4. Định nghĩa cử chỉ Pan (Kéo thả trên UI Thread)
  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      isDragging.value = true;
    })
    .onUpdate((e) => {
      const nextX = startX.value + e.translationX;
      const nextY = startY.value + e.translationY;
      translateX.value = Math.max(minX - 10, Math.min(nextX, maxX + 10));
      translateY.value = Math.max(minY, Math.min(nextY, maxY));
    })
    .onEnd(() => {
      isDragging.value = false;
      // Snap-to-edge: Tự hút vào mép trái hoặc mép phải gần nhất
      const midPoint = (minX + maxX) / 2;
      const targetX = translateX.value < midPoint ? minX : maxX;
      const targetY = Math.max(minY, Math.min(translateY.value, maxY));

      translateX.value = withSpring(targetX, {
        damping: 18,
        stiffness: 180,
        mass: 0.8,
      });
      translateY.value = withSpring(targetY, {
        damping: 18,
        stiffness: 180,
      });

      runOnJS(persistPosition)(targetX, targetY);
    });

  // 5. Định nghĩa cử chỉ Tap
  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handlePress)();
  });

  // Kết hợp Race để phân biệt rạch ròi giữa Tap và Pan (không bị nhầm lẫn)
  const composedGesture = Gesture.Race(panGesture, tapGesture);

  // 6. Quy tắc ẩn bong bóng theo Route
  // Ẩn khi chưa đăng nhập, hoặc đang ở trong phòng chat / danh sách chat / màn hình auth
  const isHiddenRoute =
    !user ||
    pathname.startsWith('/chat') ||
    pathname.startsWith('/(auth)') ||
    pathname === '/login';

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: withTiming(isHiddenRoute || !isReady ? 0 : isDragging.value ? 1.08 : 1, { duration: 150 }) },
      ],
      opacity: withTiming(isHiddenRoute || !isReady ? 0 : 1, { duration: 150 }),
    };
  });

  if (isHiddenRoute && !isReady) {
    return null;
  }

  return (
    <View style={styles.portalContainer} pointerEvents="box-none">
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.bubble, animatedStyle]}>
          <Feather name="message-circle" size={24} color="#FFFFFF" />

          {/* Badge đếm số tin nhắn chưa đọc realtime */}
          {totalUnreadChats > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {totalUnreadChats > 99 ? '99+' : totalUnreadChats}
              </Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  portalContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    elevation: 99999,
  },
  bubble: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BrandColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
});
