import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useWorkloadNormsQuery,
  useUpdateWorkloadNormsMutation,
} from '@/hooks/queries/useSettings';
import { formatNumber } from '@/utils/formatters';
import { STAFF_ROLES, USER_ROLE_COLORS } from '@/utils/rbac';
import { USER_ROLE } from '@/services/teamService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const CATEGORY_TABS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'CONTENT', label: 'Content' },
  { id: 'EDITOR', label: 'Editor' },
  { id: 'DESIGNER', label: 'Designer' },
] as const;

type CategoryId = typeof CATEGORY_TABS[number]['id'];

interface WorkloadNormModalProps {
  visible: boolean;
  onClose: () => void;
}

export const WorkloadNormModal: React.FC<WorkloadNormModalProps> = ({ visible, onClose }) => {
  const { data: normData, isLoading, refetch } = useWorkloadNormsQuery();
  const updateMutation = useUpdateWorkloadNormsMutation();

  const [norms, setNorms] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<CategoryId>('ALL');
  const panY = useState(() => new Animated.Value(0))[0];

  const serverNorms = useMemo(() => normData?.norms || [], [normData?.norms]);

  useEffect(() => {
    if (visible) {
      panY.setValue(0);
      refetch();
    }
  }, [visible]);

  useEffect(() => {
    const initialNorms: Record<string, string> = {};
    STAFF_ROLES.forEach((role) => {
      const found = serverNorms.find((item) => item.role === role);
      initialNorms[role] = found ? String(found.monthlyNorm || '') : '';
    });
    setNorms(initialNorms);
  }, [serverNorms]);

  const panResponder = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.8) {
          Animated.timing(panY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  )[0];

  const isDirty = useMemo(() => {
    return serverNorms.some(
      (item) => Number(norms[item.role] || 0) !== Number(item.monthlyNorm || 0)
    );
  }, [serverNorms, norms]);

  const canSave = useMemo(() => {
    const allFilled = STAFF_ROLES.every((role) => Number(norms[role]) > 0);
    return allFilled && isDirty;
  }, [norms, isDirty]);

  const displayedRoles = useMemo(() => {
    if (activeCategory === 'ALL') return STAFF_ROLES;
    return STAFF_ROLES.filter((role) => role.startsWith(activeCategory));
  }, [activeCategory]);

  const getCategoryCount = (catId: CategoryId) => {
    if (catId === 'ALL') return STAFF_ROLES.length;
    return STAFF_ROLES.filter((role) => role.startsWith(catId)).length;
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const resetValues: Record<string, string> = {};
    STAFF_ROLES.forEach((role) => {
      const found = serverNorms.find((item) => item.role === role);
      resetValues[role] = found ? String(found.monthlyNorm || '') : '';
    });
    setNorms(resetValues);
  };

  const handleSave = async () => {
    if (!canSave) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await updateMutation.mutateAsync({
        norms: STAFF_ROLES.map((role) => ({
          role,
          monthlyNorm: Number(norms[role]),
        })),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đã lưu cấu hình định mức workload theo role!');
      onClose();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Lỗi', err?.message || 'Không thể lưu định mức workload');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={[styles.sheetContainer, { transform: [{ translateY: panY }] }]}
        >
          {/* Drag Handle Bar */}
          <View {...panResponder.panHandlers} style={styles.dragHeader}>
            <View style={styles.dragHandle} />
          </View>

          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="speedometer" size={22} color="#F38820" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Định Mức Workload Role</Text>
              <Text style={styles.headerSubtitle}>
                Cấu hình Vinicoin tháng/ngày cho từng cấp độ nhân sự
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Feather name="info" size={16} color="#3B82F6" style={{ marginTop: 2 }} />
            <Text style={styles.infoText}>
              Định mức ngày = Định mức tháng / 30 ngày. Tỷ lệ % tải của nhân viên được tính từ Vinicoin công việc chia cho định mức ngày.
            </Text>
          </View>

          {/* Category Tabs */}
          <View style={styles.categoryTabsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryTabsScroll}
            >
              {CATEGORY_TABS.map((tab) => {
                const isActive = activeCategory === tab.id;
                const count = getCategoryCount(tab.id);
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveCategory(tab.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryTabText,
                        isActive && styles.categoryTabTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                    <View
                      style={[
                        styles.categoryBadge,
                        isActive && styles.categoryBadgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryBadgeText,
                          isActive && styles.categoryBadgeTextActive,
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#F38820" />
              <Text style={styles.loadingText}>Đang tải cấu hình định mức...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {displayedRoles.map((role) => {
                const row = serverNorms.find((item) => item.role === role);
                const monthlyVal = Number(norms[role] || 0);
                const dailyVal = monthlyVal > 0 ? monthlyVal / 30 : 0;
                const isCustomized = row?.isCustomized ?? false;
                const colorConfig = USER_ROLE_COLORS[role] || {
                  bg: '#F8FAFC',
                  text: '#64748B',
                  border: '#E2E8F0',
                };

                return (
                  <View key={role} style={styles.roleCard}>
                    <View style={styles.cardHeader}>
                      <View style={styles.roleTitleGroup}>
                        <Text style={styles.roleName}>{USER_ROLE[role] || role}</Text>
                        <View
                          style={[
                            styles.roleCodeBadge,
                            {
                              backgroundColor: colorConfig.bg,
                              borderColor: colorConfig.border,
                              borderWidth: 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleCodeText,
                              { color: colorConfig.text },
                            ]}
                          >
                            {role}
                          </Text>
                        </View>
                      </View>

                      {isCustomized ? (
                        <View style={styles.configuredBadge}>
                          <Feather name="check-circle" size={12} color="#059669" />
                          <Text style={styles.configuredText}>Đã cấu hình</Text>
                        </View>
                      ) : (
                        <View style={styles.defaultBadge}>
                          <Feather name="info" size={12} color="#D97706" />
                          <Text style={styles.defaultText}>Mặc định</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.inputsRow}>
                      <View style={styles.inputCol}>
                        <Text style={styles.inputLabel}>Định mức tháng (Vinicoin)</Text>
                        <TextInput
                          style={styles.textInput}
                          keyboardType="numeric"
                          placeholder="Ví dụ: 3000"
                          placeholderTextColor="#94A3B8"
                          value={norms[role] || ''}
                          onChangeText={(val) => {
                            const clean = val.replace(/[^0-9]/g, '');
                            setNorms((prev) => ({ ...prev, [role]: clean }));
                          }}
                        />
                      </View>

                      <View style={styles.dailyNormCol}>
                        <Text style={styles.inputLabel}>Định mức ngày</Text>
                        <View style={styles.dailyNormBox}>
                          <Text style={styles.dailyNormValue}>
                            {formatNumber(dailyVal)}
                          </Text>
                          <Text style={styles.dailyNormUnit}>Vinicoin/ngày</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Sticky Bottom Thumb Zone CTA */}
          <View style={styles.footerContainer}>
            {isDirty && (
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={handleReset}
                disabled={updateMutation.isPending}
                activeOpacity={0.7}
              >
                <Feather name="rotate-ccw" size={16} color="#64748B" />
                <Text style={styles.resetBtnText}>Hoàn tác</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.saveBtn,
                (!canSave || updateMutation.isPending) && styles.disabledBtn,
              ]}
              onPress={handleSave}
              disabled={!canSave || updateMutation.isPending}
              activeOpacity={0.8}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="save" size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Lưu Định Mức</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.88,
    minHeight: SCREEN_HEIGHT * 0.55,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHeader: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
  },
  categoryTabsContainer: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 10,
  },
  categoryTabsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  categoryTabActive: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryTabTextActive: {
    color: '#C2410C',
    fontWeight: '700',
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  categoryBadgeActive: {
    backgroundColor: '#FED7AA',
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  categoryBadgeTextActive: {
    color: '#9A3412',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 12,
  },
  roleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  roleTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleCodeBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roleCodeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  configuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  configuredText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  defaultText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputCol: {
    flex: 1.2,
  },
  dailyNormCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  dailyNormBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    justifyContent: 'center',
  },
  dailyNormValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  dailyNormUnit: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F38820',
    borderRadius: 12,
    paddingVertical: 13,
    gap: 8,
    shadowColor: '#F38820',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledBtn: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
