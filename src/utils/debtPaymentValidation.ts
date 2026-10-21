export interface DebtPaymentValidationResult {
  isValid: boolean;
  errorMessage: string | null;
}

export function validateDebtPayment(
  paymentAmount: number,
  unpaidAmount: number,
): DebtPaymentValidationResult {
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return {
      isValid: false,
      errorMessage: 'Số tiền thanh toán phải lớn hơn 0',
    };
  }

  if (paymentAmount > unpaidAmount) {
    return {
      isValid: false,
      errorMessage: 'Số tiền thanh toán không được vượt quá số nợ còn lại',
    };
  }

  return {
    isValid: true,
    errorMessage: null,
  };
}
