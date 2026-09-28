import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ProjectDetailItem } from '@/services/projectService';
import { TeamMember, TEAM_MEMBER_ROLE_LABELS, USER_ROLE } from '@/services/teamService';
import { BrandColors } from '@/constants/colors';
import { formatNumber, formatDateToDDMMYYYY } from '@/utils/formatters';
import { getProjectManagerUser, hasTeamMemberRole, groupTeamMembers, getUserAccountRole } from '@/utils/teamMember';
import { WorkloadBadge } from '@/components/common/WorkloadBadge';
import { ProjectWorkingFilesSection } from '@/components/projects/ProjectWorkingFilesSection';
import { DatePickerModal } from '@/components/common/DatePickerModal';
import { useUpdateProjectMutation } from '@/hooks/queries/useProjects';


interface ProjectOverviewTabProps {
  project: ProjectDetailItem;
  teamMembers?: TeamMember[];
  user?: any;
  onOpenAssignPm: () => void;
  onConfirmProject?: () => void;
  isConfirming?: boolean;
  canAssignPm?: boolean;
  canConfirmProject?: boolean;
  taskStats: {
    total: number;
    completed: number;
    doing: number;
    pending: number;
  };
  onOpenAddMember?: () => void;
  onRemoveMember?: (memberId: string) => void;
  onEditMemberRole?: (member: any) => void;
  canManageTeam?: boolean;
  onOpenCreateMonthlyWork?: () => void;
  canCreateMonthlyWork?: boolean;
}

