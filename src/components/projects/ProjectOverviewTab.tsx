import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ProjectDetailItem } from '@/services/projectService';
import { TeamMember, TEAM_MEMBER_ROLE_LABELS, USER_ROLE } from '@/services/teamService';
import { BrandColors } from '@/constants/colors';
import { formatNumber } from '@/utils/formatters';
import { getProjectManagerUser, hasTeamMemberRole, groupTeamMembers, getUserAccountRole } from '@/utils/teamMember';
import { WorkloadBadge } from '@/components/common/WorkloadBadge';


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

  const handleOpenAttachment = (url?: string) => {
    if (url) {
      Linking.openURL(url).catch((err) => {
        console.log('Cannot open attachment URL:', err);
      });
    }
  };

  return (
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
          <Feather name="calendar" size={16} color={BrandColors.primary} />
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


      {/* Task Progress Stat Card */}
      <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
        <View className="flex-row items-center gap-2">
          <Feather name="pie-chart" size={16} color={BrandColors.primary} />
          <Text className="text-[15px] font-bold text-text-primary">Thống kê tiến độ công việc</Text>
        </View>

        <View className="flex-row items-baseline gap-2">
          <Text className="text-3xl font-extrabold text-primary">{progress}%</Text>
          <Text className="text-xs text-text-secondary font-medium">Tổng thể dự án</Text>
        </View>

        <View className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <View className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
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

      {/* Project Manager Card */}
      <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <Feather name="user-check" size={16} color={BrandColors.primary} />
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
            <Feather name="users" size={16} color={BrandColors.primary} />
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
          Trưởng nhóm (Account dự án):{' '}
          <Text className={`font-bold ${leadUser ? 'text-emerald-700' : 'text-text-muted'}`}>
            {leadUser?.fullName || 'Chưa chọn Account dự án'}
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
                            <Text className="text-[10px] font-bold text-emerald-700">Account dự án</Text>
                          </View>
                        )}
                        {!isTeamLead && hasAccount && (
                          <View className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <Text className="text-[10px] font-bold text-emerald-700">Account dự án</Text>
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
                                    'Không thể xóa nhân sự này vì đây là người duy nhất giữ vai trò Account/Lead trong đội dự án. Vui lòng phân công nhân sự khác giữ vai trò này trước khi xóa.'
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
  );
}
