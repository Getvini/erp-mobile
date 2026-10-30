import type { QuotationItem } from '@/services/quotationService';

export interface ExtraTaskQuotationApi {
  getTask: (id: string) => Promise<{ id: string; quotation?: QuotationItem | null }>;
  assess: (id: string, sellingPrice: number) => Promise<unknown>;
  create: (payload: { opportunityId: string; taskIds: string[]; note?: string }) => Promise<QuotationItem>;
}

/** Preserve assessment on a failed quotation request; always reconcile the task before retrying. */
export class ExtraTaskQuotationOperation {
  private assessedPrice?: number;
  private result?: QuotationItem;
  private running = false;
  assessmentCompleted = false;

  async save(api: ExtraTaskQuotationApi, taskId: string, opportunityId: string, sellingPrice: number, note: string) {
    if (this.running) throw new Error('Đang tạo báo giá, vui lòng chờ.');
    if (!opportunityId) throw new Error('Hợp đồng chưa liên kết cơ hội kinh doanh.');
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) throw new Error('Đơn giá phải lớn hơn 0.');
    if (this.result) return this.result;
    this.running = true;
    try {
      const task = await api.getTask(taskId);
      if (!task?.id) throw new Error('Không tải được thông tin công việc để kiểm tra báo giá.');
      if (task.quotation?.id) return (this.result = task.quotation);
      if (this.assessedPrice !== sellingPrice) {
        await api.assess(taskId, sellingPrice);
        this.assessedPrice = sellingPrice;
        this.assessmentCompleted = true;
      }
      const quotation = await api.create({ opportunityId, taskIds: [taskId], note: note.trim() || undefined });
      if (!quotation?.id) throw new Error('Máy chủ chưa xác nhận báo giá được tạo.');
      this.result = quotation;
      return quotation;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tạo báo giá.';
      if (this.assessmentCompleted) {
        throw new Error('Đã định giá công việc nhưng chưa xác nhận tạo báo giá. ' + message + ' Bấm thử lại để tiếp tục.');
      }
      throw error;
    } finally {
      this.running = false;
    }
  }
}
