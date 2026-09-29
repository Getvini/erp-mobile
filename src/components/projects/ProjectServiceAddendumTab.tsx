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
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ProjectDetailItem } from '@/services/projectService';
import { TASK_STATUS_CONFIG } from '@/services/taskService';
import { useUpdateContractServiceNicknameMutation } from '@/hooks/queries/useContracts';
import { hasTeamMemberRole, getProjectManagerUser } from '@/utils/teamMember';
import { BrandColors } from '@/constants/colors';
import { formatDateToDDMMYYYY } from '@/utils/formatters';

/**
 * Tab "Dịch vụ" (P1.11) — mirror `ContractInfo.jsx` của Web.
 * - Gom dịch vụ theo `packageName` (không có ⇒ "Dịch vụ lẻ"), mỗi nhóm đóng/mở được.
 * - Thống kê + bộ lọc trạng thái nghiệm thu, tiến độ công việc, chi tiết công việc/kết quả.
 * - Người không phải Admin/BOD/Lead/PM chỉ thấy dịch vụ có công việc của mình (giống Web).
 *
 * LƯU Ý: `CONTRACT_SERVICE_STATUS_LABELS` chưa được export ở `@/services/contractService`
 * nên bản đồ nhãn được mirror tại chỗ, đúng giá trị `erp-UI/src/utils/enums.js`.
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

type StatusFilter = 'ALL' | 'ACTIVE' | 'AWAITING_ACCEPTANCE' | 'ACCEPTANCE_REJECTED' | 'COMPLETED';

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Đang làm' },
  { value: 'AWAITING_ACCEPTANCE', label: 'Chờ nghiệm thu' },
  { value: 'ACCEPTANCE_REJECTED', label: 'Bị từ chối' },
  { value: 'COMPLETED', label: 'Hoàn tất' },
];

const COMPLETED_TASK_STATUSES = ['COMPLETED', 'ACCEPTED', 'DONE'];
const ISSUE_TASK_STATUSES = ['OVERDUE', 'REJECTED', 'AWAITING_PRICING'];

/** Nhóm dành cho dịch vụ không thuộc gói nào (giống Web). */
const SINGLE_GROUP_NAME = 'Dịch vụ lẻ';

/** true = các nhóm gói mặc định đóng (nhóm "Dịch vụ lẻ" luôn mở). Đổi thành false để mở hết như Web. */
const COLLAPSE_PACKAGES_BY_DEFAULT = true;

const nameCollator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

const getServiceName = (item: any): string =>
  item?.nickname?.trim() || item?.name || item?.service?.name || `Hạng mục #${item?.id ?? ''}`;

const getServiceOriginalName = (item: any): string =>
  item?.name || item?.service?.name || '';

const getServiceCode = (item: any): string | null => item?.code || item?.service?.code || null;

const getTaskOwner = (task: any): string =>
  task?.assignee?.fullName ||
  task?.helper?.fullName ||
  task?.vendor?.name ||
  task?.vendorId ||
  'Chưa phân công';

const compareServicesByName = (a: any, b: any): number => {
  const nameDiff = nameCollator.compare(getServiceName(a), getServiceName(b));
  if (nameDiff !== 0) return nameDiff;
  const codeDiff = nameCollator.compare(getServiceCode(a) || '', getServiceCode(b) || '');
  if (codeDiff !== 0) return codeDiff;
  return nameCollator.compare(String(a?.id || ''), String(b?.id || ''));
};

const getTaskPriority = (task: any): number => {
  if (!task.assigneeId && !task.vendorId) return 0;
  if (ISSUE_TASK_STATUSES.includes(task.status)) return 1;
  if (!COMPLETED_TASK_STATUSES.includes(task.status)) return 2;
  return 3;
};

const sameId = (a: any, b: any): boolean => a != null && b != null && String(a) === String(b);

interface ProjectServiceAddendumTabProps {
  project: ProjectDetailItem | null;
  user?: any;
  /** Danh sách công việc của dự án — dùng để bổ sung thông tin cho công việc trong từng dịch vụ. */
  tasks?: any[];
  /** Gọi lại sau khi đổi nickname để cha refresh dữ liệu dự án/hợp đồng. */
  onChanged?: () => void;
}

