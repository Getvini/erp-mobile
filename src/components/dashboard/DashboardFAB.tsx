import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface DashboardFABProps {
  userRole?: string;
}

export function DashboardFAB({ userRole }: DashboardFABProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsOpen(!isOpen);
  };

  const handleAction = (path: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpen(false);
    router.push(path as any);
  };

  return (
    <>
      {/* Floating Action Button */}
      <TouchableOpacity
        accessibilityLabel="Thao tác nhanh"
        accessibilityRole="button"
        activeOpacity={0.85}
        onPress={toggleOpen}
        className="absolute bottom-20 right-4 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg shadow-orange-500/30 z-50 border-2 border-white"
        style={{
          elevation: 6,
          shadowColor: '#F38820',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
        }}
      >
        <Feather
          name={isOpen ? 'x' : 'plus'}
          size={26}
          color="#FFFFFF"
        />
      </TouchableOpacity>

      {/* Speed Dial Options Overlay Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end items-end p-4 pb-24"
          onPress={() => setIsOpen(false)}
        >
          <View className="gap-3 items-end">
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
        </Pressable>
      </Modal>
    </>
  );
}
