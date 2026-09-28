import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ProjectDetailItem } from '@/services/projectService';
import { useUpdateContractServiceNicknameMutation } from '@/hooks/queries/useContracts';
import { hasTeamMemberRole, getProjectManagerUser } from '@/utils/teamMember';
import { BrandColors } from '@/constants/colors';
import { formatVND, formatQuantity } from '@/utils/formatters';

/**
 * Tab "Dịch vụ" (P1.11) — mirror `ContractInfo.jsx` của Web.
 *
 * LƯU Ý: `CONTRACT_SERVICE_STATUS_LABELS` chưa được export ở `@/services/contractService`
 * (file ngoài phạm vi được sửa của phase này) nên bản đồ nhãn được mirror tại chỗ,
 * đúng giá trị `erp-UI/src/utils/enums.js`.
 */
const CONTRACT_SERVICE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang thực hiện',
  AWAITING_ACCEPTANCE: 'Sẵn sàng nghiệm thu',
  ACCEPTANCE_REJECTED: 'Từ chối nghiệm thu',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

const CONTRACT_SERVICE_STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: '#FFF7ED', color: '#C2410C' },
  AWAITING_ACCEPTANCE: { bg: '#FEFCE8', color: '#A16207' },
  ACCEPTANCE_REJECTED: { bg: '#FEF2F2', color: '#B91C1C' },
  COMPLETED: { bg: '#ECFDF5', color: '#047857' },
  CANCELLED: { bg: '#F1F5F9', color: '#475569' },
};

const getServiceName = (item: any): string =>
  item?.nickname?.trim() || item?.name || item?.service?.name || `Hạng mục #${item?.id ?? ''}`;

const getServiceOriginalName = (item: any): string =>
  item?.name || item?.service?.name || '';

const getServiceCode = (item: any): string | null => item?.code || item?.service?.code || null;

const getServiceQuantity = (item: any): number => Number(item?.quantity ?? item?.packageQuantity ?? 1) || 1;

interface ProjectServiceAddendumTabProps {
  project: ProjectDetailItem | null;
  user?: any;
  /** Gọi lại sau khi đổi nickname để cha refresh dữ liệu dự án/hợp đồng. */
  onChanged?: () => void;
}

