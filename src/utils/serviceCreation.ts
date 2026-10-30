import type { ServiceCreatePayload, ServiceItem, ServiceJobConfig, ServiceUpdatePayload } from '@/services/catalogService';

export interface ServiceCreationApi {
  create: (payload: ServiceCreatePayload) => Promise<ServiceItem | undefined>;
  update: (payload: { id: string } & ServiceUpdatePayload) => Promise<ServiceItem | undefined>;
}

/** A successful POST is never repeated when the follow-up PATCH fails. */
export class ServiceCreationOperation {
  createdId?: string;
  private running = false;

  async save(api: ServiceCreationApi, payload: ServiceCreatePayload, jobConfigs: ServiceJobConfig[]) {
    if (this.running) throw new Error('Đang lưu dịch vụ, vui lòng chờ.');
    this.running = true;
    try {
      let service: ServiceItem | undefined;
      const resuming = Boolean(this.createdId);
      if (!this.createdId) {
        service = await api.create(payload);
        if (!service?.id) throw new Error('Máy chủ chưa trả mã định danh dịch vụ. Hãy kiểm tra danh sách trước khi thử tạo lại.');
        this.createdId = service.id;
      }
      if (resuming || jobConfigs.some((config) => config.quantity !== 1)) {
        const { jobIds: _jobs, outputJobIds: _outputs, code: _code, ...basic } = payload;
        service = await api.update({ id: this.createdId, ...basic, jobConfigs });
        if (!service?.id) throw new Error('Máy chủ chưa xác nhận cấu hình dịch vụ.');
      }
      return service!;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu dịch vụ.';
      if (this.createdId) throw new Error('Dịch vụ đã tạo. Chưa hoàn tất cấu hình: ' + message + ' Bấm lưu lại để tiếp tục, không tạo bản mới.');
      throw error;
    } finally { this.running = false; }
  }
}
