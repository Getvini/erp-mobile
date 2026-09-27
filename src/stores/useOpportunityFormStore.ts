import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AttachedFile {
  name: string;
  size?: number;
  uri: string;
  mimeType?: string;
}

export interface ServiceJobBrief {
  jobId: string;
  name: string;
  isBriefVideo: boolean;
  included: boolean;
  briefVideo: string;
}

export interface PackageServiceItem {
  serviceId: string;
  quantity: number;
  sellingPrice?: number;
  jobs?: ServiceJobBrief[];
}

export interface SelectedPackage {
  servicePackageId: string;
  name?: string;
  description?: string;
  quantity: number;
  services?: PackageServiceItem[];
}

export interface SelectedService {
  serviceId: string;
  quantity: number;
  jobs?: ServiceJobBrief[];
}

export interface OpportunityNameParts {
  customerName: string;
  brandName: string;
  monthYear: string;
}

export interface OpportunityFormData {
  name: string;
  nameParts: OpportunityNameParts;
  description: string;
  field: string;
  expectedRevenue: number;
  budget: number;
  startDate: string;
  endDate: string;
  durationMonths: number;
  selectedRegions: string[];
  priority: string;
  successChance: number;
  packages: SelectedPackage[];
  services: SelectedService[];
  customerRequirements: string;
  links: string[];
  attachedFiles: AttachedFile[];
}

export const INITIAL_OPPORTUNITY_FORM_DATA: OpportunityFormData = {
  name: '',
  nameParts: {
    customerName: '',
    brandName: '',
    monthYear: '',
  },
  description: '',
  field: '',
  expectedRevenue: 0,
  budget: 0,
  startDate: '',
  endDate: '',
  durationMonths: 1,
  selectedRegions: [], // Mặc định chưa chọn
  priority: 'High',
  successChance: 0, // Mặc định là 0%
  packages: [{ servicePackageId: '', quantity: 1 }],
  services: [{ serviceId: '', quantity: 1 }],
  customerRequirements: '',
  links: ['', '', ''],
  attachedFiles: [],
};

interface OpportunityFormStore {
  formData: OpportunityFormData;
  lastSavedTime: string;
  dateError: string;
  isSubmitting: boolean;

  // Generic Field Updater
  updateField: <K extends keyof OpportunityFormData>(key: K, value: OpportunityFormData[K]) => void;
  updateFormData: (partial: Partial<OpportunityFormData>) => void;
  setDateError: (error: string) => void;
  setIsSubmitting: (submitting: boolean) => void;
  setLastSavedTime: (time: string) => void;

  // Specialized helpers
  setNameParts: (parts: Partial<OpportunityNameParts>) => void;
  toggleRegion: (region: string) => void;
  setRegions: (regions: string[]) => void;
  
  // Packages Actions
  addPackage: () => void;
  removePackage: (index: number) => void;
  selectPackageTemplate: (index: number, template: any) => void;
  setPackageQuantity: (index: number, qty: number) => void;
  addPackageService: (pkgIndex: number) => void;
  removePackageService: (pkgIndex: number, serviceIndex: number) => void;
  updatePackageService: (
    pkgIndex: number,
    serviceIndex: number,
    fieldOrItem: 'serviceId' | 'quantity' | Partial<PackageServiceItem>,
    value?: any,
    serviceObj?: any
  ) => void;
  setPackageServiceJobIncluded: (pkgIndex: number, serviceIndex: number, jobId: string, included: boolean) => void;
  setPackageServiceJobBrief: (pkgIndex: number, serviceIndex: number, jobId: string, briefVideo: string) => void;

  // Services Actions
  addService: () => void;
  removeService: (index: number) => void;
  selectServiceItem: (index: number, serviceId: string, serviceObj?: any) => void;
  setServiceQuantity: (index: number, qty: number) => void;
  setServiceJobIncluded: (serviceIndex: number, jobId: string, included: boolean) => void;
  setServiceJobBrief: (serviceIndex: number, jobId: string, briefVideo: string) => void;

  // Links Actions
  addLink: () => void;
  removeLink: (index: number) => void;
  updateLink: (index: number, value: string) => void;

