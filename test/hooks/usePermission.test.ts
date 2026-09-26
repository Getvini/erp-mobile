jest.mock('@/stores/useAuthStore', () => ({
  useAuthStore: jest.fn(),
}));

import {
  canApprovePaymentRequest,
  canViewFinancialReports,
  canModifyContract,
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
  FINANCE_ROLES,
  QC_ROLES,
  usePermission,
} from '@/hooks/usePermission';
import { canUnlockDebt, canConfigureQc } from '../utils/permissionTestHelpers';
import { useAuthStore } from '@/stores/useAuthStore';
import type { UserProfile } from '@/services/api';

describe('usePermission & RBAC (Role-Based Access Control)', () => {
  const adminUser: UserProfile = {
    id: 'u-admin',
    fullName: 'Tổng Giám Đốc',
    email: 'admin@getvini.com',
    role: 'ADMIN',
  };

  const directorUser: UserProfile = {
    id: 'u-director',
    fullName: 'Giám Đốc Kỹ Thuật',
    email: 'director@getvini.com',
    role: 'DIRECTOR',
  };

  const managerUser: UserProfile = {
    id: 'u-manager',
    fullName: 'Trưởng Phòng Dự Án',
    email: 'manager@getvini.com',
    role: 'MANAGER',
  };

  const accountantUser: UserProfile = {
    id: 'u-accountant',
    fullName: 'Kế Toán Trưởng',
    email: 'accountant@getvini.com',
    role: 'ACCOUNTANT',
  };

  const saleUser: UserProfile = {
    id: 'u-sale',
    fullName: 'Chuyên Viên Kinh Doanh',
    email: 'sale@getvini.com',
    role: 'SALE',
  };

  const memberUser: UserProfile = {
    id: 'u-member',
    fullName: 'Kỹ Sư Triển Khai',
    email: 'member@getvini.com',
    role: 'MEMBER',
  };

  describe('1. Quyền Duyệt / Từ Chối Đề Xuất Chi (canApprovePaymentRequest)', () => {
    test('Cho phép cấp Quản lý, Giám đốc, Kế toán duyệt chi', () => {
      expect(canApprovePaymentRequest(adminUser)).toBe(true);
      expect(canApprovePaymentRequest(directorUser)).toBe(true);
      expect(canApprovePaymentRequest(managerUser)).toBe(true);
      expect(canApprovePaymentRequest(accountantUser)).toBe(true);
    });

    test('Chặn hoàn toàn Nhân viên Sale & Member thông thường duyệt chi (Ẩn nút)', () => {
      expect(canApprovePaymentRequest(saleUser)).toBe(false);
      expect(canApprovePaymentRequest(memberUser)).toBe(false);
      expect(canApprovePaymentRequest(null)).toBe(false);
      expect(canApprovePaymentRequest(undefined)).toBe(false);
    });
  });

  describe('2. Quyền Mở Khóa Công Nợ Hợp Đồng (canUnlockDebt)', () => {
    test('Chỉ Admin/BOD mới có thẩm quyền mở khóa nợ', () => {
      expect(canUnlockDebt(adminUser)).toBe(true);
      expect(canUnlockDebt({ ...adminUser, role: 'BOD' })).toBe(true);
      expect(canUnlockDebt({ ...adminUser, role: 'TONG_GIAM_DOC' })).toBe(true);
    });

    test('Cấp Manager, Kế toán, Sale và Member KHÔNG được mở khóa nợ', () => {
      expect(canUnlockDebt(managerUser)).toBe(false);
      expect(canUnlockDebt(accountantUser)).toBe(false);
      expect(canUnlockDebt(saleUser)).toBe(false);
      expect(canUnlockDebt(memberUser)).toBe(false);
    });
  });

  describe('3. Quyền Cấu Hình AI QC Dự Án (canConfigureQc)', () => {
    test('Cấp PM, Manager, Giám đốc và Admin được cấu hình QC', () => {
      expect(canConfigureQc(adminUser)).toBe(true);
      expect(canConfigureQc(directorUser)).toBe(true);
      expect(canConfigureQc(managerUser)).toBe(true);
      expect(canConfigureQc({ ...managerUser, role: 'PM' })).toBe(true);
    });

    test('Sale, Member và Kế toán không được cấu hình QC', () => {
      expect(canConfigureQc(saleUser)).toBe(false);
      expect(canConfigureQc(memberUser)).toBe(false);
      expect(canConfigureQc(accountantUser)).toBe(false);
    });
  });

  describe('4. Quyền Xem Báo Cáo Tài Chính & Dòng Tiền (canViewFinancialReports)', () => {
    test('Admin, BOD, Giám đốc và Kế toán được xem dòng tiền', () => {
      expect(canViewFinancialReports(adminUser)).toBe(true);
      expect(canViewFinancialReports(directorUser)).toBe(true);
      expect(canViewFinancialReports(accountantUser)).toBe(true);
    });

    test('Sale và Member thường không được xem dòng tiền tổng quan công ty', () => {
      expect(canViewFinancialReports(saleUser)).toBe(false);
      expect(canViewFinancialReports(memberUser)).toBe(false);
    });
  });

  describe('5. Khóa Chỉnh Sửa Hợp Đồng Đã Ký Duyệt (canModifyContract)', () => {
    test('Hợp đồng ở trạng thái DRAFT / NHAP cho phép Sale và Manager chỉnh sửa', () => {
      expect(canModifyContract('DRAFT', saleUser)).toBe(true);
      expect(canModifyContract('NHAP', managerUser)).toBe(true);
    });

    test('Hợp đồng đã ký (SIGNED, DA_KY, COMPLETED) bị KHÓA cứng với Sale và Manager', () => {
      expect(canModifyContract('SIGNED', saleUser)).toBe(false);
      expect(canModifyContract('DA_KY', managerUser)).toBe(false);
      expect(canModifyContract('COMPLETED', saleUser)).toBe(false);
    });

    test('Admin/BOD luôn có quyền can thiệp ngay cả khi hợp đồng đã ký', () => {
      expect(canModifyContract('SIGNED', adminUser)).toBe(true);
      expect(canModifyContract('DA_KY', adminUser)).toBe(true);
    });
  });
});
