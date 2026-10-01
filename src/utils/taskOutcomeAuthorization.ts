import { hasTeamMemberRole } from '@/utils/teamMember';

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
