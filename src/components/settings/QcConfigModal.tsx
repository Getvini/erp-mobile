import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useQcSettingsQuery,
  useUpdateQcSettingsMutation,
} from '@/hooks/queries/useSettings';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface QcConfigModalProps {
  visible: boolean;
  onClose: () => void;
}

export const QcConfigModal: React.FC<QcConfigModalProps> = ({ visible, onClose }) => {
  const { data: qcData, isLoading, refetch } = useQcSettingsQuery();
  const updateMutation = useUpdateQcSettingsMutation();

  const [provider, setProvider] = useState('');
  const [verifyModel, setVerifyModel] = useState('');
  const [maxBatch, setMaxBatch] = useState('5');
  const [maxContext, setMaxContext] = useState('2000');

  const panY = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (visible) {
      panY.setValue(0);
      refetch();
    }
  }, [visible]);

  useEffect(() => {
    if (qcData?.config) {
      setProvider(qcData.config.provider || '');
      setVerifyModel(qcData.config.verifyModel || '');
      setMaxBatch(String(qcData.config.maxBatch || 5));
      setMaxContext(String(qcData.config.maxContext || 2000));
    }
  }, [qcData]);

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

  const providers = qcData?.options?.providers || [
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'openai', label: 'OpenAI' },
  ];

  const currentModels = qcData?.options?.models?.[provider] || [
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ];

  const handleProviderSelect = (pVal: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProvider(pVal);
    const models = qcData?.options?.models?.[pVal];
    if (models && models.length > 0) {
      setVerifyModel(models[0].value);
    }
  };

  const handleModelSelect = (mVal: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVerifyModel(mVal);
  };

  const handleSave = async () => {
    const numBatch = parseInt(maxBatch, 10);
    const numContext = parseInt(maxContext, 10);

    if (isNaN(numBatch) || numBatch <= 0) {
      Alert.alert('Lỗi', 'Số lượng task đối chiếu (Batch) phải lớn hơn 0.');
      return;
    }
    if (isNaN(numContext) || numContext <= 0) {
      Alert.alert('Lỗi', 'Độ dài ngữ cảnh context phải lớn hơn 0.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await updateMutation.mutateAsync({
        provider,
        verifyModel,
        maxBatch: numBatch,
        maxContext: numContext,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đã lưu cấu hình AI QC đối chiếu sản phẩm thành công!');
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể lưu cấu hình QC.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [{ translateY: panY }],
            },
          ]}
        >
          {/* Drag Handle Bar */}
          <View {...panResponder.panHandlers} style={styles.dragHandleContainer}>
            <View style={styles.dragBar} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="robot" size={20} color="#EA580C" />
              </View>
              <View>
                <Text style={styles.title}>Cấu hình QC AI Đối Chiếu</Text>
                <Text style={styles.subtitle}>Tự động kiểm tra sản phẩm với mô tả chuẩn</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#EA580C" />
              <Text style={styles.loadingText}>Đang tải cấu hình QC...</Text>
            </View>
          ) : (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* 1. Chọn Nhà Cung Cấp AI */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nhà cung cấp AI (Provider)</Text>
                <View style={styles.optionsRow}>
                  {providers.map((p) => {
                    const isSelected = provider === p.value;
                    return (
                      <TouchableOpacity
                        key={p.value}
                        style={[styles.optionPill, isSelected && styles.optionPillActive]}
                        onPress={() => handleProviderSelect(p.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.optionPillText, isSelected && styles.optionPillTextActive]}>
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 2. Chọn Model AI */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Model AI Đối Chiếu (Verification Model)</Text>
                <View style={styles.optionsRow}>
                  {currentModels.map((m) => {
                    const isSelected = verifyModel === m.value;
                    return (
                      <TouchableOpacity
                        key={m.value}
                        style={[styles.optionPill, isSelected && styles.optionPillActive]}
                        onPress={() => handleModelSelect(m.value)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.optionPillText, isSelected && styles.optionPillTextActive]}>
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 3. Giới hạn Batch & Context */}
              <View style={styles.rowTwoCols}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Số task / đợt (Batch)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={maxBatch}
                    onChangeText={setMaxBatch}
                    placeholder="VD: 5"
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Độ dài Context (Tokens)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={maxContext}
                    onChangeText={setMaxContext}
                    placeholder="VD: 2000"
                  />
                </View>
              </View>

              <View style={styles.infoBanner}>
                <Feather name="info" size={16} color="#0284C7" />
                <Text style={styles.infoText}>
                  Cấu hình này sẽ được áp dụng cho toàn bộ các quy trình QC tự động khi nhân viên nộp kết quả công việc.
                </Text>
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>
          )}

          {/* Sticky Bottom Save Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, updateMutation.isPending && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={updateMutation.isPending || isLoading}
              activeOpacity={0.85}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Lưu cấu hình QC</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.85,
    minHeight: 460,
  },
  dragHandleContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dragBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
  },
  content: {
    padding: 20,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionPillActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#EA580C',
  },
  optionPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  optionPillTextActive: {
    color: '#EA580C',
    fontWeight: '700',
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 14,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  infoBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 17,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EA580C',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
