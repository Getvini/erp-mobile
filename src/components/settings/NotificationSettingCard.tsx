import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const NOTIF_PREFS_KEY = 'getvini_notification_preferences';

interface NotificationPreferences {
  tasks: boolean;
  paymentRequests: boolean;
  quotations: boolean;
  debts: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  tasks: true,
  paymentRequests: true,
  quotations: true,
  debts: true,
};

export const NotificationSettingCard: React.FC = () => {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const data = await AsyncStorage.getItem(NOTIF_PREFS_KEY);
      if (data) {
        setPrefs(JSON.parse(data));
      }
    } catch {
      // Dùng default
    }
  };

  const handleToggle = async (key: keyof NotificationPreferences, value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const items = [
    {
      key: 'tasks' as const,
      label: 'Nhiệm vụ & Công việc',
      desc: 'Nhận thông báo khi được giao việc hoặc có đánh giá mới',
      icon: 'check-square' as const,
      color: '#3B82F6',
      bg: '#EFF6FF',
    },
    {
      key: 'paymentRequests' as const,
      label: 'Đề xuất thanh toán & tạm ứng',
      desc: 'Thông báo khi có phiếu cần duyệt hoặc được phê duyệt',
      icon: 'dollar-sign' as const,
      color: '#10B981',
      bg: '#ECFDF5',
    },
    {
      key: 'quotations' as const,
      label: 'Báo giá & Hợp đồng',
      desc: 'Cập nhật tiến độ báo giá, phê duyệt và chuyển đổi HĐ',
      icon: 'file-text' as const,
      color: '#EA580C',
      bg: '#FFF7ED',
    },
    {
      key: 'debts' as const,
      label: 'Cảnh báo công nợ & Đến hạn',
      desc: 'Nhắc nhở các đợt thanh toán sắp đến hạn hoặc quá hạn',
      icon: 'alert-triangle' as const,
      color: '#F59E0B',
      bg: '#FFFBEB',
    },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.sectionHeader}>Cấu hình thông báo đẩy (Push Notifications)</Text>

      <View style={styles.itemList}>
        {items.map((item, index) => (
          <View
            key={item.key}
            style={[styles.row, index < items.length - 1 && styles.rowBorder]}
          >
            <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
              <Feather name={item.icon} size={16} color={item.color} />
            </View>

            <View style={styles.textCol}>
              <Text style={styles.itemLabel}>{item.label}</Text>
              <Text style={styles.itemDesc}>{item.desc}</Text>
            </View>

            <Switch
              value={prefs[item.key]}
              onValueChange={(val) => handleToggle(item.key, val)}
              trackColor={{ false: '#E2E8F0', true: '#FDBA74' }}
              thumbColor={prefs[item.key] ? '#EA580C' : '#94A3B8'}
            />
          </View>
        ))}
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
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  itemList: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  itemDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
});
