import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

interface DashboardFABProps {
  userRole?: string;
}

const BUTTON_SIZE = 56;
const EDGE_MARGIN = 16;
const STORAGE_KEY = '@erp_dashboard_fab_pos';

export function DashboardFAB({ userRole }: DashboardFABProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Screen bounds
  const minX = insets.left + EDGE_MARGIN;
  const maxX = screenWidth - insets.right - BUTTON_SIZE - EDGE_MARGIN;
  const minY = insets.top + 50;
  const maxY = screenHeight - insets.bottom - 75 - BUTTON_SIZE;

  // Default initial position (bottom right)
  const defaultX = Math.max(minX, maxX);
  const defaultY = Math.max(minY, maxY);

  const translateX = useSharedValue(defaultX);
  const translateY = useSharedValue(defaultY);
  const startX = useSharedValue(defaultX);
  const startY = useSharedValue(defaultY);
  const scale = useSharedValue(1);

  const [fabCoords, setFabCoords] = useState({ x: defaultX, y: defaultY });

  const triggerHapticLight = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const persistPosition = useCallback((x: number, y: number) => {
    setFabCoords({ x, y });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y })).catch(() => {});
  }, []);

  const toggleOpen = useCallback(() => {
    triggerHapticLight();
    setIsOpen((prev) => !prev);
  }, [triggerHapticLight]);

  // Load saved position on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved) {
          try {
            const { x, y } = JSON.parse(saved);
            if (typeof x === 'number' && typeof y === 'number') {
              const clampedX = Math.max(minX, Math.min(maxX, x));
              const clampedY = Math.max(minY, Math.min(maxY, y));
              translateX.value = clampedX;
              translateY.value = clampedY;
              setFabCoords({ x: clampedX, y: clampedY });
            }
          } catch {}
        }
      })
      .catch(() => {});
  }, [minX, maxX, minY, maxY, translateX, translateY]);

  // Re-clamp position if screen rotates or dimensions change
  useEffect(() => {
    const curX = translateX.value;
    const curY = translateY.value;
    const clampedX = Math.max(minX, Math.min(maxX, curX));
    const clampedY = Math.max(minY, Math.min(maxY, curY));
    if (clampedX !== curX || clampedY !== curY) {
      translateX.value = clampedX;
      translateY.value = clampedY;
      setFabCoords({ x: clampedX, y: clampedY });
    }
  }, [screenWidth, screenHeight, minX, maxX, minY, maxY, translateX, translateY]);

  const panGesture = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      'worklet';
      startX.value = translateX.value;
      startY.value = translateY.value;
      scale.value = withSpring(1.12, { damping: 12 });
      runOnJS(triggerHapticLight)();
    })
    .onUpdate((e) => {
      'worklet';
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      'worklet';
      scale.value = withSpring(1, { damping: 12 });

      let targetX = Math.max(minX, Math.min(maxX, translateX.value));
      let targetY = Math.max(minY, Math.min(maxY, translateY.value));

      // Magnetic docking to edges if within 35px
      if (targetX < minX + 35) {
        targetX = minX;
      } else if (targetX > maxX - 35) {
        targetX = maxX;
      }

      translateX.value = withSpring(targetX, { damping: 14, stiffness: 120 });
      translateY.value = withSpring(targetY, { damping: 14, stiffness: 120 });

      runOnJS(persistPosition)(targetX, targetY);
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    'worklet';
    runOnJS(toggleOpen)();
  });

  const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 50,
    opacity: isOpen ? 0 : 1,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleAction = (path: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsOpen(false);
    router.push(path as any);
  };

  const isLeft = fabCoords.x < screenWidth / 2;
  const isBottom = fabCoords.y > screenHeight / 2;

  return (
    <>
      {/* 100% Native Thread Draggable Floating Action Button via RNGH + Reanimated */}
      <Animated.View style={animatedStyle}>
        <GestureDetector gesture={composedGesture}>
          <View
            accessibilityLabel="Thao tác nhanh"
            accessibilityRole="button"
            style={{
              width: BUTTON_SIZE,
              height: BUTTON_SIZE,
              borderRadius: BUTTON_SIZE / 2,
              backgroundColor: '#F38820',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: '#FFFFFF',
              elevation: 8,
              shadowColor: '#F38820',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 6,
            }}
          >
            <Feather name="plus" size={26} color="#FFFFFF" />
          </View>
        </GestureDetector>
      </Animated.View>

      {/* Speed Dial Options Overlay Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
          onPress={() => setIsOpen(false)}
        >
          {/* Action Options Popup placed relative to the FAB position */}
          <View
            style={{
              position: 'absolute',
              ...(isBottom
                ? { bottom: screenHeight - fabCoords.y + 12 }
                : { top: fabCoords.y + BUTTON_SIZE + 12 }),
              ...(isLeft
                ? { left: Math.max(EDGE_MARGIN, fabCoords.x) }
                : { right: Math.max(EDGE_MARGIN, screenWidth - fabCoords.x - BUTTON_SIZE) }),
              gap: 12,
              alignItems: isLeft ? 'flex-start' : 'flex-end',
            }}
          >
            {/* Action 1: Đề xuất chi */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleAction('/payment-requests/create')}
              className="flex-row items-center gap-3 bg-surface px-4 py-2.5 rounded-2xl border border-border shadow-md"
            >
              <Text className="text-xs font-bold text-text-primary">
                Tạo đề xuất chi / tạm ứng
              </Text>
              <View className="w-9 h-9 rounded-xl bg-orange-100 items-center justify-center">
                <Feather name="file-text" size={18} color="#F38820" />
              </View>
            </TouchableOpacity>

            {/* Action 2: Tạo cơ hội */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleAction('/opportunities/create')}
              className="flex-row items-center gap-3 bg-surface px-4 py-2.5 rounded-2xl border border-border shadow-md"
            >
              <Text className="text-xs font-bold text-text-primary">
                Thêm cơ hội kinh doanh
              </Text>
              <View className="w-9 h-9 rounded-xl bg-blue-100 items-center justify-center">
                <Feather name="trending-up" size={18} color="#3B82F6" />
              </View>
            </TouchableOpacity>

            {/* Action 3: Thêm khách hàng */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleAction('/customers')}
              className="flex-row items-center gap-3 bg-surface px-4 py-2.5 rounded-2xl border border-border shadow-md"
            >
              <Text className="text-xs font-bold text-text-primary">
                Tạo mới khách hàng
              </Text>
              <View className="w-9 h-9 rounded-xl bg-emerald-100 items-center justify-center">
                <Feather name="user-plus" size={18} color="#10B981" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Close button at exact same location as FAB */}
          <TouchableOpacity
            accessibilityLabel="Đóng thao tác"
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={toggleOpen}
            style={{
              position: 'absolute',
              left: fabCoords.x,
              top: fabCoords.y,
              width: BUTTON_SIZE,
              height: BUTTON_SIZE,
              borderRadius: BUTTON_SIZE / 2,
              backgroundColor: '#F38820',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: '#FFFFFF',
              elevation: 8,
              shadowColor: '#F38820',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 6,
            }}
          >
            <Feather name="x" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </>
  );
}
