// Mobile task conditions, compared against the corresponding web screens.
export interface TaskActionState {
  visible: boolean;
  enabled: boolean;
  reasonCode: string | null;
  reason: string | null;
}
export interface TaskPolicyOptions {
  project?: any;
  members?: any[];
  parentTask?: any;
  subtaskApprovalEnabled?: boolean;
  loading?: boolean;
  assignmentContext?: 'detail' | 'batch';
}
export type TaskAction = typeof TASK_ACTIONS[number];

const same = (left: any, right: any) => Boolean(left && right && String(left) === String(right));
const rolesOf = (member: any) => (Array.isArray(member?.roles)
    ? member.roles.map((item: any) => typeof item === 'string' ? item : item?.role)
    : [member?.role]).filter(Boolean);
const hasRole = (member: any, roles: any) => rolesOf(member).some((role: any) => roles.includes(role));
const idOf = (value: any) => value?.userId || value?.user?.id || value?.profile?.id || value?.id;
const DONE = ['INTERNAL_COMPLETED', 'COMPLETED', 'ACCEPTED', 'DONE'];
const SUBTASK_DONE = ['INTERNAL_COMPLETED', 'COMPLETED', 'ACCEPTED'];
const DRAFT = ['DOING', 'REJECTED', 'REWORKING', 'OVERDUE'];
const SPLIT = ['PENDING', 'NOT_STARTED', 'DOING', 'REWORKING', 'OVERDUE', 'AWAITING_SUPPORT'];
export const TASK_ACTIONS = [
    'assign', 'reassign', 'start', 'editDescription', 'editDeadline', 'uploadResult',
    'submitReview', 'review', 'reviewLead', 'reviewAssigner', 'customerApprove', 'rework',
    'createSubtask', 'editSubtask', 'viewAllocation', 'requestStaffing', 'resolveStaffing',
    'rejectStaffing', 'requestSupport', 'remind', 'delete', 'customerNotPurchase',
    'assessExtraTask',
] as const;
export function isSubtaskDefinitionLocked(task: any) {
    return Boolean(task?.result || task?.actualStartDate || task?.actualEndDate ||
        task?.lastSubmittedById || task?.lastSubmittedBy?.id || task?.rewardVinicoin != null ||
        task?.reviews?.length || task?.iterations?.length ||
        ['AWAITING_REVIEW', ...DONE, 'AWAITING_SUPPORT', 'REWORKING'].includes(task?.status));
}
/** No role, including ADMIN/BOD, bypasses a state/dependency lock. */
export function getTaskActionState(task: any, user: any, action: TaskAction, options: TaskPolicyOptions = {}): TaskActionState {
    const denied = () => ({ visible: false, enabled: false, reasonCode: 'NO_PERMISSION', reason: null });
    const blocked = (reasonCode: any, reason: any) => ({ visible: true, enabled: false, reasonCode, reason });
    const enabled = () => ({ visible: true, enabled: true, reasonCode: null, reason: null });
    const uid = idOf(user);
    if (!uid || !task)
        return denied();
    const role = String(user?.account?.role || user?.accounts?.[0]?.role || user?.role || '').toUpperCase();
    const project = options.project ?? task.project;
    const members = options.members ?? project?.team?.members ?? [];
    const membership = members.find((member: any) => same(member?.user?.id || member?.userId, uid));
    const admin = role === 'ADMIN';
    const leadership = ['ADMIN', 'BOD'].includes(role);
    const account = same(project?.team?.teamLead?.id || project?.team?.teamLeadId, uid) || hasRole(membership, ['ACCOUNT']);
    const pm = same(project?.projectManager?.id || project?.projectManagerId, uid) || hasRole(membership, ['PROJECT_MANAGER', 'PM']);
    const management = leadership || role === 'PM' || account || pm;
    const assignee = task.assigneeId || task.assignee?.id;
    const helper = task.helperId || task.helper?.id;
    const assigner = task.assignerId || task.assigner?.id;
    const performer = same(uid, assignee) || same(uid, helper);
    const selfAssigned = same(assigner, assignee) || same(assigner, helper);
    const demo = Boolean(task.opportunityId && task.opportunityServiceJob?.isBriefVideo);
    const demoSalesOwner = demo && ['BD', 'ADMIN_SALE'].includes(role) && same(uid, task.opportunity?.createdById || task.opportunity?.createdBy?.id || task.opportunityServiceJob?.opportunityService?.opportunity?.createdBy?.id);
    const outcome = !performer && (demo ? management : selfAssigned ? hasRole(membership, ['ACCOUNT', 'PROJECT_MANAGER', 'PM']) : same(uid, assigner));
    const assigned = Boolean(assignee || task.vendorId || task.vendor || task.performerType === 'VENDOR');
    const canManageTask = admin || (account && (!assigned || !assigner || same(uid, assigner)));
    const assignmentRight = options.assignmentContext === 'batch'
        ? (same(uid, task.supportLeadId) || canManageTask)
        : options.assignmentContext === 'detail'
        ? (project ? canManageTask : demo && ['PM', 'ADMIN'].includes(role))
        : canManageTask || (!project && ['PM', 'BOD'].includes(role));
    const delegate = leadership || account || pm;
    const pendingStaffing = task.supportRequestType === 'STAFFING' && task.isSupportRequested && !task.isSupportAccepted;
    const resolveStaffing = leadership || pm || same(uid, task.supportLeadId);
    const parent = options.parentTask ?? task.parentTask;
    const isStaff = !role || role.startsWith('STAFF') || ['EMPLOYEE', 'USER', 'CONTENT_A', 'CONTENT_B', 'CONTENT_C', 'CONTENT_D', 'EDITOR_A', 'EDITOR_B', 'EDITOR_C', 'EDITOR_D', 'DESIGNER_A', 'DESIGNER_B', 'DESIGNER_C', 'DESIGNER_D'].includes(role);
    const rights: Record<TaskAction, boolean> = {
        assign: assignmentRight, reassign: assignmentRight,
        start: performer,
        editDescription: management,
        editDeadline: admin || account,
        uploadResult: performer || same(uid, assigner) || management,
        submitReview: admin || same(uid, task.lastSubmittedById || task.lastSubmittedBy?.id),
        review: outcome,
        reviewLead: ['ADMIN', 'BOD', 'PM'].includes(role) || same(uid, project?.team?.teamLead?.id),
        reviewAssigner: same(uid, task.assignerId),
        customerApprove: outcome && !demo,
        rework: outcome || (demoSalesOwner && !performer),
        createSubtask: delegate,
        editSubtask: delegate || same(parent?.team?.teamLead?.id, uid),
        viewAllocation: !isStaff && management,
        requestStaffing: delegate,
        resolveStaffing, rejectStaffing: resolveStaffing || account,
        requestSupport: performer,
        remind: leadership || role === 'PM' || account,
        delete: ['ADMIN', 'BOD', 'PM'].includes(role),
        customerNotPurchase: demo && (leadership || demoSalesOwner),
        assessExtraTask: ['ADMIN', 'BOD', 'BD', 'ADMIN_SALE'].includes(role),
    };
    if (!rights[action])
        return denied();
    if (options.loading)
        return blocked('LOADING', 'Đang tải điều kiện thao tác.');
    if (action === 'viewAllocation')
        return enabled();
    if (action === 'assessExtraTask' && (task.quotation?.id || task.quotationId))
        return blocked('QUOTATION_EXISTS', 'Công việc đã có báo giá. Vui lòng xem báo giá hiện tại.');
    if ((task.projectId || project?.id) && !project?.status)
        return blocked('PROJECT_LOADING', 'Đang tải trạng thái dự án.');
    if (project?.isOnHold || ['ON_HOLD', 'COMPLETED', 'CANCELLED', 'CLOSED'].includes(project?.status)) {
        return blocked('PROJECT_LOCKED', 'Dự án đang tạm dừng, đã hoàn thành hoặc đã hủy.');
    }
    if (['ON_HOLD', 'CANCELLED'].includes(task.status))
        return blocked('TASK_LOCKED', 'Công việc đang tạm dừng hoặc đã hủy.');
    if (!task.status)
        return blocked('TASK_LOADING', 'Đang tải trạng thái công việc.');
    if (['start', 'assign', 'reassign', 'createSubtask', 'requestStaffing'].includes(action) &&
        project && !['CONFIRMED', 'IN_PROGRESS'].includes(project.status)) {
        return blocked('PROJECT_NOT_ACTIVE', 'Dự án chưa được chấp nhận để thực hiện công việc.');
    }
    const statusWindows: Partial<Record<TaskAction, string[]>> = {
        assign: options.assignmentContext === 'detail' && project ? undefined
            : options.assignmentContext === 'detail' ? ['PENDING'] : ['PENDING', 'REJECTED', 'AWAITING_SUPPORT'],
        reassign: ['NOT_STARTED', 'DOING', 'REWORKING', 'OVERDUE', 'REJECTED'],
        start: ['NOT_STARTED'], uploadResult: DRAFT, submitReview: DRAFT,
        review: ['AWAITING_REVIEW'], reviewLead: ['AWAITING_REVIEW'], reviewAssigner: ['AWAITING_REVIEW'],
        customerApprove: ['INTERNAL_COMPLETED'], rework: ['AWAITING_REVIEW', 'INTERNAL_COMPLETED', 'COMPLETED'],
        createSubtask: [...SPLIT, 'REJECTED'], requestStaffing: SPLIT,
        requestSupport: ['DOING', 'REWORKING', 'OVERDUE'], customerNotPurchase: ['INTERNAL_COMPLETED'],
    };
    const window = statusWindows[action];
    if (window && !window.includes(task.status))
        return blocked('TASK_STATE', 'Trạng thái công việc hiện tại không cho phép thao tác này.');
    if (action === 'assign' && options.assignmentContext === 'detail' && ['COMPLETED', 'ACCEPTED', 'DONE', 'INTERNAL_COMPLETED', 'AWAITING_REVIEW', 'CANCELLED'].includes(task.status))
        return blocked('TASK_STATE', 'Trạng thái công việc hiện tại không cho phép thao tác này.');
    if (['editDescription', 'editDeadline', 'remind', 'delete', 'editSubtask', 'assessExtraTask'].includes(action) &&
        (DONE.includes(task.status) || (action !== 'editDescription' && action !== 'editDeadline' && task.status === 'AWAITING_REVIEW'))) {
        return blocked('TASK_LOCKED', 'Công việc đã gửi duyệt hoặc hoàn thành, không thể thay đổi.');
    }
    if (action === 'assign' && assigned)
        return blocked('ALREADY_ASSIGNED', 'Công việc đã có người thực hiện.');
    if (['reassign', 'editDeadline'].includes(action) && !assigned && !helper)
        return blocked('UNASSIGNED', 'Công việc chưa có người thực hiện.');
    if (action === 'remind' && !assignee && !helper)
        return blocked('UNASSIGNED', 'Công việc chưa có người thực hiện.');
    if (action === 'reassign' && !admin && assigner && !same(uid, assigner))
        return blocked('OTHER_ASSIGNER', 'Chỉ người phân công hoặc ADMIN được thay đổi phân công này.');
    const hasTaskResult = Boolean(task?.result && (task.result.url || task.result.name || task.result.checklist?.length));
    if (action === 'submitReview' && !hasTaskResult)
        return blocked('RESULT_REQUIRED', 'Cần nộp kết quả trước khi gửi duyệt.');
    if (options.subtaskApprovalEnabled && task.parentTaskId && parent?.subtaskPlanStatus && parent.subtaskPlanStatus !== 'APPROVED' && ['start', 'uploadResult', 'submitReview'].includes(action)) {
        return blocked('PLAN_NOT_APPROVED', 'Phương án công việc con chưa được duyệt.');
    }
    if (!task.parentTaskId && ['uploadResult', 'submitReview', 'review', 'customerApprove'].includes(action) &&
        task.subtasks?.some((subtask: any) => !SUBTASK_DONE.includes(subtask.status))) {
        return blocked('SUBTASKS_INCOMPLETE', 'Cần hoàn tất tất cả công việc con trước khi tiếp tục.');
    }
    if (action === 'createSubtask') {
        if (task.parentTaskId)
            return blocked('CHILD_TASK', 'Không thể chia thêm công việc con từ một công việc con.');
        if (task.performerType !== 'INTERNAL')
            return blocked('INTERNAL_ONLY', 'Chỉ công việc nội bộ mới được chia công việc con.');
        if (!project?.team)
            return blocked('TEAM_JOB_REQUIRED', 'Công việc cần có đội dự án trước khi chia.');
        if (options.subtaskApprovalEnabled && ['PENDING_APPROVAL', 'APPROVED'].includes(task.subtaskPlanStatus))
            return blocked('PLAN_LOCKED', 'Phương án phân bổ đang chờ duyệt hoặc đã được duyệt.');
        const allocated = (task.subtasks || []).reduce((sum: any, child: any) => sum + Math.round((Number(child.allocationPercent) || 0) * 100), 0);
        if (allocated >= 10000)
            return blocked('ALLOCATION_FULL', 'Đã phân bổ đủ 100% cho công việc con.');
    }
    if (action === 'editSubtask') {
        if (isSubtaskDefinitionLocked(task))
            return blocked('SUBTASK_EXECUTED', 'Công việc con đã phát sinh thực hiện, không thể sửa định nghĩa.');
        if (parent && (!SPLIT.includes(parent.status) || parent.performerType !== 'INTERNAL'))
            return blocked('PARENT_LOCKED', 'Công việc cha không cho phép sửa công việc con.');
        if (options.subtaskApprovalEnabled && parent?.subtaskPlanStatus && ['PENDING_APPROVAL', 'APPROVED'].includes(parent.subtaskPlanStatus))
            return blocked('PLAN_LOCKED', 'Không thể sửa khi phương án đang chờ duyệt hoặc đã được duyệt.');
    }
    if (action === 'requestStaffing') {
        if (task.parentTaskId)
            return blocked('CHILD_TASK', 'Không thể yêu cầu bổ sung nhân sự cho công việc con.');
        if (task.performerType !== 'INTERNAL' || !project?.team)
            return blocked('INTERNAL_TEAM_REQUIRED', 'Chỉ công việc nội bộ thuộc đội dự án mới được yêu cầu nhân sự.');
        if (!members.some((member: any) => hasRole(member, ['PROJECT_MANAGER', 'PM'])))
            return blocked('PM_REQUIRED', 'Dự án chưa có PM phụ trách để nhận yêu cầu.');
        if (pendingStaffing)
            return blocked('STAFFING_PENDING', 'Yêu cầu bổ sung nhân sự đang chờ xử lý.');
    }
    if (['resolveStaffing', 'rejectStaffing'].includes(action) && !pendingStaffing)
        return blocked('NO_STAFFING_REQUEST', 'Không có yêu cầu nhân sự đang chờ xử lý.');
    if (action === 'requestSupport' && task.isSupportRequested)
        return blocked('SUPPORT_PENDING', 'Công việc đã có yêu cầu hỗ trợ.');
    if (action === 'delete') {
        if (task.subtasks?.length)
            return blocked('HAS_SUBTASKS', 'Không thể xóa công việc khi còn công việc con.');
        if (task.parentTaskId && isSubtaskDefinitionLocked(task))
            return blocked('SUBTASK_EXECUTED', 'Công việc con đã phát sinh thực hiện, không thể xóa.');
        if (options.subtaskApprovalEnabled && task.parentTaskId && parent?.subtaskPlanStatus && ['PENDING_APPROVAL', 'APPROVED'].includes(parent.subtaskPlanStatus))
            return blocked('PLAN_LOCKED', 'Không thể xóa công việc con khi phương án đang chờ duyệt hoặc đã được duyệt.');
    }
    return enabled();
}
export function getTaskPolicy(task: any, user: any, options: TaskPolicyOptions = {}): Record<TaskAction, TaskActionState> {
    return Object.fromEntries(TASK_ACTIONS.map((action: any) => [action, getTaskActionState(task, user, action, options)])) as Record<TaskAction, TaskActionState>;
}
export const getTaskDisplayName = (task: any) => task?.nickname?.trim() || task?.name?.trim() || task?.code?.trim() || '';