export default function ProjectOverviewTab({
  project,
  teamMembers,
  user,
  onOpenAssignPm,
  onConfirmProject,
  isConfirming,
  canAssignPm = false,
  canConfirmProject = false,
  taskStats,
  onOpenAddMember,
  onRemoveMember,
  onEditMemberRole,
  canManageTeam = false,
  onOpenCreateMonthlyWork,
  canCreateMonthlyWork = false,
}: ProjectOverviewTabProps) {
  const router = useRouter();
  const effectiveMembers = (teamMembers && teamMembers.length > 0) ? teamMembers : (project.team?.members || []);


  const pmUser = getProjectManagerUser(project, effectiveMembers);
  const pm = pmUser;
  const leadUser =
    project.team?.teamLead ||
    effectiveMembers.find(
      (m) => hasTeamMemberRole(m, 'LEAD') && m.user?.id !== pmUser?.id
    )?.user;
  const saleorAdminSale = user?.role === 'BD' || user?.role === 'SALE' || user?.role === 'ADMIN_SALE';
  const isBODOrAdminSaleOrAdmin = user?.role === 'BOD' || user?.role === 'ADMIN_SALE' || user?.role === 'ADMIN';
  const team = project.team;
  const contract = project.contract;
  const progress = project.progress ?? 0;

  const startDateStr =
    project.plannedStartDate ||
    (project.contract as any)?.plannedStartDate;
  const endDateStr =
    project.plannedEndDate ||
    (project.contract as any)?.plannedEndDate;


  const handleOpenAttachment = (url?: string) => {
    if (url) {
      Linking.openURL(url).catch((err) => {
        console.log('Cannot open attachment URL:', err);
      });
    }
  };

  const isClosed = ['COMPLETED', 'CANCELLED'].includes(project.status);
  const isOnHold = project.status === 'ON_HOLD' || Boolean((project as any).isOnHold);
  const isAssignedPm = pmUser?.id === user?.id && getUserAccountRole(user) === 'PM';
  const canEditTimeline = !isClosed && !isOnHold && (getUserAccountRole(user) === 'ADMIN' || isAssignedPm);

  // Timeline edit state
  const [editingTimeline, setEditingTimeline] = useState(false);
  const [timelineForm, setTimelineForm] = useState({
    plannedStartDate: startDateStr || '',
    plannedEndDate: endDateStr || '',
  });
  const [datePickerField, setDatePickerField] = useState<'plannedStartDate' | 'plannedEndDate' | null>(null);
  const updateProjectMutation = useUpdateProjectMutation();

  const hasTimelineChanges =
    timelineForm.plannedStartDate !== (startDateStr || '') ||
    timelineForm.plannedEndDate !== (endDateStr || '');

  const handleSaveTimeline = async () => {
    if (!canEditTimeline || !project.id) return;

    if(!timelineForm.plannedStartDate || !timelineForm.plannedEndDate){
      Alert.alert('Lỗi', 'Ngày bắt đầu và ngày kết thúc không được để trống');
      return;
    }

    if(timelineForm.plannedStartDate > timelineForm.plannedEndDate){
      Alert.alert('Lỗi', 'Ngày bắt đầu phải nhỏ hơn ngày kết thúc');
      return;
    }

    try {
      await updateProjectMutation.mutateAsync({
        id: project.id,
        plannedStartDate: timelineForm.plannedStartDate || null,
        plannedEndDate: timelineForm.plannedEndDate || null,
      });
      setEditingTimeline(false);
      Alert.alert('Thành công', 'Đã cập nhật tiến trình dự án');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể cập nhật tiến trình dự án');
    }
  };

  const [currentTimestamp] = useState(() => Date.now());


  const timeline = useMemo(() => {
    if (!startDateStr || !endDateStr) return null;
    const start = new Date(startDateStr).getTime();
    const end = new Date(endDateStr).getTime();
    if (isNaN(start) || isNaN(end) || end <= start) return null;

    const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.round((currentTimestamp - start) / (1000 * 60 * 60 * 24)));
    const diffFromEnd = Math.round((end - currentTimestamp) / (1000 * 60 * 60 * 24));
    const percentElapsed = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
    const isOverdue = diffFromEnd < 0;

    return {
      startDateFormatted: formatDateToDDMMYYYY(startDateStr),
      endDateFormatted: formatDateToDDMMYYYY(endDateStr),
      totalDays,
      elapsedDays,
      diffDays: Math.abs(diffFromEnd),
      percentElapsed,
      isOverdue,
    };
  }, [startDateStr, endDateStr, currentTimestamp]);

  return (
    <>
    <View className="p-4 gap-3.5">
      {/* 1. Missing PM Banner */}
      {!pm && (
        <View className="bg-amber-100 border border-amber-300 rounded-2xl p-4 gap-3">
          <View className="flex-row items-start gap-2.5">
            <Feather name="alert-triangle" size={20} color="#D97706" />
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-amber-800 mb-0.5">Dự án chưa có PM phụ trách</Text>
              <Text className="text-xs text-amber-900 leading-4.5">
                Dự án này chưa được phân công PM phụ trách. Vui lòng phân công PM tuân thủ đúng quy trình hợp đồng.
              </Text>
            </View>
          </View>
          {canAssignPm && (
            <TouchableOpacity
              className="flex-row items-center justify-center gap-1.5 bg-primary py-2.5 rounded-xl"
              onPress={onOpenAssignPm}
              activeOpacity={0.8}
            >
              <Feather name="user-plus" size={14} color="#FFFFFF" />
              <Text className="text-sm font-bold text-white">Phân công PM ngay</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 2. Pending Confirmation Banner */}
      {leadUser && project.status === 'PENDING_CONFIRMATION' && (
        <View className="bg-orange-50 border border-orange-200 rounded-2xl p-4 gap-3">
          <View className="flex-row items-start gap-2.5">
            <Feather name="clock" size={20} color="#C2410C" />
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-orange-800 mb-0.5">Dự án đang chờ Account xác nhận</Text>
            </View>
          </View>

          {canConfirmProject ? (
            <TouchableOpacity
              className="flex-row items-center justify-center gap-1.5 bg-emerald-600 py-2.5 rounded-xl"
              onPress={onConfirmProject}
              disabled={isConfirming}
              activeOpacity={0.8}
            >
              {isConfirming ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check-circle" size={16} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white">Chấp nhận dự án</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View className="flex-row items-center gap-1.5 bg-orange-100 px-3 py-2 rounded-lg">
              <Feather name="lock" size={13} color="#9A3412" />
              <Text className="text-xs text-orange-950 font-semibold flex-1">
                Chỉ Account phụ trách mới có quyền chấp nhận dự án.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Project Info Card */}
      <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center mr-2.5">
            <Feather name="calendar" size={16} color={BrandColors.primary} />
          </View>
          <Text className="text-[15px] font-bold text-text-primary">Thông tin dự án</Text>
        </View>

        <View className="flex-row gap-3 bg-background rounded-xl p-3">
          <View className="flex-1 gap-1">
            <Text className="text-[10px] font-extrabold text-text-muted tracking-wider">MÃ HỢP ĐỒNG</Text>
            <Text className="text-xs font-semibold text-slate-700">{contract?.contractCode || 'Chưa cập nhật'}</Text>
          </View>
          <View className="flex-1 gap-1">
            <Text className="text-[10px] font-extrabold text-text-muted tracking-wider">TÊN HỢP ĐỒNG</Text>
            <Text className="text-xs font-semibold text-slate-700" numberOfLines={2}>
              {contract?.name || project.name || 'Chưa cập nhật'}
            </Text>
          </View>
        </View>

        <View className="bg-slate-50 rounded-xl border border-slate-100 p-3 gap-1.5">
          <View className="flex-row items-center gap-1.5">
            <Feather name="briefcase" size={14} color={BrandColors.primary} />
            <Text className="text-xs font-bold text-slate-800">Mô tả khách hàng (Brief)</Text>
          </View>
          <Text className="text-xs text-text-secondary italic leading-5">
            {contract?.description || (project as any).description || 'Chưa có mô tả chi tiết từ khách hàng.'}
          </Text>
        </View>

        {/* TIẾN TRÌNH DỰ ÁN — inside Project Info card */}
        <View className="border-t border-slate-100 pt-3 gap-2">
          {/* Row 1: Label */}
          <Text className="text-[10px] font-extrabold text-text-muted tracking-wider">
            TIẾN TRÌNH DỰ ÁN
          </Text>

          {/* Row 2: Badge + Edit button */}
          <View className="flex-row items-center justify-between">
            {timeline ? (
              <View className="flex-row items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full">
                <Feather
                  name={timeline.isOverdue ? 'alert-circle' : 'clock'}
                  size={11}
                  color={timeline.isOverdue ? '#E11D48' : BrandColors.primary}
                />
                <Text className={`text-[11px] font-bold ${
                  timeline.isOverdue ? 'text-rose-600' : 'text-primary'
                }`}>
                  {timeline.isOverdue
                    ? `Quá hạn ${timeline.diffDays} ngày`
                    : `Còn ${timeline.diffDays} ngày`}
                </Text>
              </View>
            ) : (
              <Text className="text-[11px] text-text-muted italic">Chưa thiết lập</Text>
            )}
            {canEditTimeline && !editingTimeline && (
              <TouchableOpacity
                className="flex-row items-center gap-1 px-1.5 py-1"
                onPress={() => {
                  setTimelineForm({ plannedStartDate: startDateStr || '', plannedEndDate: endDateStr || '' });
                  setEditingTimeline(true);
                }}
                activeOpacity={0.6}
              >
                <Feather name="edit-2" size={11} color={BrandColors.primary} />
                <Text className="text-[11px] font-bold text-primary underline decoration-primary/40">Sửa tiến trình</Text>
              </TouchableOpacity>
            )}
          </View>

          {editingTimeline ? (
            /* Edit mode */
            <View className="gap-2">
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-background border border-primary/40 rounded-xl px-3 py-2.5 gap-1"
                  onPress={() => setDatePickerField('plannedStartDate')}
                  activeOpacity={0.7}
                >
                  <Text className="text-[10px] font-bold text-text-muted">Ngày dự kiến bắt đầu</Text>
                  <View className="flex-row items-center gap-1.5">
                    <Feather name="calendar" size={12} color={BrandColors.primary} />
                    <Text className="text-xs font-semibold text-primary">
                      {timelineForm.plannedStartDate
                        ? formatDateToDDMMYYYY(timelineForm.plannedStartDate)
                        : 'Chọn ngày'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-background border border-primary/40 rounded-xl px-3 py-2.5 gap-1"
                  onPress={() => setDatePickerField('plannedEndDate')}
                  activeOpacity={0.7}
                >
                  <Text className="text-[10px] font-bold text-text-muted">Ngày dự kiến kết thúc</Text>
                  <View className="flex-row items-center gap-1.5">
                    <Feather name="calendar" size={12} color={BrandColors.primary} />
                    <Text className="text-xs font-semibold text-primary">
                      {timelineForm.plannedEndDate
                        ? formatDateToDDMMYYYY(timelineForm.plannedEndDate)
                        : 'Chọn ngày'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="flex-1 border border-border rounded-xl py-2 items-center"
                  onPress={() => setEditingTimeline(false)}
                  activeOpacity={0.7}
                >
                  <Text className="text-xs font-bold text-text-secondary">Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 rounded-xl py-2 items-center ${
                    hasTimelineChanges && !updateProjectMutation.isPending ? 'bg-primary' : 'bg-slate-200'
                  }`}
                  onPress={handleSaveTimeline}
                  disabled={!hasTimelineChanges || updateProjectMutation.isPending}
                  activeOpacity={0.8}
                >
                  {updateProjectMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text className={`text-xs font-bold ${
                      hasTimelineChanges ? 'text-white' : 'text-slate-400'
                    }`}>Lưu tiến trình</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* View mode */
            <View className="flex-row gap-3">
              <View className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 gap-1">
                <Text className="text-[10px] font-bold text-text-muted">Ngày dự kiến bắt đầu</Text>
                <View className="flex-row items-center gap-1.5">
                  <Feather name="calendar" size={12} color={BrandColors.primary} />
                  <Text className="text-xs font-semibold text-text-primary">
                    {startDateStr ? formatDateToDDMMYYYY(startDateStr) : 'Chưa cập nhật'}
                  </Text>
                </View>
              </View>
              <View className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 gap-1">
                <Text className="text-[10px] font-bold text-text-muted">Ngày dự kiến kết thúc</Text>
                <View className="flex-row items-center gap-1.5">
                  <Feather name="calendar" size={12} color={BrandColors.primary} />
                  <Text className="text-xs font-semibold text-text-primary">
                    {endDateStr ? formatDateToDDMMYYYY(endDateStr) : 'Chưa cập nhật'}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View className="gap-2 mt-1">
          <Text className="text-[12px] font-extrabold text-text-muted uppercase tracking-wider">
            Tài liệu đính kèm ({contract?.attachments?.length || 0})
          </Text>

          {contract?.attachments && contract.attachments.length > 0 ? (
            <View className="gap-2">
              {contract.attachments.map((file, idx) => (
                <TouchableOpacity
                  key={idx}
                  className="flex-row items-center bg-background border border-border rounded-xl p-2.5 gap-2.5"
                  onPress={() => handleOpenAttachment(file.url)}
                  activeOpacity={0.7}
                >
                  <View className="w-8 h-8 rounded-lg bg-blue-50 justify-center items-center">
                    <Feather name="file-text" size={16} color={BrandColors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-slate-800" numberOfLines={1}>
                      {file.name}
                    </Text>
                    {file.type ? <Text className="text-[10px] font-bold text-text-muted mt-px">{file.type.toUpperCase()}</Text> : null}
                  </View>
                  <Feather name="external-link" size={14} color="#64748B" />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text className="text-xs text-text-muted italic text-center py-2">Không có tài liệu đính kèm</Text>
          )}
        </View>
      </View>


      {/* Task & Timeline Progress Stat Card */}
      <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center mr-2.5">
            <Feather name="pie-chart" size={16} color={BrandColors.primary} />
          </View>
          <Text className="text-[15px] font-bold text-text-primary">Tiến độ công việc & Thời gian</Text>
        </View>

        {/* Task Completion Progress */}
        <View>
          <View className="flex-row items-baseline justify-between mb-1.5">
            <View className="flex-row items-baseline gap-2">
              <Text className="text-2xl font-extrabold text-primary">{progress}%</Text>
              <Text className="text-xs text-text-secondary font-medium">Hoàn thành công việc</Text>
            </View>
            <Text className="text-xs font-semibold text-text-muted">
              {taskStats.completed}/{taskStats.total} việc
            </Text>
          </View>
          <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <View className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </View>
        </View>



        <View className="flex-row justify-between bg-background rounded-xl p-3">
          <View className="items-center gap-0.5">
            <Text className="text-base font-extrabold text-text-primary">{taskStats.total}</Text>
            <Text className="text-[11px] text-text-secondary font-medium">Tổng Task</Text>
          </View>
          <View className="items-center gap-0.5">
            <Text className="text-base font-extrabold text-emerald-600">{taskStats.completed}</Text>
            <Text className="text-[11px] text-text-secondary font-medium">Hoàn thành</Text>
          </View>
          <View className="items-center gap-0.5">
            <Text className="text-base font-extrabold text-blue-600">{taskStats.doing}</Text>
            <Text className="text-[11px] text-text-secondary font-medium">Đang làm</Text>
          </View>
          <View className="items-center gap-0.5">
            <Text className="text-base font-extrabold text-amber-600">{taskStats.pending}</Text>
            <Text className="text-[11px] text-text-secondary font-medium">Chờ gán</Text>
          </View>
        </View>
      </View>

      {/* Working Files Section */}
      <ProjectWorkingFilesSection project={project} />

      {/* Project Manager Card */}
      <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center mr-2.5">
              <Feather name="user-check" size={16} color={BrandColors.primary} />
            </View>
            <Text className="text-[15px] font-bold text-text-primary">Quản lý dự án (PM)</Text>
          </View>
          {canAssignPm && (
            <TouchableOpacity className="flex-row items-center gap-1 bg-teal-50 px-2.5 py-1 rounded-lg" onPress={onOpenAssignPm} activeOpacity={0.7}>
              <Feather name="edit-2" size={12} color={BrandColors.primary} />
              <Text className="text-xs font-bold text-primary">{pm ? 'Đổi PM' : 'Phân công'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {pm ? (
          <View className="flex-row items-center gap-3 bg-background p-2.5 rounded-xl">
            <View className="w-10 h-10 rounded-full bg-primary justify-center items-center">
              <Text className="text-base font-bold text-white">{pm.fullName ? pm.fullName.charAt(0).toUpperCase() : 'P'}</Text>
            </View>
            <View>
              <Text className="text-sm font-bold text-text-primary">{pm.fullName}</Text>
              {(pm as any)?.email ? <Text className="text-xs text-text-secondary">{(pm as any).email}</Text> : null}
            </View>
          </View>
        ) : (
          <View className="flex-row items-center gap-2 bg-amber-50 p-2.5 rounded-xl">
            <Feather name="alert-circle" size={18} color="#F59E0B" />
            <Text className="text-xs text-amber-700 font-medium">Dự án này chưa được gán PM phụ trách.</Text>
          </View>
        )}
      </View>

      {/* Team Info Card */}
      <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center mr-2.5">
              <Feather name="users" size={16} color={BrandColors.primary} />
            </View>
            <Text className="text-[15px] font-bold text-text-primary">Đội ngũ thực hiện</Text>
          </View>
          {canManageTeam && pmUser && (
            <TouchableOpacity className="flex-row items-center gap-1 bg-teal-50 px-2.5 py-1 rounded-lg" onPress={onOpenAddMember} activeOpacity={0.7}>
              <Feather name="user-plus" size={12} color={BrandColors.primary} />
              <Text className="text-xs font-bold text-primary">Thêm nhân sự</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text className="text-sm font-bold text-text-primary">{team?.name || 'Đội dự án'}</Text>
        <Text className="text-xs text-text-secondary">
          Trưởng nhóm (Account):{' '}
          <Text className={`font-bold ${leadUser ? 'text-emerald-700' : 'text-text-muted'}`}>
            {leadUser?.fullName || 'Chưa chọn Account'}
          </Text>
        </Text>

        {!pmUser ? (
          <View className="flex-row items-center gap-2 bg-amber-100 p-2.5 rounded-xl mt-1">
            <Feather name="lock" size={14} color="#D97706" />
            <Text className="text-xs text-amber-700 font-medium flex-1">
              Vui lòng phân công PM phụ trách trước khi mở khóa quản lý đội ngũ thực hiện.
            </Text>
          </View>
        ) : (
          <View className="gap-2 mt-1">
            {(() => {
              const grouped = groupTeamMembers(effectiveMembers, team?.teamLead?.id || leadUser?.id);
              if (!grouped || grouped.length === 0) {
                return <Text className="text-xs text-text-muted italic">Chưa có thành viên bổ sung trong đội.</Text>;
              }

              return grouped.map((group) => {
                const isPmRole = group.roles.includes('PROJECT_MANAGER') || (!!pmUser?.id && group.userId === pmUser.id);
                const isTeamLead = !isPmRole && (!!leadUser?.id && group.userId === leadUser.id);
                const hasAccount = !isPmRole && group.roles.includes('ACCOUNT');

                return (
                  <View key={group.userId} className="flex-row items-center justify-between bg-background rounded-xl p-2.5 border border-border gap-2.5">
                    <View className="w-8 h-8 rounded-full bg-primary justify-center items-center">
                      <Text className="text-xs font-bold text-white">
                        {group.user?.fullName ? group.user.fullName.charAt(0).toUpperCase() : 'M'}
                      </Text>
                    </View>

                    <View className="flex-1 gap-1">
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        <Text className="text-xs font-bold text-text-primary">{group.user?.fullName || 'Thành viên'}</Text>
                        {isPmRole && (
                          <View className="bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            <Text className="text-[10px] font-bold text-blue-700">PM/Manager</Text>
                          </View>
                        )}
                        {isTeamLead && (
                          <View className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <Text className="text-[10px] font-bold text-emerald-700">Account</Text>
                          </View>
                        )}
                        {!isTeamLead && hasAccount && (
                          <View className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <Text className="text-[10px] font-bold text-emerald-700">Account</Text>
                          </View>
                        )}
                        {group.roles
                          .filter((r) => r !== 'PROJECT_MANAGER' && r !== 'ACCOUNT')
                          .map((role) => (
                            <View key={role} className="bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                              <Text className="text-[10px] font-bold text-primary">
                                {TEAM_MEMBER_ROLE_LABELS[role] || role}
                              </Text>
                            </View>
                          ))}
                        <WorkloadBadge workload={group.user?.workload} />
                      </View>
                      {(() => {
                        const accountRole = getUserAccountRole(group.user);
                        const roleLabel =
                          (accountRole && USER_ROLE[accountRole]) || accountRole || group.user?.email || 'Nhân sự';
                        return (
                          <Text className="text-[11px] text-text-secondary">
                            {roleLabel}
                          </Text>
                        );
                      })()}
                    </View>

                    {canManageTeam && !isPmRole && (
                      <View className="flex-row items-center gap-1.5">
                        <TouchableOpacity
                          className="p-1.5 rounded-lg bg-orange-50 border border-orange-200"
                          onPress={() => onEditMemberRole?.(group)}
                          activeOpacity={0.7}
                        >
                          <Feather name="edit-2" size={13} color={BrandColors.primary} />
                        </TouchableOpacity>
                        {onRemoveMember && !isTeamLead && group.memberships?.[0]?.id && (
                          <TouchableOpacity
                            className="p-1.5 rounded-lg bg-rose-100"
                            onPress={() => {
                              const isAccountMember = group.roles.includes('ACCOUNT') || group.userId === leadUser?.id;
                              if (isAccountMember) {
                                const otherAccounts = grouped.filter(
                                  (g) => g.userId !== group.userId && (g.roles.includes('ACCOUNT') || g.userId === leadUser?.id)
                                );
                                if (otherAccounts.length === 0) {
                                  Alert.alert(
                                    'Không thể xóa',
                                    'Không thể xóa nhân sự này vì đây là người duy nhất giữ vai trò Account trong đội dự án. Vui lòng phân công nhân sự khác giữ vai trò này trước khi xóa.'
                                  );
                                  return;
                                }
                              }
                              onRemoveMember(group.memberships[0].id);
                            }}
                            activeOpacity={0.7}
                          >
                            <Feather name="trash-2" size={14} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              });
            })()}

            {canManageTeam && (
              <TouchableOpacity className="flex-row items-center justify-center gap-1.5 bg-orange-50 border border-orange-200 py-2.5 rounded-xl mt-1" onPress={onOpenAddMember} activeOpacity={0.8}>
                <Feather name="plus-circle" size={15} color={BrandColors.primary} />
                <Text className="text-xs font-bold text-primary">Thêm thành viên vào đội dự án</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Contract Info Card */}
      {contract && (isBODOrAdminSaleOrAdmin || saleorAdminSale) && (
        <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-2">
              <Feather name="file-text" size={16} color={BrandColors.primary} />
              <Text className="text-[15px] font-bold text-text-primary">Hợp đồng liên quan</Text>
            </View>
            {contract.id && (
              <TouchableOpacity className="flex-row items-center gap-1 bg-teal-50 px-2.5 py-1 rounded-lg" onPress={() => router.push(`/contracts/${contract.id}` as any)} activeOpacity={0.7}>
                <Text className="text-xs font-bold text-primary">Xem hợp đồng</Text>
                <Feather name="chevron-right" size={14} color={BrandColors.primary} />
              </TouchableOpacity>
            )}
          </View>

          <Text className="text-sm font-bold text-text-primary">#{contract.contractCode || 'HĐ-DỰ-ÁN'}</Text>

          {contract.customer?.name && (
            <Text className="text-xs text-text-secondary">Khách hàng: {contract.customer.name}</Text>
          )}

          {contract.sellingPrice ? (
            <View className="flex-row justify-between items-center border-t border-slate-100 pt-2 mt-1">
              <Text className="text-xs text-text-secondary">Giá trị hợp đồng:</Text>
              <Text className="text-sm font-bold text-text-primary">{formatNumber(contract.sellingPrice)} đ</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>

      {/* DatePicker for timeline edit */}
      <DatePickerModal
        visible={datePickerField !== null}
        onClose={() => setDatePickerField(null)}
        onConfirm={(_ddmmyyyy, yyyymmdd) => {
          if (datePickerField) {
            setTimelineForm(prev => ({ ...prev, [datePickerField]: yyyymmdd }));
          }
          setDatePickerField(null);
        }}
        initialDate={
          datePickerField === 'plannedStartDate'
            ? timelineForm.plannedStartDate || undefined
            : timelineForm.plannedEndDate || undefined
        }
        title={
          datePickerField === 'plannedStartDate'
            ? 'Ngày dự kiến bắt đầu'
            : 'Ngày dự kiến kết thúc'
        }
      />
    </>
  );
}