export default function ProjectServiceAddendumTab({
  project,
  user,
  tasks: projectTasks,
  onChanged,
}: ProjectServiceAddendumTabProps) {
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [groupToggles, setGroupToggles] = useState<Record<string, boolean>>({});
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [editingService, setEditingService] = useState<any>(null);
  const [nicknameDraft, setNicknameDraft] = useState('');

  const updateNicknameMutation = useUpdateContractServiceNicknameMutation();
  const isSubmitting = updateNicknameMutation.isPending;

  const services: any[] = useMemo(() => {
    const contract = project?.contract as any;
    return Array.isArray(contract?.services) ? (contract.services as any[]) : [];
  }, [project]);

  const members: any[] = useMemo(
    () =>
      (project?.team?.members as any[]) && (project!.team!.members as any[]).length > 0
        ? (project!.team!.members as any[])
        : [],
    [project]
  );

  /** Admin/BOD/Lead/PM thấy toàn bộ dịch vụ + công việc; người khác chỉ thấy phần của mình. */
  const canSeeAllTasks = useMemo(() => {
    if (!project || !user?.id) return false;
    if (['ADMIN', 'BOD'].includes(user?.role)) return true;
    const isAssignedPm = sameId(getProjectManagerUser(project, members)?.id, user.id);
    const isTeamLead = sameId(project.team?.teamLead?.id, user.id);
    const isPmMember = members.some(
      (m) => sameId(m?.user?.id, user.id) && hasTeamMemberRole(m, 'PROJECT_MANAGER')
    );
    return Boolean(isAssignedPm || isTeamLead || isPmMember);
  }, [project, user, members]);

  /**
   * RBAC đổi nickname: PM của dự án / BOD / ADMIN / ADMIN_SALE hoặc thành viên mang vai trò
   * ACCOUNT (Team lead) / PROJECT_MANAGER. Không đủ quyền ⇒ ẩn hoàn toàn nút.
   */
  const canEditNickname = useMemo(() => {
    if (!project || !user?.id) return false;
    if (['ADMIN', 'BOD', 'ADMIN_SALE'].includes(user?.role)) return true;
    const isCoreMember = members.some(
      (m) =>
        sameId(m?.user?.id, user.id) &&
        (hasTeamMemberRole(m, 'PROJECT_MANAGER') || hasTeamMemberRole(m, 'ACCOUNT'))
    );
    return Boolean(canSeeAllTasks || isCoreMember);
  }, [project, user, members, canSeeAllTasks]);

  const projectTasksMap = useMemo(() => {
    const map = new Map<string, any>();
    (projectTasks || []).forEach((t: any) => map.set(String(t.id), t));
    return map;
  }, [projectTasks]);

  const isUserTask = (task: any): boolean => {
    const uid = user?.id;
    if (
      sameId(uid, task?.assigneeId) ||
      sameId(uid, task?.assignee?.id) ||
      sameId(uid, task?.helperId) ||
      sameId(uid, task?.helper?.id)
    ) {
      return true;
    }
    return (
      Array.isArray(task?.subtasks) &&
      task.subtasks.some(
        (st: any) =>
          sameId(uid, st?.assigneeId) ||
          sameId(uid, st?.assignee?.id) ||
          sameId(uid, st?.helperId) ||
          sameId(uid, st?.helper?.id)
      )
    );
  };

  /** Công việc của dịch vụ, bổ sung thông tin từ danh sách công việc dự án, lọc theo quyền xem. */
  const getServiceTasks = (item: any): any[] => {
    const raw: any[] = Array.isArray(item?.tasks) ? item.tasks : [];
    const enriched = raw.map((t) => {
      const full = projectTasksMap.get(String(t.id));
      return full ? { ...t, ...full } : t;
    });
    return canSeeAllTasks ? enriched : enriched.filter(isUserTask);
  };

  const visibleServices = useMemo(() => {
    if (canSeeAllTasks) return services;
    return services.filter((item) => {
      const raw: any[] = Array.isArray(item?.tasks) ? item.tasks : [];
      return raw
        .map((t) => {
          const full = projectTasksMap.get(String(t.id));
          return full ? { ...t, ...full } : t;
        })
        .some(isUserTask);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, canSeeAllTasks, projectTasksMap, user?.id]);

  const summary = useMemo(
    () => ({
      total: visibleServices.length,
      ACTIVE: visibleServices.filter((s) => s.status === 'ACTIVE').length,
      AWAITING_ACCEPTANCE: visibleServices.filter((s) => s.status === 'AWAITING_ACCEPTANCE').length,
      ACCEPTANCE_REJECTED: visibleServices.filter((s) => s.status === 'ACCEPTANCE_REJECTED').length,
      COMPLETED: visibleServices.filter((s) => s.status === 'COMPLETED').length,
    }),
    [visibleServices]
  );

  const filterCounts: Record<StatusFilter, number> = {
    ALL: summary.total,
    ACTIVE: summary.ACTIVE,
    AWAITING_ACCEPTANCE: summary.AWAITING_ACCEPTANCE,
    ACCEPTANCE_REJECTED: summary.ACCEPTANCE_REJECTED,
    COMPLETED: summary.COMPLETED,
  };

  /** Gom theo `packageName`, giữ thứ tự xuất hiện sau khi sắp theo tên dịch vụ (giống Web). */
  const groupEntries = useMemo(() => {
    const filtered =
      statusFilter === 'ALL'
        ? visibleServices
        : visibleServices.filter((s) => s.status === statusFilter);

    const groups: Record<string, any[]> = {};
    [...filtered].sort(compareServicesByName).forEach((item) => {
      const key = item?.packageName || SINGLE_GROUP_NAME;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups);
  }, [visibleServices, statusFilter]);

  const isGroupCollapsed = (groupName: string): boolean => {
    if (groupName in groupToggles) return groupToggles[groupName];
    return COLLAPSE_PACKAGES_BY_DEFAULT && groupName !== SINGLE_GROUP_NAME;
  };

  const toggleGroup = (groupName: string) =>
    setGroupToggles((prev) => ({ ...prev, [groupName]: !isGroupCollapsed(groupName) }));

  const toggleService = (serviceId: string) =>
    setExpandedServices((prev) => ({ ...prev, [serviceId]: !prev[serviceId] }));

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

  const renderProgress = (serviceTasks: any[]) => {
    const total = serviceTasks.length;
    const completed = serviceTasks.filter((t) => COMPLETED_TASK_STATUSES.includes(t.status)).length;
    const issues = serviceTasks.filter((t) => ISSUE_TASK_STATUSES.includes(t.status)).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;

    return (
      <View className="gap-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-[10px] text-slate-400">Tiến độ</Text>
          <Text className={`text-[10px] font-bold ${issues ? 'text-rose-500' : 'text-slate-600'}`}>
            {completed}/{total}
          </Text>
        </View>
        <View className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <View
            className={`h-full rounded-full ${issues ? 'bg-rose-400' : 'bg-emerald-500'}`}
            style={{ width: `${percent}%` }}
          />
        </View>
      </View>
    );
  };

  const renderTaskRow = (task: any) => {
    const cfg = TASK_STATUS_CONFIG[task.status || 'PENDING'];
    const dueDate = task.plannedEndDate || task.dueDate;

    return (
      <TouchableOpacity
        key={String(task.id)}
        className="gap-1.5 border-b border-slate-100 px-3 py-2.5"
        onPress={() => router.push(`/tasks/${task.id}` as any)}
        activeOpacity={0.7}
      >
        <View className="flex-row flex-wrap items-center gap-1.5">
          {task.code ? (
            <View className="rounded bg-slate-100 px-1.5 py-0.5">
              <Text className="text-[10px] font-bold text-slate-600">{task.code}</Text>
            </View>
          ) : null}
          {task.isOutput ? (
            <View className="rounded bg-purple-50 px-1.5 py-0.5">
              <Text className="text-[10px] font-bold text-purple-600">Đầu ra</Text>
            </View>
          ) : null}
          <View
            className="rounded-md px-2 py-[3px]"
            style={{ backgroundColor: cfg?.bg || '#F1F5F9' }}
          >
            <Text className="text-[10px] font-bold" style={{ color: cfg?.color || '#64748B' }}>
              {cfg?.text || task.status || 'Chưa có trạng thái'}
            </Text>
          </View>
        </View>
        <Text className="text-[13px] font-bold text-slate-900">
          {task.name || 'Chưa có tên công việc'}
        </Text>
        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-1">
            <Feather name="user" size={11} color="#64748B" />
            <Text className="text-[11px] text-slate-500">{getTaskOwner(task)}</Text>
          </View>
          {dueDate ? (
            <View className="flex-row items-center gap-1">
              <Feather name="calendar" size={11} color="#64748B" />
              <Text className="text-[11px] text-slate-500">
                {formatDateToDDMMYYYY(dueDate, String(dueDate))}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderServiceDetails = (item: any, serviceTasks: any[], results: any[]) => {
    const sortedTasks = [...serviceTasks].sort((a, b) => {
      const diff = getTaskPriority(a) - getTaskPriority(b);
      if (diff !== 0) return diff;
      return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true });
    });
    const feedback = item?.status === 'ACCEPTANCE_REJECTED' ? item?.feedback : null;

    return (
      <View className="gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
        <View className="gap-1.5">
          <Text className="text-[11px] font-bold text-slate-500">
            {canSeeAllTasks
              ? `Công việc thuộc dịch vụ (${serviceTasks.length})`
              : `Công việc của bạn (${serviceTasks.length})`}
          </Text>
          {sortedTasks.length > 0 ? (
            <View className="overflow-hidden rounded-xl border border-slate-100 bg-white">
              {sortedTasks.map(renderTaskRow)}
            </View>
          ) : (
            <Text className="text-xs italic text-slate-400">
              {canSeeAllTasks
                ? 'Chưa có công việc thuộc dịch vụ'
                : 'Bạn không có công việc nào trong dịch vụ này'}
            </Text>
          )}
        </View>

        <View className="gap-1.5">
          <Text className="text-[11px] font-bold text-slate-500">
            Kết quả ({results.length})
          </Text>
          {results.length > 0 ? (
            results.map((result, index) => {
              const isApproved = result?.status === 'APPROVED';
              const isRejected = result?.status === 'REJECTED';
              const tone = isApproved
                ? 'border-green-200 bg-green-50'
                : isRejected
                  ? 'border-red-200 bg-red-50'
                  : 'border-amber-200 bg-amber-50';
              const textTone = isApproved
                ? 'text-green-700'
                : isRejected
                  ? 'text-red-700'
                  : 'text-amber-700';
              const iconColor = isApproved ? '#15803D' : isRejected ? '#B91C1C' : '#B45309';

              return (
                <TouchableOpacity
                  key={index}
                  disabled={!result?.url}
                  onPress={() => result?.url && Linking.openURL(result.url)}
                  activeOpacity={0.7}
                  className={`flex-row items-start gap-2 rounded-xl border p-2.5 ${tone}`}
                >
                  <Feather name="file-text" size={14} color={iconColor} style={{ marginTop: 1 }} />
                  <View className="flex-1">
                    <Text className={`text-xs font-bold ${textTone}`} numberOfLines={2}>
                      {result?.name || `Kết quả ${index + 1}`}
                    </Text>
                    {isRejected && result?.feedback ? (
                      <Text className="mt-0.5 text-[11px] italic text-red-500">
                        Phản hồi: {result.feedback}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <Text className="text-xs italic text-slate-400">Chưa có kết quả</Text>
          )}
        </View>

        {feedback ? (
          <View className="rounded-xl border border-red-100 bg-red-50 p-2.5">
            <Text className="text-[11px] font-bold text-red-500">Lý do từ chối</Text>
            <Text className="mt-0.5 text-xs italic text-red-600">{feedback}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  const renderServiceItem = (item: any) => {
    const status = item?.status || '';
    const badge = CONTRACT_SERVICE_STATUS_BADGE[status] || { bg: '#F1F5F9', color: '#64748B' };
    const serviceTasks = getServiceTasks(item);
    const results: any[] = Array.isArray(item?.results) ? item.results : [];
    const originalName = getServiceOriginalName(item);
    const hasNickname = Boolean(item?.nickname?.trim()) && Boolean(originalName);
    const code = getServiceCode(item);
    const hasDetails = serviceTasks.length > 0 || results.length > 0 || Boolean(item?.feedback);
    const isOpen = Boolean(expandedServices[String(item?.id)]);

    return (
      <View
        key={String(item?.id)}
        className="gap-2 rounded-xl border border-slate-200 bg-white p-3"
      >
        <View className="flex-row flex-wrap items-center justify-between gap-1.5">
          {code ? (
            <View className="rounded-md bg-blue-50 px-2 py-0.5">
              <Text className="text-[11px] font-bold text-blue-700">{code}</Text>
            </View>
          ) : (
            <View />
          )}
          <View className="rounded-md px-2 py-[3px]" style={{ backgroundColor: badge.bg }}>
            <Text className="text-[10px] font-bold" style={{ color: badge.color }}>
              {CONTRACT_SERVICE_STATUS_LABELS[status] || status || 'Chưa có trạng thái'}
            </Text>
          </View>
        </View>

        <Text className="text-[13px] font-bold text-slate-950">{getServiceName(item)}</Text>

        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-0.5">
          <Text className="text-[11px] font-semibold text-slate-400">
            {canSeeAllTasks
              ? `${serviceTasks.length} công việc`
              : `${serviceTasks.length} công việc của bạn`}
          </Text>
          <Text className="text-[11px] font-semibold text-slate-400">{results.length} kết quả</Text>
          {hasNickname ? (
            <Text className="text-[11px] italic text-slate-400">Gốc: {originalName}</Text>
          ) : null}
        </View>

        {renderProgress(serviceTasks)}

        {(canEditNickname || hasDetails) && (
          <View className="flex-row gap-2">
            {canEditNickname && (
              <TouchableOpacity
                className="h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50"
                onPress={() => openNicknameEditor(item)}
                activeOpacity={0.8}
              >
                <Feather name="edit-2" size={13} color="#475569" />
                <Text className="text-xs font-bold text-slate-600">Sửa tên</Text>
              </TouchableOpacity>
            )}
            {hasDetails && (
              <TouchableOpacity
                className="h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white"
                onPress={() => toggleService(String(item?.id))}
                activeOpacity={0.8}
              >
                <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#475569" />
                <Text className="text-xs font-bold text-slate-600">
                  {isOpen ? 'Thu gọn' : 'Chi tiết'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isOpen && hasDetails ? renderServiceDetails(item, serviceTasks, results) : null}
      </View>
    );
  };

  const summaryCards: Array<{ label: string; value: number; color: string }> = [
    { label: 'Tổng', value: summary.total, color: '#0F172A' },
    { label: 'Đang làm', value: summary.ACTIVE, color: '#1D4ED8' },
    { label: 'Chờ nghiệm thu', value: summary.AWAITING_ACCEPTANCE, color: '#B45309' },
    { label: 'Bị từ chối', value: summary.ACCEPTANCE_REJECTED, color: '#B91C1C' },
    { label: 'Hoàn tất', value: summary.COMPLETED, color: '#047857' },
  ];

  return (
    <View className="gap-3 p-4">
      <View className="flex-row items-center gap-2.5">
        <View className="h-11 w-11 items-center justify-center rounded-xl bg-orange-50">
          <Feather name="package" size={20} color={BrandColors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-slate-950">
            Hạng mục dịch vụ ({visibleServices.length})
          </Text>
          <Text className="text-xs text-slate-500">
            Xem nhanh trạng thái nghiệm thu, tiến độ công việc và kết quả theo từng gói.
          </Text>
        </View>
      </View>

      {/* Thống kê */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginHorizontal: -16 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      >
        {summaryCards.map((card) => (
          <View
            key={card.label}
            className="min-w-[104px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
          >
            <Text className="text-[10px] font-bold text-slate-400">{card.label}</Text>
            <Text className="mt-0.5 text-xl font-extrabold" style={{ color: card.color }}>
              {card.value}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Bộ lọc trạng thái */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginHorizontal: -16 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, alignItems: 'center' }}
      >
        {FILTER_OPTIONS.map((option) => {
          const isActive = statusFilter === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              className={`h-10 flex-row items-center gap-2 rounded-xl border px-3 ${
                isActive ? 'border-primary bg-orange-50' : 'border-slate-200 bg-white'
              }`}
              onPress={() => setStatusFilter(option.value)}
              activeOpacity={0.8}
            >
              <Text
                className={`text-xs ${isActive ? 'font-bold text-primary' : 'font-semibold text-slate-500'}`}
                numberOfLines={1}
              >
                {option.label}
              </Text>
              <View className={`rounded-full px-2 py-0.5 ${isActive ? 'bg-orange-100' : 'bg-slate-100'}`}>
                <Text className={`text-[10px] font-bold ${isActive ? 'text-primary' : 'text-slate-500'}`}>
                  {filterCounts[option.value] || 0}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {visibleServices.length === 0 ? (
        <View className="items-center justify-center gap-2 py-10">
          <Feather name="package" size={40} color="#CBD5E1" />
          <Text className="text-[15px] font-bold text-slate-600">Chưa có dịch vụ nào</Text>
          <Text className="max-w-[260px] text-center text-[13px] text-slate-400">
            {canSeeAllTasks
              ? 'Hợp đồng của dự án chưa có hạng mục dịch vụ nào.'
              : 'Bạn không có công việc nào trong các hạng mục dịch vụ của dự án.'}
          </Text>
        </View>
      ) : groupEntries.length === 0 ? (
        <View className="items-center justify-center gap-2 py-10">
          <Feather name="filter" size={36} color="#CBD5E1" />
          <Text className="text-[13px] text-slate-400">Không có dịch vụ phù hợp bộ lọc</Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {groupEntries.map(([groupName, items]) => {
            const isCollapsed = isGroupCollapsed(groupName);
            const awaiting = items.filter((i) => i.status === 'AWAITING_ACCEPTANCE').length;
            const rejected = items.filter((i) => i.status === 'ACCEPTANCE_REJECTED').length;

            return (
              <View
                key={groupName}
                className="overflow-hidden rounded-[14px] border border-slate-200 bg-white"
              >
                <TouchableOpacity
                  className={`flex-row items-center justify-between gap-2 bg-slate-50 px-3.5 py-3 ${
                    isCollapsed ? '' : 'border-b border-slate-100'
                  }`}
                  onPress={() => toggleGroup(groupName)}
                  activeOpacity={0.7}
                >
                  <View className="flex-1 flex-row items-center gap-2">
                    <Feather
                      name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                      size={18}
                      color="#475569"
                    />
                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5">
                        <Feather name="package" size={14} color={BrandColors.primary} />
                        <Text className="flex-1 text-[13px] font-bold text-slate-800" numberOfLines={1}>
                          {groupName}
                        </Text>
                      </View>
                      <Text className="mt-0.5 text-[11px] font-semibold text-slate-400" numberOfLines={1}>
                        {items.length} dịch vụ
                        {awaiting ? ` - ${awaiting} chờ nghiệm thu` : ''}
                        {rejected ? ` - ${rejected} bị từ chối` : ''}
                      </Text>
                    </View>
                  </View>

                  <View className="rounded-[10px] bg-slate-200 px-2 py-0.5">
                    <Text className="text-[11px] font-bold text-slate-600">{items.length}</Text>
                  </View>
                </TouchableOpacity>

                {!isCollapsed && (
                  <View className="gap-2.5 p-2.5">{items.map(renderServiceItem)}</View>
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
                maxLength={120}
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