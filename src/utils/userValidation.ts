import { EMAIL_REGEX } from '@/utils/validators';

/**
 * Chuẩn Regex họ tên tiếng Việt từ Web `AddUserModal.jsx` (`/^[a-zA-ZÀ-ỹ0-9\s]+$/`).
 * Chặn các ký tự đặc biệt như @, #, $, %, !, ...
 */
export const VIETNAMESE_NAME_REGEX = /^[a-zA-ZÀ-ỹ0-9\s]+$/;

/** Ràng buộc định dạng SĐT quốc tế/nội địa (10-15 chữ số). */
export const USER_PHONE_REGEX = /^\+?[0-9]{10,15}$/;

export interface UserFormData {
  username?: string;
  password?: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  role: string;
  birthday?: string | null;
  isActive?: boolean;
  isLocked?: boolean;
}

/**
 * Kiểm tra hợp lệ dữ liệu hồ sơ nhân sự (User)
 * Đồng bộ với kiểm tra nghiệp vụ trên Web `AddUserModal.jsx` & Backend `User.Validation.ts`.
 *
 * @param form Dữ liệu form người dùng
 * @param isEditMode true nếu đang ở chế độ Sửa, false nếu Thêm mới
 * @returns Thông báo lỗi nếu vi phạm, hoặc null nếu hợp lệ
 */
export function validateUserForm(
  form: UserFormData,
  isEditMode: boolean,
): string | null {
  if (!isEditMode) {
    if (!form.username || !form.username.trim()) {
      return 'Vui lòng nhập tên đăng nhập.';
    }
    if (!form.password || !form.password.trim()) {
      return 'Vui lòng nhập mật khẩu.';
    }
  }

  const fullName = form.fullName ? form.fullName.trim() : '';
  if (!fullName) {
    return 'Vui lòng nhập họ tên nhân sự.';
  }

  if (!VIETNAMESE_NAME_REGEX.test(fullName)) {
    return 'Họ tên không được chứa ký tự đặc biệt.';
  }

  if (!form.role) {
    return 'Vui lòng chọn vai trò.';
  }

  const email = form.email ? form.email.trim() : '';
  if (email && !EMAIL_REGEX.test(email)) {
    return 'Email không đúng định dạng.';
  }

  const phone = form.phoneNumber ? form.phoneNumber.trim().replace(/\s+/g, '') : '';
  if (phone && !USER_PHONE_REGEX.test(phone)) {
    return 'Số điện thoại phải gồm 10-15 chữ số, có thể bắt đầu bằng dấu +.';
  }

  const birthday = form.birthday ? form.birthday.trim() : '';
  if (birthday) {
    const timestamp = Date.parse(birthday);
    if (Number.isNaN(timestamp)) {
      return 'Ngày sinh không hợp lệ.';
    }

    const birthDate = new Date(timestamp);
    const now = new Date();
    // Đặt giờ 00:00:00 để so sánh chỉ phần ngày
    birthDate.setHours(0, 0, 0, 0);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (birthDate.getTime() > today.getTime()) {
      return 'Ngày sinh không thể ở tương lai.';
    }
  }

  return null;
}
