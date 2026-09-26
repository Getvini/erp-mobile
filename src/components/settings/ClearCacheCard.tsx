import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const ClearCacheCard: React.FC = () => {
  const queryClient = useQueryClient();
  const [isClearing, setIsClearing] = useState(false);

  const handleClearCache = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Xóa bộ nhớ đệm',
      'Hành động này sẽ làm mới toàn bộ dữ liệu lưu tạm của ứng dụng. Bạn sẽ cần tải lại dữ liệu mới nhất từ máy chủ.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa bộ nhớ đệm',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              // Reset toàn bộ cache của TanStack Query
              queryClient.clear();
              await queryClient.refetchQueries();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Thành công', 'Đã xóa sạch bộ nhớ tạm và làm mới dữ liệu.');
            } catch (err: any) {
              Alert.alert('Lỗi', err?.message || 'Không thể xóa bộ nhớ đệm.');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Feather name="database" size={20} color="#64748B" />
        </View>

        <View style={styles.textCol}>
          <Text style={styles.title}>Bộ nhớ đệm & Dữ liệu tạm</Text>
          <Text style={styles.subtitle}>
            Giải phóng dung lượng và tải lại dữ liệu mới nhất từ máy chủ nếu gặp lỗi hiển thị
          </Text>
        </View>

        <TouchableOpacity
          style={styles.clearBtn}
          onPress={handleClearCache}
          disabled={isClearing}
          activeOpacity={0.8}
        >
          {isClearing ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <Text style={styles.clearBtnText}>Xóa cache</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
});
