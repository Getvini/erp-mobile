import { getTaskPolicy } from '@/utils/taskPolicy';
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { isManagementRole } from '@/utils/rbac';
import { queryKeys } from '@/services/queryKeys';
import { ProjectDetailItem, PROJECT_STATUS_CONFIG } from '@/services/projectService';
import { TaskDetail } from '@/services/taskService';
import { AcceptanceItem } from '@/services/acceptanceService';
import { BrandColors } from '@/constants/colors';

import ProjectOverviewTab from '@/components/projects/ProjectOverviewTab';
import ProjectBudgetSummaryCard from '@/components/projects/ProjectBudgetSummaryCard';
import ProjectTabHeader from '@/components/projects/ProjectTabHeader';
import ProjectTasksTab from '@/components/projects/ProjectTasksTab';
import ProjectAcceptanceTab from '@/components/projects/ProjectAcceptanceTab';
import ProjectMyTasksTab from '@/components/projects/ProjectMyTasksTab';
import ProjectServiceAddendumTab from '@/components/projects/ProjectServiceAddendumTab';
import ProjectExtraTasksTab from '@/components/projects/ProjectExtraTasksTab';
import PauseHistoryTab from '@/components/projects/PauseHistoryTab';
import PauseProjectModal from '@/components/projects/PauseProjectModal';
import CloseProjectModal from '@/components/projects/CloseProjectModal';
import { ProductDescriptionSection } from '@/components/projects/ProductDescriptionSection';

import AssignPmModal from '@/components/projects/AssignPmModal';
import TaskUpdateModal from '@/components/projects/TaskUpdateModal';
import AddProjectServiceModal from '@/components/projects/AddProjectServiceModal';
import CreateAcceptanceModal from '@/components/projects/CreateAcceptanceModal';
import AcceptanceReviewModal from '@/components/projects/AcceptanceReviewModal';
import AddTeamMemberModal from '@/components/projects/AddTeamMemberModal';
import EditTeamMemberRoleModal from '@/components/projects/EditTeamMemberRoleModal';
import TaskAssignModal from '@/components/projects/TaskAssignModal';
import { safeGoBack } from '@/utils/navigation';
import {
  getProjectManagerUser,
  hasTeamMemberRole,
  hasProjectAccount,
  PROJECT_ACCOUNT_REQUIRED_MESSAGE,
  getTeamMemberRoles,
  isProjectAccountUser,
  resolveEffectiveTeamMembers,
} from '@/utils/teamMember';
import {
  useProjectDetailQuery,
  useTeamMembersQuery,
  useConfirmProjectMutation,
  useRemoveTeamMemberMutation,
  useResumeProjectMutation,
  useSyncServiceJobsMutation,
  useRequestStaffingMutation,
} from '@/hooks/queries/useProjects';
import { useTasksByProjectQuery } from '@/hooks/queries/useTasks';
import { useAcceptancesQuery } from '@/hooks/queries/useAcceptances';
import { useProjectBudgetSummaryQuery } from '@/hooks/queries/usePaymentRequests';
import {
  PROJECT_MANAGEMENT_ROLES,
  ProjectPermissionContext,
  canCloseDirect,
  canPauseDirect,
  canRequestClose,
  canRequestPause,
  canResume,
  getDaysUntilAutoClose,
  isInReminderWindow,
  shouldShowPauseTab,
} from '@/utils/projectPause';
import { formatDateToDDMMYYYY } from '@/utils/formatters';
import { getAddServiceBlockReason } from '@/utils/projectServiceAddendum';

