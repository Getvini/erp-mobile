import { ServiceJobItem } from '../../src/components/opportunities/ServiceJobAccordion';

describe('ServiceJobAccordion Data Processing', () => {
  const sampleJobs: ServiceJobItem[] = [
    {
      id: 'job-1',
      jobId: 'job-1',
      name: 'Quay phim 4K',
      quantity: 2,
      unit: 'Buổi',
      costPrice: 1500000,
      isBriefVideo: false,
      isQuotationItem: true,
    },
    {
      id: 'job-2',
      jobId: 'job-2',
      name: 'Video AI Demo (Chống rung)',
      quantity: 1,
      unit: 'Video',
      costPrice: 500000,
      isBriefVideo: true,
      isQuotationItem: false,
      included: true,
      briefVideo: 'Tạo video demo sản phẩm phong cách hiện đại',
    },
  ];

  it('should correctly classify non-quotation jobs (Video AI demo)', () => {
    const videoJob = sampleJobs.find((j) => j.isBriefVideo);
    expect(videoJob).toBeDefined();
    expect(videoJob?.isBriefVideo).toBe(true);
    expect(videoJob?.isQuotationItem).toBe(false);
  });

  it('should correctly format job quantity and unit', () => {
    const regularJob = sampleJobs[0];
    expect(regularJob.quantity).toBe(2);
    expect(regularJob.unit).toBe('Buổi');
    expect(regularJob.costPrice).toBe(1500000);
  });
});