  // Files Actions
  addAttachedFiles: (files: AttachedFile[]) => void;
  removeAttachedFile: (index: number) => void;

  // Reset / Clear
  resetForm: () => void;
}

export const useOpportunityFormStore = create<OpportunityFormStore>()(
  persist(
    (set) => ({
      formData: { ...INITIAL_OPPORTUNITY_FORM_DATA },
      lastSavedTime: '',
      dateError: '',
      isSubmitting: false,

      setNameParts: (parts) =>
        set((state) => {
          const currentParts = state.formData.nameParts || {
            customerName: '',
            brandName: '',
            monthYear: '',
          };
          const nextParts = { ...currentParts, ...parts };
          const nextName = [
            nextParts.customerName.trim(),
            nextParts.brandName.trim(),
            nextParts.monthYear.trim(),
          ]
            .filter(Boolean)
            .join('_');
          return {
            formData: {
              ...state.formData,
              nameParts: nextParts,
              name: nextName,
            },
          };
        }),

      updateField: (key, value) =>
        set((state) => ({
          formData: { ...state.formData, [key]: value },
        })),

      updateFormData: (partial) =>
        set((state) => {
          const currentParts = state.formData.nameParts || {
            customerName: '',
            brandName: '',
            monthYear: '',
          };
          let updatedNameParts = partial.nameParts
            ? { ...currentParts, ...partial.nameParts }
            : currentParts;
          let updatedName = partial.name ?? state.formData.name;

          if (partial.name && !partial.nameParts) {
            const rawParts = String(partial.name).split('_');
            if (rawParts.length >= 2) {
              updatedNameParts = {
                customerName: rawParts[0]?.trim() || '',
                brandName: rawParts.length >= 3 ? rawParts.slice(1, -1).join('_').trim() : rawParts[1]?.trim() || '',
                monthYear: rawParts.length >= 2 ? rawParts[rawParts.length - 1]?.trim() || '' : '',
              };
            }
          } else if (partial.nameParts && !partial.name) {
            updatedName = [
              updatedNameParts.customerName.trim(),
              updatedNameParts.brandName.trim(),
              updatedNameParts.monthYear.trim(),
            ]
              .filter(Boolean)
              .join('_');
          }

          return {
            formData: {
              ...state.formData,
              ...partial,
              nameParts: updatedNameParts,
              name: updatedName,
            },
          };
        }),

      setDateError: (dateError) => set({ dateError }),
      setIsSubmitting: (isSubmitting) => set({ isSubmitting }),
      setLastSavedTime: (lastSavedTime) => set({ lastSavedTime }),

      toggleRegion: (region) =>
        set((state) => {
          const current = state.formData.selectedRegions;
          const next = current.includes(region)
            ? current.filter((r) => r !== region)
            : [...current, region];
          return { formData: { ...state.formData, selectedRegions: next } };
        }),

      setRegions: (regions) =>
        set((state) => ({
          formData: { ...state.formData, selectedRegions: regions },
        })),

      addPackage: () =>
        set((state) => ({
          formData: {
            ...state.formData,
            packages: [...state.formData.packages, { servicePackageId: '', quantity: 1 }],
          },
        })),

      removePackage: (index) =>
        set((state) => {
          const filtered = state.formData.packages.filter((_, i) => i !== index);
          return {
            formData: {
              ...state.formData,
              packages: filtered.length > 0 ? filtered : [{ servicePackageId: '', quantity: 1 }],
            },
          };
        }),

      selectPackageTemplate: (index, template) =>
        set((state) => {
          const next = [...state.formData.packages];
          if (!template) {
            next[index] = { servicePackageId: '', quantity: 1, services: [] };
          } else {
            const pkgServices = (template.items || []).map((item: any) => ({
              serviceId: item.service?.id || item.serviceId,
              quantity: item.defaultQuantity || 1,
              sellingPrice: item.service?.costPrice || 0,
              jobs: (item.service?.serviceJobs || []).map((serviceJob: any) => ({
                jobId: serviceJob.job?.id || serviceJob.jobId,
                name: serviceJob.job?.name || 'Hạng mục',
                isBriefVideo: Boolean(serviceJob.job?.isBriefVideo),
                included: !Boolean(serviceJob.job?.isBriefVideo),
                briefVideo: '',
              })),
            }));
            next[index] = {
              servicePackageId: String(template.id),
              name: template.name,
              description: template.description,
              quantity: next[index]?.quantity || 1,
              services: pkgServices,
            };
          }
          return { formData: { ...state.formData, packages: next } };
        }),

      setPackageQuantity: (index, qty) =>
        set((state) => {
          const next = [...state.formData.packages];
          if (next[index]) {
            next[index] = { ...next[index], quantity: qty };
          }
          return { formData: { ...state.formData, packages: next } };
        }),

      addPackageService: (pkgIndex) =>
        set((state) => {
          const next = [...state.formData.packages];
          if (next[pkgIndex]) {
            const curServices = next[pkgIndex].services || [];
            next[pkgIndex] = {
              ...next[pkgIndex],
              services: [
                ...curServices,
                { serviceId: '', quantity: 1, sellingPrice: 0, jobs: [] },
              ],
            };
          }
          return { formData: { ...state.formData, packages: next } };
        }),

      removePackageService: (pkgIndex, serviceIndex) =>
        set((state) => {
          const next = [...state.formData.packages];
          if (next[pkgIndex] && next[pkgIndex].services) {
            next[pkgIndex] = {
              ...next[pkgIndex],
              services: next[pkgIndex].services!.filter((_, i) => i !== serviceIndex),
            };
          }
          return { formData: { ...state.formData, packages: next } };
        }),

      updatePackageService: (pkgIndex, serviceIndex, fieldOrItem, value, serviceObj) =>
        set((state) => {
          const next = [...state.formData.packages];
          if (next[pkgIndex] && next[pkgIndex].services && next[pkgIndex].services![serviceIndex]) {
            const pServices = [...next[pkgIndex].services!];
            if (typeof fieldOrItem === 'object') {
              pServices[serviceIndex] = {
                ...pServices[serviceIndex],
                ...fieldOrItem,
              };
            } else if (fieldOrItem === 'serviceId') {
              const jobs = (serviceObj?.serviceJobs || []).map((serviceJob: any) => ({
                jobId: serviceJob.job?.id || serviceJob.jobId,
                name: serviceJob.job?.name || 'Hạng mục',
                isBriefVideo: Boolean(serviceJob.job?.isBriefVideo),
                included: !Boolean(serviceJob.job?.isBriefVideo),
                briefVideo: '',
              }));
              pServices[serviceIndex] = {
                ...pServices[serviceIndex],
                serviceId: value,
                sellingPrice: serviceObj?.costPrice || 0,
                jobs,
              };
            } else if (fieldOrItem === 'quantity') {
              pServices[serviceIndex] = {
                ...pServices[serviceIndex],
                quantity: Math.max(1, Number(value) || 1),
              };
            }
            next[pkgIndex] = { ...next[pkgIndex], services: pServices };
          }
          return { formData: { ...state.formData, packages: next } };
        }),

      setPackageServiceJobIncluded: (pkgIndex, serviceIndex, jobId, included) =>
        set((state) => {
          const next = [...state.formData.packages];
          if (next[pkgIndex]?.services?.[serviceIndex]?.jobs) {
            const pServices = [...next[pkgIndex].services!];
            pServices[serviceIndex] = {
              ...pServices[serviceIndex],
              jobs: pServices[serviceIndex].jobs!.map((job) =>
                String(job.jobId) === String(jobId)
                  ? { ...job, included, briefVideo: included ? job.briefVideo : '' }
                  : job
              ),
            };
            next[pkgIndex] = { ...next[pkgIndex], services: pServices };
          }
          return { formData: { ...state.formData, packages: next } };
        }),

      setPackageServiceJobBrief: (pkgIndex, serviceIndex, jobId, briefVideo) =>
        set((state) => {
          const next = [...state.formData.packages];
          if (next[pkgIndex]?.services?.[serviceIndex]?.jobs) {
            const pServices = [...next[pkgIndex].services!];
            pServices[serviceIndex] = {
              ...pServices[serviceIndex],
              jobs: pServices[serviceIndex].jobs!.map((job) =>
                String(job.jobId) === String(jobId)
                  ? { ...job, briefVideo }
                  : job
              ),
            };
            next[pkgIndex] = { ...next[pkgIndex], services: pServices };
          }
          return { formData: { ...state.formData, packages: next } };
        }),

      addService: () =>
        set((state) => ({
          formData: {
            ...state.formData,
            services: [...state.formData.services, { serviceId: '', quantity: 1, jobs: [] }],
          },
        })),

      removeService: (index) =>
        set((state) => {
          const filtered = state.formData.services.filter((_, i) => i !== index);
          return {
            formData: {
              ...state.formData,
              services: filtered.length > 0 ? filtered : [{ serviceId: '', quantity: 1, jobs: [] }],
            },
          };
        }),

      selectServiceItem: (index, serviceId, serviceObj) =>
        set((state) => {
          const next = [...state.formData.services];
          if (next[index]) {
            const jobs = (serviceObj?.serviceJobs || []).map((serviceJob: any) => ({
              jobId: serviceJob.job?.id || serviceJob.jobId,
              name: serviceJob.job?.name || 'Hạng mục',
              isBriefVideo: Boolean(serviceJob.job?.isBriefVideo),
              included: !Boolean(serviceJob.job?.isBriefVideo),
              briefVideo: '',
            }));
            next[index] = { ...next[index], serviceId, jobs };
          }
          return { formData: { ...state.formData, services: next } };
        }),

      setServiceQuantity: (index, qty) =>
        set((state) => {
          const next = [...state.formData.services];
          if (next[index]) {
            next[index] = { ...next[index], quantity: qty };
          }
          return { formData: { ...state.formData, services: next } };
        }),

      setServiceJobIncluded: (serviceIndex, jobId, included) =>
        set((state) => {
          const next = [...state.formData.services];
          if (next[serviceIndex] && next[serviceIndex].jobs) {
            next[serviceIndex] = {
              ...next[serviceIndex],
              jobs: next[serviceIndex].jobs!.map((job) =>
                String(job.jobId) === String(jobId)
                  ? { ...job, included, briefVideo: included ? job.briefVideo : '' }
                  : job
              ),
            };
          }
          return { formData: { ...state.formData, services: next } };
        }),

      setServiceJobBrief: (serviceIndex, jobId, briefVideo) =>
        set((state) => {
          const next = [...state.formData.services];
          if (next[serviceIndex] && next[serviceIndex].jobs) {
            next[serviceIndex] = {
              ...next[serviceIndex],
              jobs: next[serviceIndex].jobs!.map((job) =>
                String(job.jobId) === String(jobId)
                  ? { ...job, briefVideo }
                  : job
              ),
            };
          }
          return { formData: { ...state.formData, services: next } };
        }),

      addLink: () =>
        set((state) => ({
          formData: {
            ...state.formData,
            links: [...state.formData.links, ''],
          },
        })),

      removeLink: (index) =>
        set((state) => {
          if (index < 3) return state; // Giữ 3 link mẫu ban đầu
          const filtered = state.formData.links.filter((_, i) => i !== index);
          return {
            formData: {
              ...state.formData,
              links: filtered.length > 0 ? filtered : [''],
            },
          };
        }),

      updateLink: (index, value) =>
        set((state) => {
          const next = [...state.formData.links];
          next[index] = value;
          return { formData: { ...state.formData, links: next } };
        }),

      addAttachedFiles: (files) =>
        set((state) => ({
          formData: {
            ...state.formData,
            attachedFiles: [...state.formData.attachedFiles, ...files],
          },
        })),

      removeAttachedFile: (index) =>
        set((state) => ({
          formData: {
            ...state.formData,
            attachedFiles: state.formData.attachedFiles.filter((_, i) => i !== index),
          },
        })),

      resetForm: () =>
        set({
          formData: { ...INITIAL_OPPORTUNITY_FORM_DATA },
          dateError: '',
          isSubmitting: false,
          lastSavedTime: '',
        }),
    }),
    {
      name: 'erp_opportunity_form_draft',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ formData: state.formData, lastSavedTime: state.lastSavedTime }),
    }
  )
);
