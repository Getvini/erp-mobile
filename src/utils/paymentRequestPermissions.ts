export interface PaymentActor { id?: string; role?: string }
export interface PaymentPermissionRequest {
  approvalStatus?: string;
  paymentStatus?: string;
  type?: string;
  settlementStatus?: string | null;
  requesterId?: string;
  createdById?: string;
  amount?: number;
  paidAmount?: number | null;
}

export const isPaymentAccountant = (role?: string): boolean =>
  ['ADMIN_SALE', 'ADMIN', 'BOD'].includes(role || '');

export const isPaymentBod = (role?: string): boolean => ['ADMIN', 'BOD'].includes(role || '');

export function remainingPaymentAmount(request: PaymentPermissionRequest): number {
  return Math.max(0, Number(request.amount || 0) - Number(request.paidAmount || 0));
}

export function canDisbursePayment(request: PaymentPermissionRequest, actor: PaymentActor): boolean {
  return isPaymentAccountant(actor.role) && request.approvalStatus === 'APPROVED' &&
    request.paymentStatus !== 'PAID' && remainingPaymentAmount(request) > 0;
}

export function canReviewPaymentSettlement(request: PaymentPermissionRequest, actor: PaymentActor): boolean {
  const owner = request.requesterId || request.createdById;
  return Boolean(actor.id && owner && actor.id !== owner) && isPaymentAccountant(actor.role) &&
    request.type === 'ADVANCE' && request.settlementStatus === 'SETTLEMENT_SUBMITTED';
}
