import { hasTeamMemberRole } from '@/utils/teamMember';
import { PROJECT_MANAGEMENT_ROLES, UserRole, isManagementRole } from '@/utils/rbac';
import type { TaskReview } from '@/services/taskService';

const isSameId = (left?: string | null, right?: string | null): boolean =>
  Boolean(left && right && String(left) === String(right));

/**
 * Mirror Web/backend TaskOutcomeAuthorization:
 * - Giao cho người khác: chỉ người phân công được quyết định.
 * - Tự phân công: Account khác hoặc PM của chính dự án được quyết định.
 * - Người thực hiện/helper không được tự duyệt kết quả của mình.
 */
export const canDecideTaskOutcome = (
  task: any,
  currentUserId?: string | null,
  project: any = task?.project,
): boolean => {
  if (!task || !currentUserId) return false;
  if (project?.status === 'ON_HOLD' || Boolean(project?.isOnHold)) return false;

  const assignerId = task.assignerId || task.assigner?.id;
  const performerIds = [
    task.assigneeId || task.assignee?.id,
    task.helperId || task.helper?.id,
  ].filter(Boolean) as string[];

  if (performerIds.some((id) => isSameId(id, currentUserId))) return false;

  const isSelfAssigned = Boolean(
    assignerId && performerIds.some((id) => isSameId(id, assignerId)),
  );
  if (!isSelfAssigned) return isSameId(assignerId, currentUserId);

  return Boolean(
    project?.team?.members?.some(
      (member: any) =>
        isSameId(member?.user?.id, currentUserId) &&
        (hasTeamMemberRole(member, 'ACCOUNT') ||
          hasTeamMemberRole(member, 'PROJECT_MANAGER')),
    ),
  );
};

export interface TaskActor { id?: string; role?: string }

/** Match Task.BaseService.isProjectOperator, without granting unrelated PMs access. */
export function canCreateProjectTask(project: any, actor: TaskActor): boolean {
  if (!actor.id || !project?.contract?.id || project.isOnHold ||
    !['CONFIRMED', 'IN_PROGRESS', 'PENDING_PAUSE_APPROVAL'].includes(project.status)) return false;
  if (isManagementRole(actor.role)) return true;
  const members = project.team?.members || [];
  const membership = members.find((member: any) => isSameId(member.user?.id, actor.id));
  if (actor.role === 'PM') return Boolean(membership);
  return isSameId(project.team?.teamLead?.id, actor.id) ||
    Boolean(membership && (hasTeamMemberRole(membership, 'ACCOUNT') || hasTeamMemberRole(membership, 'PROJECT_MANAGER')));
}

export function getTaskReviewPermissions(task: any, actor: TaskActor) {
  const isLead = Boolean(actor.id) && (PROJECT_MANAGEMENT_ROLES.includes(actor.role as UserRole) ||
    isSameId(task?.project?.team?.teamLead?.id, actor.id));
  const isAssigner = isSameId(task?.assignerId || task?.assigner?.id, actor.id);
  // The backend has a separate rule for opportunity demo tasks.
  const demo = Boolean(task?.opportunityId && task?.opportunityServiceJob?.isBriefVideo);
  const demoOperator = isLead || task?.project?.team?.members?.some((member: any) =>
    isSameId(member.user?.id, actor.id) &&
    (hasTeamMemberRole(member, 'ACCOUNT') || hasTeamMemberRole(member, 'PROJECT_MANAGER')));
  const isPerformer = [task?.assigneeId || task?.assignee?.id, task?.helperId || task?.helper?.id]
    .some((id) => isSameId(id, actor.id));
  const canDecide = Boolean(actor.id && !isPerformer && task?.status === 'AWAITING_REVIEW' &&
    task?.project?.status !== 'ON_HOLD' && !task?.project?.isOnHold &&
    (demo ? demoOperator : canDecideTaskOutcome(task, actor.id)));
  return { isLead, isAssigner, canDecide };
}

export function canToggleTaskReview(task: any, reviews: TaskReview[], review: TaskReview, actor: TaskActor): boolean {
  const permissions = getTaskReviewPermissions(task, actor);
  if (!permissions.canDecide) return false;
  const dual = reviews.some((item) => item.reviewerType === 'TEAM_LEAD') &&
    reviews.some((item) => item.reviewerType === 'ASSIGNER');
  return dual ? (review.reviewerType === 'TEAM_LEAD' ? permissions.isLead : permissions.isAssigner) :
    permissions.isLead || permissions.isAssigner;
}

/** Fresh server values win for groups that the actor cannot edit. */
export function reconcileTaskReviewIds(task: any, reviews: TaskReview[], selected: string[], actor: TaskActor): string[] {
  if (!getTaskReviewPermissions(task, actor).canDecide) throw new Error('Bạn không có quyền duyệt công việc này hoặc trạng thái đã thay đổi.');
  const valid = new Set(reviews.map((review) => review.id));
  if (selected.some((id) => !valid.has(id))) throw new Error('Tiêu chí đã thay đổi. Vui lòng tải lại trước khi đánh giá.');
  const passed = new Set(selected);
  return reviews.filter((review) => canToggleTaskReview(task, reviews, review, actor) ? passed.has(review.id) : review.isPassed)
    .map((review) => review.id);
}
