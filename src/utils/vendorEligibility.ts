import { VendorItem } from '@/services/vendorService';

/**
 * Lấy jobId của một công việc (mirror Web: getTaskJobId trong erp-UI/src/utils/vendorEligibility.js)
 */
export const getTaskJobId = (task: any): string => (
  task?.jobId ||
  task?.job?.id ||
  task?.contractService?.jobId ||
  task?.contractService?.job?.id ||
  ''
);

/**
 * Lấy danh sách vendor đáp ứng ĐỒNG THỜI (AND) cho tất cả các danh sách hạng mục công việc
 * (mirror Web: getEligibleVendorsForJobs trong erp-UI/src/utils/vendorEligibility.js)
 *
 * @param vendorLists Mảng các danh sách vendor theo từng jobId
 * @returns Mảng vendor có mặt trong TẤT CẢ các danh sách (giao - AND)
 */
export const getEligibleVendorsForJobs = (vendorLists: VendorItem[][]): VendorItem[] => {
  if (!Array.isArray(vendorLists) || vendorLists.length === 0) return [];

  // Lấy danh sách đầu tiên làm mốc, lọc các vendor có mặt trong MỌI danh sách còn lại (AND)
  return (vendorLists[0] || []).filter((vendor) => (
    vendorLists.slice(1).every((list) => (
      Array.isArray(list) && list.some((candidate) => candidate.id === vendor.id)
    ))
  ));
};