export default function ProjectServiceAddendumTab({
  project,
  user,
  onChanged,
}: ProjectServiceAddendumTabProps) {
  const services: any[] = useMemo(() => {
    const contract = project?.contract as any;
    return Array.isArray(contract?.services) ? (contract.services as any[]) : [];
  }, [project]);

  const [editingService, setEditingService] = useState<any>(null);
  const [nicknameDraft, setNicknameDraft] = useState('');

  const updateNicknameMutation = useUpdateContractServiceNicknameMutation();
  const isSubmitting = updateNicknameMutation.isPending;

  /**
   * RBAC: PM của dự án / BOD / ADMIN / ADMIN_SALE hoặc thành viên mang vai trò
   * ACCOUNT (Team lead) / PROJECT_MANAGER. Không đủ quyền ⇒ ẩn hoàn toàn nút.
   */
  const canEditNickname = useMemo(() => {
    if (!project || !user?.id) return false;
    if (['ADMIN', 'BOD', 'ADMIN_SALE'].includes(user?.role)) return true;

    const members: any[] =
      (project.team?.members as any[]) && (project.team!.members as any[]).length > 0
        ? (project.team!.members as any[])
        : [];

    const isAssignedPm = getProjectManagerUser(project, members)?.id === user.id;
    const isTeamLead = project.team?.teamLead?.id === user.id;
    const isCoreMember = members.some(
      (m) =>
        m?.user?.id === user.id &&
        (hasTeamMemberRole(m, 'PROJECT_MANAGER') || hasTeamMemberRole(m, 'ACCOUNT'))
    );

    return Boolean(isAssignedPm || isTeamLead || isCoreMember);
  }, [project, user]);

  const openNicknameEditor = (item: any) => {
    setEditingService(item);
    setNicknameDraft(item?.nickname || '');
  };

  const closeNicknameEditor = () => {
    if (isSubmitting) return;
    setEditingService(null);
    setNicknameDraft('');
  };

  const handleSaveNickname = async () => {
    if (!editingService?.id) return;
    try {
      await updateNicknameMutation.mutateAsync({
        id: String(editingService.id),
        nickname: nicknameDraft.trim(),
      });
      Alert.alert('Thành công', 'Đã cập nhật nickname hạng mục dịch vụ.');
      setEditingService(null);
      setNicknameDraft('');
      onChanged?.();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể cập nhật nickname hạng mục dịch vụ.');
    }
  };

  if (!project) {
    return (
      <View className="items-center gap-3 py-10">
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text className="text-[13px] text-slate-500">Đang tải danh sách dịch vụ...</Text>
      </View>
    );
  }

  return (
    <View className="gap-3 p-4">
      <View className="flex-row items-center gap-2.5">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-orange-50">
          <Feather name="package" size={20} color={BrandColors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-slate-950">
            Dịch vụ hợp đồng ({services.length})
          </Text>
          <Text className="text-xs text-slate-500">
            Danh sách hạng mục dịch vụ thuộc hợp đồng của dự án.
          </Text>
        </View>
      </View>

      {services.length === 0 ? (
        <View className="items-center justify-center gap-2 py-10">
          <Feather name="package" size={40} color="#CBD5E1" />
          <Text className="text-[15px] font-bold text-slate-600">Chưa có dịch vụ nào</Text>
          <Text className="max-w-[260px] text-center text-[13px] text-slate-400">
            Hợp đồng của dự án chưa có hạng mục dịch vụ nào.
          </Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {services.map((item) => {
            const status = item?.status || '';
            const badge = CONTRACT_SERVICE_STATUS_BADGE[status] || {
              bg: '#F1F5F9',
              color: '#64748B',
            };
            const originalName = getServiceOriginalName(item);
            const hasNickname = Boolean(item?.nickname?.trim()) && Boolean(originalName);

            return (
              <View
                key={String(item?.id)}
                className="gap-2 rounded-xl border border-slate-200 bg-white p-3"
              >
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-[13px] font-bold text-slate-950">
                      {getServiceName(item)}
                    </Text>
                    {getServiceCode(item) ? (
                      <Text className="text-[11px] text-slate-400">Mã: {getServiceCode(item)}</Text>
                    ) : null}
                  </View>

                  <View className="rounded-md px-2 py-[3px]" style={{ backgroundColor: badge.bg }}>
                    <Text className="text-[10px] font-bold" style={{ color: badge.color }}>
                      {CONTRACT_SERVICE_STATUS_LABELS[status] || status || 'Chưa có trạng thái'}
                    </Text>
                  </View>
                </View>

                {hasNickname ? (
                  <Text className="text-[11px] italic text-slate-400">
                    Tên gốc: {originalName}
                  </Text>
                ) : null}

                <View className="flex-row items-center gap-4">
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[10px] text-slate-400">Số lượng</Text>
                    <Text className="text-[12px] font-bold text-slate-800">
                      {formatQuantity(getServiceQuantity(item))}
                    </Text>
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[10px] text-slate-400">Đơn giá</Text>
                    <Text className="text-[12px] font-bold text-slate-800">
                      {formatVND(item?.sellingPrice || 0)}
                    </Text>
                  </View>
                </View>

                {canEditNickname && (
                  <TouchableOpacity
                    className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50"
                    onPress={() => openNicknameEditor(item)}
                    activeOpacity={0.8}
                  >
                    <Feather name="edit-2" size={14} color="#475569" />
                    <Text className="text-xs font-bold text-slate-600">Đổi nickname dịch vụ</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Bottom sheet đổi nickname */}
      <Modal
        visible={Boolean(editingService)}
        transparent
        animationType="slide"
        onRequestClose={closeNicknameEditor}
      >
        <View className="flex-1 justify-end bg-slate-900/50">
          <View className="max-h-[85%] gap-4 rounded-t-[24px] bg-white p-5">
            <View className="flex-row items-center justify-between border-b border-slate-100 pb-3">
              <Text className="flex-1 text-base font-bold text-slate-900">
                Đổi nickname dịch vụ
              </Text>
              <TouchableOpacity
                onPress={closeNicknameEditor}
                className="h-12 w-12 items-center justify-center"
                disabled={isSubmitting}
              >
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="mb-1.5 text-xs font-semibold text-slate-600">
                Tên gốc: {editingService ? getServiceOriginalName(editingService) || '—' : '—'}
              </Text>
              <TextInput
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary"
                placeholder="Nhập nickname hiển thị cho hạng mục dịch vụ..."
                placeholderTextColor="#94A3B8"
                value={nicknameDraft}
                onChangeText={setNicknameDraft}
                editable={!isSubmitting}
                autoFocus
              />
              <Text className="mt-1.5 text-[11px] text-slate-400">
                Để trống để quay về tên gốc của dịch vụ.
              </Text>
            </ScrollView>

            <View className="flex-row justify-end gap-2.5 border-t border-slate-100 pt-3.5">
              <TouchableOpacity
                className="h-12 items-center justify-center rounded-xl bg-slate-100 px-4"
                onPress={closeNicknameEditor}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <Text className="text-sm font-semibold text-slate-500">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`h-12 min-w-[120px] items-center justify-center rounded-xl bg-primary px-5 ${
                  isSubmitting ? 'opacity-60' : ''
                }`}
                onPress={handleSaveNickname}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text className="text-sm font-bold text-white">Lưu nickname</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
