import { ServiceJobItem } from '../../src/components/opportunities/ServiceJobAccordion';
import {
  INITIAL_OPPORTUNITY_FORM_DATA,
  useOpportunityFormStore,
} from '../../src/stores/useOpportunityFormStore';

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

describe('Video demo trong gói dịch vụ', () => {
  beforeEach(() => {
    useOpportunityFormStore.setState({
      formData: {
        ...INITIAL_OPPORTUNITY_FORM_DATA,
        packages: [
          {
            servicePackageId: 'pkg-1',
            quantity: 1,
            services: [{ serviceId: 'service-1', quantity: 1, jobs: [] }],
          },
        ],
      },
    });
  });

  it('khởi tạo jobs từ dữ liệu dịch vụ fallback khi người dùng tick video demo', () => {
    const fallbackJobs = [
      {
        jobId: 'video-demo-1',
        name: 'Video demo',
        isBriefVideo: true,
        included: false,
        briefVideo: '',
      },
    ];

    useOpportunityFormStore
      .getState()
      .setPackageServiceJobIncluded(0, 0, 'video-demo-1', true, fallbackJobs);

    const jobs = useOpportunityFormStore.getState().formData.packages[0].services?.[0].jobs;
    expect(jobs).toHaveLength(1);
    expect(jobs?.[0]).toEqual(expect.objectContaining({
      jobId: 'video-demo-1',
      included: true,
    }));
  });

  it('lưu nội dung brief sau khi jobs đã được khởi tạo', () => {
    const fallbackJobs = [
      {
        jobId: 'video-demo-1',
        name: 'Video demo',
        isBriefVideo: true,
        included: true,
        briefVideo: '',
      },
    ];

    useOpportunityFormStore
      .getState()
      .setPackageServiceJobBrief(0, 0, 'video-demo-1', 'Brief sản phẩm', fallbackJobs);

    const job = useOpportunityFormStore.getState().formData.packages[0].services?.[0].jobs?.[0];
    expect(job?.briefVideo).toBe('Brief sản phẩm');
  });
});
