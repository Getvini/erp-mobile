/**
 * Helper kiểm tra hợp lệ dữ liệu khách hàng.
 * Đồng bộ với customerSchema trên Web (erp-UI/src/pages/Customers/CustomerModal.jsx).
 */

import { EMAIL_REGEX, PHONE_REGEX, TAX_ID_REGEX } from '@/utils/validators';

export interface CustomerFormInput {
  name: string;
  phoneNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  code?: string;
}

export interface CustomerValidationResult {
  isValid: boolean;
  errors: Partial<Record<'name' | 'phone' | 'email' | 'address' | 'taxId' | 'code', string>>;
}

export function validateCustomerForm(
  form: CustomerFormInput,
  existingCustomers: any[] = [],
  isEdit = false,
  currentCustomerId?: string
): CustomerValidationResult {
  const errors: Partial<Record<'name' | 'phone' | 'email' | 'address' | 'taxId' | 'code', string>> = {};

  // 1. Tên khách hàng (Bắt buộc)
  if (!form.name || !form.name.trim()) {
    errors.name = 'Tên khách hàng là bắt buộc';
  }

  // 2. Số điện thoại (Bắt buộc, 10-15 số)
  const phone = (form.phoneNumber || form.phone || '').trim().replace(/\s+/g, '');
  if (!phone) {
    errors.phone = 'Số điện thoại là bắt buộc';
  } else if (!PHONE_REGEX.test(phone)) {
    errors.phone = 'Số điện thoại không hợp lệ (10-15 chữ số)';
  }

  // 3. Email (Bắt buộc, chuẩn email)
  const email = (form.email || '').trim();
  if (!email) {
    errors.email = 'Email là bắt buộc';
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Email không đúng định dạng';
  }

  // 4. Địa chỉ (Bắt buộc)
  const address = (form.address || '').trim();
  if (!address) {
    errors.address = 'Địa chỉ là bắt buộc';
  }

  // 5. Mã số thuế (Tuỳ chọn nhưng nếu có phải đúng format & không trùng)
  const taxId = (form.taxId || '').trim();
  if (taxId) {
    if (!TAX_ID_REGEX.test(taxId)) {
      errors.taxId = 'Mã số thuế phải gồm 10 số hoặc dạng XXXXXXXXXX-XXX';
    } else {
      const cleanTax = taxId.replace(/[\s-]/g, '');
      const isDuplicate = existingCustomers.some((c: any) => {
        if (!c.taxId) return false;
        if (isEdit && currentCustomerId && String(c.id) === String(currentCustomerId)) {
          return false;
        }
        return c.taxId.replace(/[\s-]/g, '') === cleanTax;
      });

      if (isDuplicate) {
        errors.taxId = 'Mã số thuế này đã tồn tại trên hệ thống';
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