type TabKey =
  | 'OVERVIEW'
  | 'PRODUCT_DESC'
  | 'TASKS'
  | 'MY_TASKS'
  | 'SERVICES'
  | 'EXTRA_SERVICES'
  | 'EXTRA'
  | 'ACCEPTANCE'
  | 'PAUSE';

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('OVERVIEW');

  // TanStack Query for Project Detail
  const {
    data: projectData,
    isLoading: isProjectLoading,
    isFetching: isProjectFetching,
    refetch: refetchProject,
  } = useProjectDetailQuery(String(id || ''));

  const project: ProjectDetailItem | null = projectData || null;
  const budgetQuery = useProjectBudgetSummaryQuery(project?.id);
  const { data: teamMembersData, refetch: refetchTeamMembers } = useTeamMembersQuery(project?.team?.id);

  const confirmProjectMutation = useConfirmProjectMutation();
  const syncServiceJobsMutation = useSyncServiceJobsMutation();
  const requestStaffingMutation = useRequestStaffingMutation();
  const [showProjectStaffingModal, setShowProjectStaffingModal] = useState(false);
  const [projectStaffingNote, setProjectStaffingNote] = useState('');
  const isSyncing = syncServiceJobsMutation.isPending;
  const removeTeamMemberMutation = useRemoveTeamMemberMutation();
  const resumeProjectMutation = useResumeProjectMutation();

  const { data: tasksData, isLoading: isLoadingTasks, isFetching: isTasksFetching, refetch: refetchTasks } = useTasksByProjectQuery(String(id || ''));
  const projectTasks = project?.tasks;
  const tasks: TaskDetail[] = useMemo(() => {
    if (Array.isArray(projectTasks) && projectTasks.length > 0) {
      if (Array.isArray(tasksData) && tasksData.length > 0) {
        const tasksDataMap = new Map(tasksData.map((t) => [t.id, t]));
        return projectTasks.map((pt: any) => tasksDataMap.get(pt.id) || pt);
      }
      return projectTasks as TaskDetail[];
    }
    return tasksData || [];
  }, [projectTasks, tasksData]);
  const isTasksLoadingEffective = isLoadingTasks && (!project?.tasks || project.tasks.length === 0);

  const { data: acceptancesData, isLoading: isLoadingAcceptances, refetch: refetchAcceptances } = useAcceptancesQuery({ projectId: String(id || '') });
  const acceptances: AcceptanceItem[] = useMemo(() => acceptancesData || [], [acceptancesData]);

  const isLoading = isProjectLoading;
  const isRefreshing = isProjectFetching || isTasksFetching || budgetQuery.isFetching;

  // Modal & Confirm States
  const [showAssignPm, setShowAssignPm] = useState(false);
  const [showTaskUpdate, setShowTaskUpdate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
  const [assigningTask, setAssigningTask] = useState<TaskDetail | TaskDetail[] | null>(null);
  const [showAssignTask, setShowAssignTask] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [showCreateAcceptance, setShowCreateAcceptance] = useState(false);
  const [showReviewAcceptance, setShowReviewAcceptance] = useState(false);
  const [reviewingAcceptance, setReviewingAcceptance] = useState<AcceptanceItem | null>(null);
  const [showAddTeamMember, setShowAddTeamMember] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [showEditMemberRole, setShowEditMemberRole] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // P1.11 — Tạm dừng / Làm tiếp / Đóng dự án
  const [showPauseRequest, setShowPauseRequest] = useState(false);
  const [showPauseDirect, setShowPauseDirect] = useState(false);
  const [showCloseRequest, setShowCloseRequest] = useState(false);
  const [showCloseDirect, setShowCloseDirect] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  // Multi-select task state (không cần isSelectMode — checkbox luôn visible)
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // RBAC & Permission Calculations
  const effectiveTeamMembers = useMemo(
    () => resolveEffectiveTeamMembers(teamMembersData, project?.team?.members),
    [teamMembersData, project?.team?.members],
  );

  const isAdminOrBod = isManagementRole(user?.role);
  const projectHasAccount = hasProjectAccount(project, effectiveTeamMembers);
  const effectiveProject = project ? {
    ...project,
    team: project.team ? { ...project.team, members: effectiveTeamMembers } : undefined,
  } : null;
  const assignedPm = getProjectManagerUser(project, effectiveTeamMembers);
  const assignedPmId = assignedPm?.id;
  const isAssignedPm = !!user?.id && !!assignedPmId && assignedPmId === user.id;
  const leadUser =
    project?.team?.teamLead ||
    effectiveTeamMembers.find(
      (m) => hasTeamMemberRole(m, 'LEAD') && m.user?.id !== assignedPmId
    )?.user;
  const isCurrentTeamLead = !!user?.id && !!leadUser?.id && user.id === leadUser.id;

  // Mirror Web ProjectDetailPage.jsx:384: isProjectLead = TeamLead (TeamLead hoặc teamLeadId)
  const isProjectLead =
    isCurrentTeamLead ||
    (!!user?.id &&
      (project?.team?.teamLead?.id === user.id ||
        (project?.team as any)?.teamLeadId === user.id));
  const isAdmin = user?.role === 'ADMIN';
  const isCurrentProjectAccount = isProjectAccountUser(
    user?.id,
    project?.team?.teamLead?.id,
    effectiveTeamMembers,
  );
  const isOnHold = project?.status === 'ON_HOLD' || Boolean((project as any)?.isOnHold);
  const isClosed = ['COMPLETED', 'CANCELLED'].includes(project?.status || '');
  const isProjectInProgress =
    !isClosed && !isOnHold && ['IN_PROGRESS', 'CONFIRMED'].includes(project?.status || '');
  const canAssignPm = !isOnHold && !isClosed && isAdminOrBod && !assignedPmId;
  // Mirror Web ProjectDetailPage.jsx:407-409
  const canConfirmProject =
    !isOnHold &&
    !isClosed &&
    project?.status === 'PENDING_CONFIRMATION' &&
    (isAdmin || isCurrentProjectAccount);

  const canSyncServiceJobs =
    !isOnHold &&
    !isClosed &&
    (isAdmin || user?.role === 'PM') &&
    !isProjectLead;
  const addServiceBlockReason = getAddServiceBlockReason(
    user?.role, project?.status, Boolean((project as any)?.isOnHold),
  );
  const canAssignTasks = isProjectInProgress && (isAdmin || isCurrentProjectAccount || Boolean(user?.id && tasks.some(task => (task as any).supportLeadId === user.id)));
  const canManageTaskAssignment = useCallback(
    (task: TaskDetail): boolean => {
      if (!isProjectInProgress) return false;
      if (!projectHasAccount) return false;
      if (isAdmin) return true;
      if (!isCurrentProjectAccount) return false;
      const hasPerformer = Boolean(
        task.assigneeId || task.assignee?.id || (task as any).vendorId || (task as any).vendor,
      );
      if (!hasPerformer) return true;
      const assignerId = (task as any).assignerId;
      return !assignerId || assignerId === user?.id;
    },
    [isProjectInProgress, projectHasAccount, isAdmin, isCurrentProjectAccount, user?.id],
  );

  // Can manage team members: Admin OR (role PM AND project team role PROJECT_MANAGER), when project is active
  const isCurrentProjectManager =
    user?.role === 'PM' &&
    effectiveTeamMembers.some(
      (m: any) => m.user?.id === user?.id && hasTeamMemberRole(m, 'PROJECT_MANAGER')
    );
  const canManageTeam = !isClosed && !isOnHold && (isAdmin || isCurrentProjectManager);

  // ── P1.11: Tạm dừng / Làm tiếp / Đóng dự án ─────────────────────────────
  const projectExtras = project as any;
  const pauseCtx: ProjectPermissionContext = useMemo(
    () => ({
      role: user?.role,
      isTeamLead: isCurrentTeamLead,
      isProjectManagerMember:
        !!user?.id &&
        effectiveTeamMembers.some(
          (m: any) => m.user?.id === user.id && hasTeamMemberRole(m, 'PROJECT_MANAGER')
        ),
      isBdOwner:
        !!user?.id &&
        (project?.contract?.createdById === user.id || projectExtras?.createdById === user.id),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.role, user?.id, isCurrentTeamLead, effectiveTeamMembers, project?.contract?.createdById]
  );

  const canPauseDirectNow = projectHasAccount && canPauseDirect(project?.status, pauseCtx);
  const canRequestPauseNow = projectHasAccount && !canPauseDirectNow && canRequestPause(project?.status, pauseCtx);
  const canResumeNow = projectHasAccount && canResume(project?.status, pauseCtx);
  const canCloseDirectNow = projectHasAccount && canCloseDirect(project?.status, pauseCtx);
  const canRequestCloseNow = projectHasAccount && !canCloseDirectNow && canRequestClose(project?.status, pauseCtx);
  const hasProjectActions =
    canSyncServiceJobs ||
    canConfirmProject ||
    canPauseDirectNow ||
    canRequestPauseNow ||
    canResumeNow ||
    canCloseDirectNow ||
    canRequestCloseNow;

  const isPendingPauseApproval = project?.status === 'PENDING_PAUSE_APPROVAL';
  const autoAcceptAt: string | undefined = projectExtras?.autoAcceptAt;
  const pausedByName: string | undefined = projectExtras?.pausedBy?.fullName;
  const daysUntilAutoClose = getDaysUntilAutoClose(project?.status, autoAcceptAt);
  const inReminderWindow = isInReminderWindow(project?.status, autoAcceptAt);
  const showPauseTab = shouldShowPauseTab({
    status: project?.status,
    pausedAt: projectExtras?.pausedAt,
    role: user?.role,
  });

  // Thành viên dự án hoặc vai trò quản lý ⇒ thấy tab Dịch vụ (mirror isCoreMember của Web).
  const isCoreMember =
    isAdminOrBod ||
    isCurrentTeamLead ||
    PROJECT_MANAGEMENT_ROLES.includes(user?.role || '') ||
    effectiveTeamMembers.some((m: any) => m.user?.id === user?.id);

  const handleRemoveMember = async (memberId: string) => {
    if (!project?.team?.id) return;

    // Check if member to remove holds the ACCOUNT role and is the last one in the project
    const memberToRemove = (effectiveTeamMembers as any[]).find(
      (m: any) =>
        m.id === memberId ||
        (Array.isArray(m.memberships) && m.memberships.some((ms: any) => ms.id === memberId))
    );
    const targetUserId = memberToRemove?.user?.id || (memberToRemove as any)?.userId;

    const hasAccountRole =
      (memberToRemove &&
        (hasTeamMemberRole(memberToRemove, 'ACCOUNT') ||
          (Array.isArray((memberToRemove as any).roles) &&
            (memberToRemove as any).roles.some((r: any) => (typeof r === 'string' ? r : r?.role) === 'ACCOUNT')))) ||
      Boolean(targetUserId && targetUserId === leadUser?.id);

    if (hasAccountRole) {
      const otherAccountsCount = (effectiveTeamMembers as any[]).filter((m: any) => {
        const uId = m.user?.id || m.userId;
        if (uId === targetUserId) return false;
        const roles = Array.isArray(m.roles)
          ? m.roles.map((r: any) => (typeof r === 'string' ? r : r?.role))
          : (getTeamMemberRoles(m) as string[]);
        return roles.includes('ACCOUNT') || Boolean(leadUser?.id && uId === leadUser.id);
      }).length;

      if (otherAccountsCount === 0) {
        Alert.alert(
          'Không thể xóa',
          'Không thể xóa nhân sự này vì đây là người duy nhất giữ vai trò Account trong đội dự án. Vui lòng phân công nhân sự khác giữ vai trò này trước khi xóa.'
        );
        return;
      }
    }

    Alert.alert('Xác nhận xóa', 'Bạn có chắc chắn muốn xóa nhân sự này khỏi đội dự án?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeTeamMemberMutation.mutateAsync({
              teamId: project.team!.id,
              memberId,
            });
            Alert.alert('Thành công', 'Đã xóa nhân sự khỏi đội dự án.');
            loadProjectDetail();
          } catch (err: any) {
            Alert.alert('Lỗi', err?.message || 'Không thể xóa nhân sự.');
          }
        },
      },
    ]);
  };

  const handleSyncServiceJobs = async () => {
    if (!id || !canSyncServiceJobs) return;
    try {
      await syncServiceJobsMutation.mutateAsync(id);
      Alert.alert('Thành công', 'Đã đồng bộ công việc dịch vụ thành công.');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi đồng bộ công việc dịch vụ.');
    }
  };

  const handleRequestProjectStaffing = async () => {
    if (!id || !projectStaffingNote.trim()) {
      Alert.alert('Cảnh báo', 'Vui lòng nhập lý do hoặc yêu cầu nhân sự');
      return;
    }
    try {
      await requestStaffingMutation.mutateAsync({ id, note: projectStaffingNote.trim() });
      Alert.alert('Thành công', 'Đã gửi yêu cầu bổ sung nhân sự cho dự án');
      setShowProjectStaffingModal(false);
      setProjectStaffingNote('');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi gửi yêu cầu bổ sung nhân sự');
    }
  };

  const handleConfirmProject = async () => {
    if (!id || !canConfirmProject) return;
    setIsConfirming(true);
    try {
      await confirmProjectMutation.mutateAsync(id);
      Alert.alert('Thành công', 'Đã chấp nhận dự án thành công.');
      refetchTasks();
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Có lỗi xảy ra khi chấp nhận dự án.');
    } finally {
      setIsConfirming(false);
    }
  };

  const loadProjectDetail = useCallback(() => {
    refetchProject();
  }, [refetchProject]);

  const loadTasks = useCallback(() => {
    refetchTasks();
  }, [refetchTasks]);

  const loadAcceptances = useCallback(() => {
    refetchAcceptances();
  }, [refetchAcceptances]);

  const isTaskAssignable = useCallback((task: TaskDetail): boolean =>
    getTaskPolicy(task, user, { project, members: effectiveTeamMembers, assignmentContext: 'batch' }).assign.enabled,
    [user, project, effectiveTeamMembers],
  );

  const assignableTasks = useMemo(() => tasks.filter(isTaskAssignable), [tasks, isTaskAssignable]);
  const assignableTaskIdSet = useMemo(
    () => new Set(assignableTasks.map((t) => t.id)),
    [assignableTasks]
  );

  const validSelectedTaskIds = useMemo(() => {
    return selectedTaskIds.filter((id) => assignableTaskIdSet.has(id));
  }, [selectedTaskIds, assignableTaskIdSet]);

  const handleToggleSelectTask = useCallback((taskId: string) => {
    if (!tasks.some(task => task.id === taskId && isTaskAssignable(task))) return;
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }, [tasks, isTaskAssignable]);

  const handleToggleSelectGroup = useCallback((groupTasks: TaskDetail[]) => {
    const assignableIds = groupTasks.filter(isTaskAssignable).map((t) => t.id);
    if (assignableIds.length === 0) return;

    setSelectedTaskIds((prev) => {
      const prevSet = new Set(prev);
      const isAllGroupSelected = assignableIds.every((id) => prevSet.has(id));
      if (isAllGroupSelected) {
        return prev.filter((id) => !assignableIds.includes(id));
      }
      return Array.from(new Set([...prev, ...assignableIds]));
    });
  }, [isTaskAssignable]);

  const handleSelectAllTasks = useCallback(() => {
    setSelectedTaskIds((prev) => {
      const validIds = prev.filter((id) => assignableTaskIdSet.has(id));
      if (validIds.length === assignableTasks.length) {
        return [];
      }
      return assignableTasks.map((t) => t.id);
    });
  }, [assignableTaskIdSet, assignableTasks]);

  const handleAssignTaskAction = useCallback((t: TaskDetail | TaskDetail[]) => {
    if ((Array.isArray(t) ? t : [t]).some(item => !getTaskPolicy(item, user, { project, members: effectiveTeamMembers, assignmentContext: Array.isArray(t) ? 'batch' : undefined })[
      Array.isArray(t) ? 'assign' : item.assigneeId || item.assignee?.id || (item as any).vendor ? 'reassign' : 'assign'].enabled)) return;
    if (!Array.isArray(t)) {
      setSelectedTaskIds((prev) => prev.filter((taskId) => taskId !== t.id));
    }
    setAssigningTask(t);
    setShowAssignTask(true);
  }, [user, project, effectiveTeamMembers]);

  const handleOpenAddServiceAction = useCallback(() => {
    if (addServiceBlockReason) {
      Alert.alert('Không thể thêm dịch vụ', addServiceBlockReason);
      return;
    }
    setShowAddService(true);
  }, [addServiceBlockReason]);

  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    const projId = String(id || '');
    if (!projId) return;

    // 1. Luôn refetch thông tin chi tiết dự án (bao gồm Mô tả sản phẩm, Lịch sử tạm dừng, Phụ lục)
    const refreshPromises: Promise<any>[] = [
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(projId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentRequests.projectBudgetSummary(projId) }),
    ];

    // 2. Phân loại theo activeTab để chỉ refresh đúng API phân hệ đó
    switch (activeTab) {
      case 'TASKS':
      case 'MY_TASKS':
      case 'EXTRA':
        refreshPromises.push(
          refetchTasks(),
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list({ projectId: projId }) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projId) })
        );
        break;
      case 'ACCEPTANCE':
        refreshPromises.push(
          queryClient.invalidateQueries({ queryKey: queryKeys.acceptances.list({ projectId: projId }) })
        );
        break;
      case 'OVERVIEW':
        refreshPromises.push(
          refetchTasks(),
          refetchTeamMembers(),
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list({ projectId: projId }) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.byProject(projId) })
        );
        break;
      // PRODUCT_DESC, SERVICES, EXTRA_SERVICES, PAUSE đã được làm mới qua queryKeys.projects.detail(projId)
    }

    await Promise.all(refreshPromises);
  }, [id, activeTab, queryClient, refetchTasks, refetchTeamMembers]);

  /** "Làm tiếp" chỉ cần xác nhận, không có form lý do (mirror Web handleResume). */
  const handleResumeProject = () => {
    if (!id) return;
    Alert.alert('Làm tiếp dự án', 'Mở lại dự án và khôi phục các công việc đang tạm dừng?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Làm tiếp',
        onPress: async () => {
          setIsResuming(true);
          try {
            await resumeProjectMutation.mutateAsync({ id: String(id) });
            Alert.alert('Thành công', 'Đã mở lại dự án.');
            handleRefresh();
          } catch (err: any) {
            Alert.alert('Lỗi', err?.message || 'Không thể mở lại dự án.');
          } finally {
            setIsResuming(false);
          }
        },
      },
    ]);
  };

  const getStatusBadge = (status?: string) => {
    const stKey = status || 'PENDING_CONFIRMATION';
    const config = PROJECT_STATUS_CONFIG[stKey];
    return {
      bg: config?.bg || '#F1F5F9',
      color: config?.color || '#64748B',
      label: config?.text || stKey,
    };
  };

  const taskStats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'DONE' || t.status === 'COMPLETED' || t.status === 'ACCEPTED').length,
    doing: tasks.filter((t) => t.status === 'DOING' || t.status === 'AWAITING_REVIEW').length,
    pending: tasks.filter((t) => t.status === 'PENDING').length,
  };

  if (isLoading && !isRefreshing) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
        <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200 gap-2">
          <TouchableOpacity className="w-[38px] h-[38px] rounded-xl bg-slate-100 items-center justify-center" onPress={() => safeGoBack(router, '/projects')}>
            <Feather name="arrow-left" size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-slate-900">Chi tiết dự án</Text>
          <View className="w-10" />
        </View>
        <View className="flex-1 justify-center items-center gap-2.5">
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text className="text-[13px] text-slate-400">Đang tải chi tiết dự án...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusInfo = getStatusBadge(project?.status);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-200 gap-2">
        <TouchableOpacity className="w-[38px] h-[38px] rounded-xl bg-slate-100 items-center justify-center" onPress={() => safeGoBack(router, '/projects')} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <View className="flex-1">
          <Text className="text-base font-bold text-slate-900" numberOfLines={1}>
            {project?.name || 'Chi tiết Dự án'}
          </Text>
          {project?.code && <Text className="text-[11px] text-slate-500 font-semibold">#{project.code}</Text>}
        </View>

        <View className="px-2 py-1 rounded-md" style={{ backgroundColor: statusInfo.bg }}>
          <Text className="text-[11px] font-bold" style={{ color: statusInfo.color }}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {!projectHasAccount && (
        <View className="mx-3 mt-3 flex-row items-start gap-2.5 rounded-2xl border border-orange-200 bg-orange-50 p-3.5">
          <Feather name="lock" size={20} color="#9A3412" />
          <Text className="flex-1 text-sm text-orange-900">{PROJECT_ACCOUNT_REQUIRED_MESSAGE}</Text>
        </View>
      )}

      {/* Banner trạng thái tạm dừng / chờ duyệt tạm dừng (P1.11) */}
      {isOnHold && (
        <View
          className={`mx-3 mt-3 flex-row items-start gap-2.5 rounded-2xl border p-3.5 ${inReminderWindow ? 'border-red-200 bg-red-50/70' : 'border-amber-200 bg-amber-50/70'
            }`}
        >
          <View
            className={`h-10 w-10 items-center justify-center rounded-xl ${inReminderWindow ? 'bg-red-600' : 'bg-amber-500'
              }`}
          >
            <Feather
              name={inReminderWindow ? 'alert-triangle' : 'clock'}
              size={20}
              color="#FFFFFF"
            />
          </View>
          <View className="flex-1 gap-0.5">
            <Text
              className={`text-[13px] font-bold ${inReminderWindow ? 'text-red-900' : 'text-amber-900'
                }`}
            >
              Dự án đang tạm dừng
              {daysUntilAutoClose !== null ? ` — còn ${daysUntilAutoClose} ngày sẽ tự động đóng` : ''}
            </Text>
            {autoAcceptAt ? (
              <Text
                className={`text-[11px] font-medium ${inReminderWindow ? 'text-red-700' : 'text-amber-700'
                  }`}
              >
                Tự động đóng lúc: {formatDateToDDMMYYYY(autoAcceptAt, '—')}
              </Text>
            ) : null}
            {pausedByName ? (
              <Text
                className={`text-[11px] font-medium ${inReminderWindow ? 'text-red-700' : 'text-amber-700'
                  }`}
              >
                Người tạm dừng: {pausedByName}
              </Text>
            ) : null}
            {inReminderWindow ? (
              <Text className="text-[11px] font-semibold text-red-700">
                Hệ thống đang gửi nhắc nhở hằng ngày. Hãy chốt đóng dự án hoặc làm tiếp trước hạn.
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {isPendingPauseApproval && (
        <View className="mx-3 mt-3 flex-row items-start gap-2.5 rounded-2xl border border-yellow-200 bg-yellow-50/70 p-3.5">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-yellow-500">
            <Feather name="clock" size={20} color="#FFFFFF" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-[13px] font-bold text-yellow-900">
              Đang chờ BOD duyệt yêu cầu tạm dừng
            </Text>
            <Text className="text-[11px] font-medium text-yellow-800">
              Dự án vẫn đang chạy bình thường. Yêu cầu cần được BOD/ADMIN duyệt ở tab Lịch sử tạm
              dừng.
            </Text>
          </View>
        </View>
      )}

      {/* Cụm nút hành động — chỉ render khi đủ quyền (RBAC ẩn hoàn toàn) */}
      {hasProjectActions && (
        <View className="gap-2 border-b border-slate-100 bg-white px-3 pb-3 pt-3">
          {/* Nút Đồng bộ & Chấp nhận dự án (chuẩn Web) */}
          {(canSyncServiceJobs || canConfirmProject) && (
            <View className="flex-row gap-2">
              {canSyncServiceJobs && (
                <TouchableOpacity
                  className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-primary ${
                    isSyncing ? 'opacity-60' : ''
                  }`}
                  onPress={handleSyncServiceJobs}
                  disabled={isSyncing}
                  activeOpacity={0.85}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="refresh-cw" size={16} color="#FFFFFF" />
                      <Text className="text-sm font-bold text-white" numberOfLines={1}>
                        Đồng bộ
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {canConfirmProject && (
                <TouchableOpacity
                  className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-600 ${
                    isConfirming ? 'opacity-60' : ''
                  }`}
                  onPress={handleConfirmProject}
                  disabled={isConfirming}
                  activeOpacity={0.85}
                >
                  {isConfirming ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="check-circle" size={16} color="#FFFFFF" />
                      <Text className="text-sm font-bold text-white" numberOfLines={1}>
                        Chấp nhận
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
          {(canResumeNow || canCloseDirectNow || canRequestCloseNow) && (
            <View className="flex-row gap-2">
              {canResumeNow && (
                <TouchableOpacity
                  className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-600 ${isResuming ? 'opacity-60' : ''
                    }`}
                  onPress={handleResumeProject}
                  disabled={isResuming}
                  activeOpacity={0.85}
                >
                  {isResuming ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="play" size={16} color="#FFFFFF" />
                      <Text className="text-sm font-bold text-white" numberOfLines={1}>Làm tiếp</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {canCloseDirectNow && (
                <TouchableOpacity
                  className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-red-600"
                  onPress={() => setShowCloseDirect(true)}
                  activeOpacity={0.85}
                >
                  <Feather name="archive" size={16} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white" numberOfLines={1}>Đóng dự án</Text>
                </TouchableOpacity>
              )}

              {canRequestCloseNow && (
                <TouchableOpacity
                  className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-slate-800"
                  onPress={() => setShowCloseRequest(true)}
                  activeOpacity={0.85}
                >
                  <Feather name="archive" size={16} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white" numberOfLines={1}>Đề nghị đóng</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {canPauseDirectNow && (
            <TouchableOpacity
              className="h-12 w-full flex-row items-center justify-center gap-2 rounded-2xl bg-orange-500"
              onPress={() => setShowPauseDirect(true)}
              activeOpacity={0.85}
            >
              <Feather name="pause" size={16} color="#FFFFFF" />
              <Text className="text-sm font-bold text-white">Tạm dừng ngay</Text>
            </TouchableOpacity>
          )}

          {canRequestPauseNow && (
            <TouchableOpacity
              className="h-12 w-full flex-row items-center justify-center gap-2 rounded-2xl bg-orange-500"
              onPress={() => setShowPauseRequest(true)}
              activeOpacity={0.85}
            >
              <Feather name="pause" size={16} color="#FFFFFF" />
              <Text className="text-sm font-bold text-white">Yêu cầu tạm dừng hợp đồng</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Tab Switcher */}
      <View className="bg-white border-b border-slate-200 px-3 py-2.5">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
        >
          {[
            { key: 'OVERVIEW', label: 'Tổng quan', icon: 'grid' },
            { key: 'PRODUCT_DESC', label: 'Thông tin chuẩn', icon: 'file-text' },
            { key: 'TASKS', label: `Công việc (${tasks.length})`, icon: 'check-square' },
            {
              key: 'MY_TASKS',
              label: `Công việc của tôi (${tasks.filter(
                (t) => t.assigneeId === user?.id || (t as any).assignee?.id === user?.id
              ).length
                })`,
              icon: 'user-check',
            },
            ...(isCoreMember
              ? [
                  { key: 'SERVICES', label: 'Dịch vụ', icon: 'package' },
                  { key: 'EXTRA_SERVICES', label: 'Dịch vụ phát sinh', icon: 'package' },
                ]
              : []),
            { key: 'EXTRA', label: 'Công việc phát sinh', icon: 'alert-circle' },
            { key: 'ACCEPTANCE', label: `Nghiệm thu (${acceptances.length})`, icon: 'award' },
            ...(showPauseTab
              ? [{ key: 'PAUSE', label: 'Lịch sử tạm dừng', icon: 'clock' }]
              : []),
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key as any)}
                activeOpacity={0.7}
                className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-xl border ${isActive
                  ? 'bg-orange-50 border-orange-100'
                  : 'bg-slate-50 border-slate-200'
                  }`}
              >
                <Feather
                  name={tab.icon as any}
                  size={13}
                  color={isActive ? BrandColors.primary : '#64748B'}
                />
                <Text
                  className={`text-xs ${isActive ? 'text-primary font-bold' : 'text-slate-600 font-semibold'
                    }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Area — tab PAUSE dùng FlatList riêng (không lồng trong ScrollView) */}
      {activeTab === 'PAUSE' ? (
        <PauseHistoryTab
          projectId={String(id || '')}
          projectName={project?.name}
          onChanged={handleRefresh}
        />
      ) : activeTab === 'TASKS' ? (
        <ProjectTasksTab
          project={{ ...project, team: { ...project?.team, members: effectiveTeamMembers } }}
          tasks={tasks}
          isLoading={isTasksLoadingEffective}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          projectStatus={project?.status}
          canAssignTasks={canAssignTasks}
          canCreateProjectWork={!addServiceBlockReason}
          canManageTaskAssignment={canManageTaskAssignment}
          selectedTaskIds={validSelectedTaskIds}
          onToggleSelectTask={handleToggleSelectTask}
          onToggleSelectGroup={handleToggleSelectGroup}
          onAssignTask={handleAssignTaskAction}
          onOpenAddService={handleOpenAddServiceAction}
          isProjectLead={isProjectInProgress && (isProjectLead || isCurrentProjectAccount)}
          onOpenRequestStaffing={() => setShowProjectStaffingModal(true)}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[BrandColors.primary]}
              tintColor={BrandColors.primary}
            />
          }
        >
          {activeTab === 'OVERVIEW' && project && (
            <View className="p-4 gap-3.5">
              <ProjectTabHeader
                icon="grid"
                title="Tổng quan dự án"
                subtitle={
                  project.contract?.contractCode
                    ? `Hợp đồng: ${project.contract.contractCode}`
                    : project.code
                      ? `Mã dự án: ${project.code}`
                      : 'Thông tin chung và tiến độ thực hiện'
                }
              />
              <ProjectBudgetSummaryCard
                summary={budgetQuery.data}
                isLoading={budgetQuery.isPending}
                isError={budgetQuery.isError}
                isFetching={budgetQuery.isFetching}
                onRetry={() => { void budgetQuery.refetch(); }}
              />
              <ProjectOverviewTab
                project={project}
                teamMembers={effectiveTeamMembers}
                user={user}
                onOpenAssignPm={() => setShowAssignPm(true)}
                onConfirmProject={handleConfirmProject}
                isConfirming={isConfirming}
                canAssignPm={canAssignPm}
                canConfirmProject={canConfirmProject}
                taskStats={taskStats}
                onOpenAddMember={() => setShowAddTeamMember(true)}
                onRemoveMember={handleRemoveMember}
                onEditMemberRole={(m) => {
                  setEditingMember(m);
                  setShowEditMemberRole(true);
                }}
                canManageTeam={canManageTeam}
              />
            </View>
          )}

          {activeTab === 'PRODUCT_DESC' && project && (
            <View className="p-4">
              <ProductDescriptionSection projectId={project.id} user={user} project={effectiveProject} />
            </View>
          )}

          {activeTab === 'MY_TASKS' && (
            <ProjectMyTasksTab
              project={{ ...project, team: { ...project?.team, members: effectiveTeamMembers } }}
              projectId={String(id || '')}
              tasks={tasks}
              isLoading={isTasksLoadingEffective}
              currentUserId={user?.id}
              projectHasAccount={projectHasAccount}
              projectStatus={project?.status}
              onChanged={handleRefresh}
            />
          )}

          {activeTab === 'SERVICES' && isCoreMember && (
            <ProjectServiceAddendumTab
              project={effectiveProject}
              user={user}
              tasks={tasks}
              budgetSummary={budgetQuery.data}
              onChanged={handleRefresh}
            />
          )}

          {activeTab === 'EXTRA_SERVICES' && isCoreMember && (
            <ProjectServiceAddendumTab
              project={effectiveProject}
              user={user}
              tasks={tasks}
              budgetSummary={budgetQuery.data}
              onChanged={handleRefresh}
              serviceScope="extra"
            />
          )}

          {activeTab === 'EXTRA' && (
            <ProjectExtraTasksTab
              tasks={tasks}
              isLoading={isTasksLoadingEffective}
              projectId={String(id || '')}
            />
          )}

          {activeTab === 'ACCEPTANCE' && (
            <ProjectAcceptanceTab
              acceptances={acceptances}
              isLoading={isLoadingAcceptances}
              projectStatus={project?.status}
              projectHasAccount={projectHasAccount}
              projectIsOnHold={(project as any)?.isOnHold}
              onOpenCreateAcceptance={() => setShowCreateAcceptance(true)}
              onOpenReviewAcceptance={(item) => {
                setReviewingAcceptance(item);
                setShowReviewAcceptance(true);
              }}
            />
          )}
        </ScrollView>
      )}

      {/* Floating Bulk Action Bar — hiện khi có ít nhất 1 task được tích chọn */}
      {activeTab === 'TASKS' && canAssignTasks && validSelectedTaskIds.length > 0 && (
        <View
          className="absolute bottom-5 left-4 right-4 flex-row justify-between items-center bg-white px-4 py-3 rounded-2xl z-50 border border-orange-100"
          style={{
            shadowColor: '#F38820',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.18,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <TouchableOpacity
            className="py-1.5 px-2"
            onPress={handleSelectAllTasks}
            activeOpacity={0.7}
          >
            <Text className="text-[13px] font-semibold text-slate-600">
              {validSelectedTaskIds.length > 0 && validSelectedTaskIds.length === assignableTasks.length
                ? 'Bỏ chọn tất cả'
                : 'Chọn tất cả'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center gap-2 bg-primary px-4 py-2.5 rounded-xl"
            onPress={() => {
              const selectedList = tasks.filter((t) => validSelectedTaskIds.includes(t.id));
              if (selectedList.length > 0) {
                setAssigningTask(selectedList);
                setShowAssignTask(true);
              }
            }}
            activeOpacity={0.8}
          >
            <Feather name="users" size={15} color="#FFFFFF" />
            <Text className="text-[13px] font-bold text-white">
              Phân công ({validSelectedTaskIds.length}) công việc
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modals — chỉ render khi visible để giảm tải cây DOM và tránh re-render thừa */}
      {id && (
        <>
          {showAssignPm && (
            <AssignPmModal
              visible={showAssignPm}
              onClose={() => setShowAssignPm(false)}
              projectId={id}
              contractId={project?.contract?.id || (project as any)?.contractId || (project as any)?.contract_id}
              currentPmId={assignedPmId}
              onSuccess={() => {
                loadProjectDetail();
              }}
            />
          )}

          {showAddTeamMember && project?.team?.id && (
            <AddTeamMemberModal
              visible={showAddTeamMember}
              onClose={() => setShowAddTeamMember(false)}
              teamId={project.team.id}
              existingMemberUserIds={
                effectiveTeamMembers.map((m) => m.user?.id).filter((uid): uid is string => !!uid) || []
              }
              existingMembers={effectiveTeamMembers}
              existingLeadName={leadUser?.fullName}
              existingLeadUserId={leadUser?.id}
              onSuccess={() => {
                loadProjectDetail();
              }}
            />
          )}

          {showEditMemberRole && project?.team?.id && (
            <EditTeamMemberRoleModal
              visible={showEditMemberRole}
              onClose={() => {
                setShowEditMemberRole(false);
                setEditingMember(null);
              }}
              teamId={project.team.id}
              member={editingMember}
              existingLeadName={leadUser?.fullName}
              existingLeadUserId={leadUser?.id}
              existingMembers={effectiveTeamMembers}
              onSuccess={() => {
                loadProjectDetail();
              }}
            />
          )}

          {showTaskUpdate && projectHasAccount && (
            <TaskUpdateModal
              visible={showTaskUpdate}
              onClose={() => {
                setShowTaskUpdate(false);
                setSelectedTask(null);
              }}
              task={selectedTask}
              onSuccess={() => {
                loadTasks();
                loadProjectDetail();
              }}
            />
          )}

          {showAssignTask && (
            <TaskAssignModal
              visible={showAssignTask}
              onClose={() => {
                setShowAssignTask(false);
                setAssigningTask(null);
              }}
              task={assigningTask}
              assignmentContext={Array.isArray(assigningTask) ? 'batch' : undefined}
              project={project}
              teamMembers={effectiveTeamMembers}
              onSuccess={() => {
                loadTasks();
                loadProjectDetail();
                if (Array.isArray(assigningTask)) {
                  const assignedIds = assigningTask.map((t) => t.id);
                  setSelectedTaskIds((prev) => prev.filter((id) => !assignedIds.includes(id)));
                } else if (assigningTask) {
                  setSelectedTaskIds((prev) => prev.filter((id) => id !== assigningTask.id));
                }
              }}
            />
          )}

          {showAddService && project && (
            <AddProjectServiceModal
              project={project}
              role={user?.role}
              onClose={() => setShowAddService(false)}
            />
          )}

          {showCreateAcceptance && projectHasAccount && (
            <CreateAcceptanceModal
              visible={showCreateAcceptance}
              onClose={() => setShowCreateAcceptance(false)}
              contract={project?.contract}
              projectId={id}
              onSuccess={() => {
                loadAcceptances();
                loadProjectDetail();
              }}
            />
          )}

          {showReviewAcceptance && projectHasAccount && (
            <AcceptanceReviewModal
              visible={showReviewAcceptance}
              onClose={() => {
                setShowReviewAcceptance(false);
                setReviewingAcceptance(null);
              }}
              request={reviewingAcceptance}
              onSuccess={() => {
                loadAcceptances();
                loadProjectDetail();
              }}
            />
          )}

          {/* P1.11 — Tạm dừng / Đóng dự án */}
          {showPauseRequest && (
            <PauseProjectModal
              visible={showPauseRequest}
              onClose={() => setShowPauseRequest(false)}
              projectId={id}
              projectName={project?.name}
              isDirect={false}
              onSuccess={handleRefresh}
            />
          )}

          {showPauseDirect && (
            <PauseProjectModal
              visible={showPauseDirect}
              onClose={() => setShowPauseDirect(false)}
              projectId={id}
              projectName={project?.name}
              isDirect
              onSuccess={handleRefresh}
            />
          )}

          {showCloseRequest && (
            <CloseProjectModal
              visible={showCloseRequest}
              onClose={() => setShowCloseRequest(false)}
              projectId={id}
              projectName={project?.name}
              isDirect={false}
              onSuccess={handleRefresh}
            />
          )}

          {showCloseDirect && (
            <CloseProjectModal
              visible={showCloseDirect}
              onClose={() => setShowCloseDirect(false)}
              projectId={id}
              projectName={project?.name}
              isDirect
              onSuccess={handleRefresh}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
