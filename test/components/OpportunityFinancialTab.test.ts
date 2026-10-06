import {
  getEditableOpportunityJobs,
  getVisibleOpportunityJobs,
} from '../../src/services/opportunityService';

describe('OpportunityFinancialTab job rules', () => {
  const jobs = [
    {
      id: 'demo',
      name: 'Video demo',
      isBriefVideo: true,
      isQuotationItem: false,
      costAtSale: 0,
      job: { costPrice: 0 },
    },
    {
      id: 'ai-cost',
      name: 'Hạng mục cần nhập giá vốn',
      isBriefVideo: false,
      isQuotationItem: true,
      costAtSale: 0,
      job: { costPrice: 0 },
    },
    {
      id: 'fixed-cost',
      name: 'Hạng mục có giá niêm yết',
      isBriefVideo: false,
      isQuotationItem: true,
      costAtSale: 500000,
      job: { costPrice: 500000 },
    },
  ];

  it('hiển thị video demo và hạng mục chưa có giá niêm yết giống web', () => {
    expect(getVisibleOpportunityJobs(jobs)).toHaveLength(2);
  });

  it('không cho nhập giá vốn trực tiếp vào video demo', () => {
    expect(getEditableOpportunityJobs(jobs).map((job) => job.id)).toEqual(['ai-cost']);
  });
});
