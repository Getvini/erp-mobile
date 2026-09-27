import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePmUsersQuery, useAssignProjectMutation } from '@/hooks/queries/useProjects';
import { BrandColors } from '@/constants/colors';

interface AssignPmModalProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  contractId?: string;
  currentPmId?: string;
  onSuccess: () => void;
}

export default function AssignPmModal({
  visible,
  onClose,
  projectId,
  contractId,
  currentPmId,
  onSuccess,
}: AssignPmModalProps) {
  const [selectedPmId, setSelectedPmId] = useState<string | undefined>(currentPmId);

  const { data: pmUsersData, isLoading: loadingUsers } = usePmUsersQuery();
  const pmUsers = pmUsersData || [];

  const assignProjectMutation = useAssignProjectMutation();
  const isSubmitting = assignProjectMutation.isPending;

  useEffect(() => {
    if (visible) {
      setSelectedPmId(currentPmId);
    }
  }, [visible, currentPmId]);

  const handleAssign = async () => {
    if (!selectedPmId) {
      Alert.alert('Cảnh báo', 'Vui lòng chọn Quản lý dự án (PM).');
      return;
    }
    const targetContractId = contractId || projectId;
    try {
      await assignProjectMutation.mutateAsync({
        contractId: targetContractId,
        pmId: selectedPmId,
      });

      Alert.alert('Thành công', 'Đã phân công Quản lý dự án thành công.');
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-900/50 justify-center p-5">
        <View className="bg-surface rounded-2xl max-h-[80%] p-5 gap-4 shadow-xl">
          {/* Header */}
          <View className="flex-row justify-between items-center border-b border-slate-100 pb-3">
            <Text className="text-base font-bold text-text-primary">Phân công Quản lý Dự án (PM)</Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* User List */}
          {loadingUsers ? (
            <View className="py-7.5 items-center gap-2">
              <ActivityIndicator size="small" color={BrandColors.primary} />
              <Text className="text-xs text-text-muted">Đang tải danh sách PM...</Text>
            </View>
          ) : (
            <ScrollView className="max-h-[280px]" showsVerticalScrollIndicator={false}>
              {pmUsers.map((user) => {
                const isSelected = selectedPmId === user.id;
                return (
                  <TouchableOpacity
                    key={user.id}
                    className={`flex-row items-center justify-between py-2.5 px-3 rounded-xl mb-2 border ${
                      isSelected ? 'border-primary bg-teal-50/50' : 'border-border bg-slate-50/50'
                    }`}
                    onPress={() => setSelectedPmId(user.id)}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <View className="w-9 h-9 rounded-full bg-slate-200 items-center justify-center">
                        <Text className="text-sm font-bold text-slate-600">
                          {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-sm font-semibold text-text-primary">{user.fullName}</Text>
                        {user.email && <Text className="text-xs text-text-secondary">{user.email}</Text>}
                      </View>
                    </View>
                    {isSelected && (
                      <Feather name="check-circle" size={20} color={BrandColors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Footer Actions */}
          <View className="flex-row justify-end gap-2.5 border-t border-slate-100 pt-3.5">
            <TouchableOpacity className="px-4 py-2.5 rounded-xl bg-slate-100" onPress={onClose} disabled={isSubmitting}>
              <Text className="text-sm font-semibold text-slate-600">Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`px-4.5 py-2.5 rounded-xl bg-primary ${isSubmitting ? 'opacity-60' : ''}`}
              onPress={handleAssign}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-sm font-bold text-white">Phân công</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
