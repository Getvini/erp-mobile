import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/useAuthStore';
import { isManagementRole } from '@/utils/rbac';
import { safeGoBack } from '@/utils/navigation';
import {
  BiometricToggleCard,
  NotificationSettingCard,
  ClearCacheCard,
  QcConfigModal,
} from '@/components/settings';

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [qcModalVisible, setQcModalVisible] = useState(false);

  const isAdminOrManager = isManagementRole(user?.role) || user?.role === 'PM';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => safeGoBack(router, '/profile')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>Cài Đặt Hệ Thống</Text>
          <Text style={styles.headerSubtitle}>Tùy chỉnh bảo mật & vận hành</Text>
        </View>

        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Mini Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(user?.fullName || user?.username || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.fullName || user?.username || 'Người dùng'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'Tài khoản Getvini'}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role || 'MEMBER'}</Text>
          </View>
        </View>

        {/* 1. Nhóm Bảo Mật & Đăng Nhập */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BẢO MẬT & ĐĂNG NHẬP</Text>
          <BiometricToggleCard />
        </View>

        {/* 2. Nhóm Thông Báo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>THÔNG BÁO</Text>
          <NotificationSettingCard />
        </View>

        {/* 3. Nhóm Tiêu Chuẩn & QC Đối Chiếu (Dành cho Admin / PM / Management) */}
        {isAdminOrManager && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TIÊU CHUẨN & QC TỰ ĐỘNG</Text>
            <View style={styles.qcCard}>
              <View style={styles.qcIconCircle}>
                <MaterialCommunityIcons name="robot" size={22} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.qcTitle}>Cấu hình QC AI Đối Chiếu</Text>
                <Text style={styles.qcSubtitle}>
                  Thiết lập Model AI, số task/đợt và ngữ cảnh kiểm tra sản phẩm với mô tả chuẩn
                </Text>
              </View>
              <TouchableOpacity
                style={styles.qcConfigBtn}
                onPress={() => setQcModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.qcConfigBtnText}>Cấu hình</Text>
                <Feather name="chevron-right" size={14} color="#2563EB" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 4. Nhóm Bộ Nhớ & Dữ Liệu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BỘ NHỚ & DỮ LIỆU</Text>
          <ClearCacheCard />
        </View>

        {/* 5. Thông Tin Ứng Dụng */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>THÔNG TIN ỨNG DỤNG</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phiên bản</Text>
              <Text style={styles.infoValue}>1.0.0 (Build 2026)</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Môi trường</Text>
              <Text style={styles.infoValue}>Production</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Bản quyền</Text>
              <Text style={styles.infoValue}>© 2026 Getvini ERP</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* QC AI Modal Bottom Sheet */}
      <QcConfigModal
        visible={qcModalVisible}
        onClose={() => setQcModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EA580C',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  qcCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qcIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qcTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  qcSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  qcConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  qcConfigBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },
});
