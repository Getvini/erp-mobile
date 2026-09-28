import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerService, CustomerListFilters, CustomerItem } from '@/services/customerService';
import { queryKeys } from '@/services/queryKeys';

/**
 * Hook to fetch list of customers with filtering & caching
 */
export function useCustomersQuery(filters: CustomerListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.customers.list(filters),
    queryFn: async () => {
      const res = await customerService.getCustomers(filters);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
  });
}

/**
 * Infinite-query compatible adapter for long customer directories. The
 * current backend returns the complete array without pagination metadata, so
 * the hook intentionally exposes one page and never risks appending duplicate
 * records. Enable getNextPageParam when the API gains a documented meta block.
 */
export function useInfiniteCustomersQuery(
  filters: Omit<CustomerListFilters, 'page'> = {},
  pageSize = 20,
) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.customers.lists(), 'infinite', filters, pageSize],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await customerService.getCustomers({
        ...filters,
        page: pageParam,
        limit: pageSize,
      });
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data || [];
    },
    initialPageParam: 1,
    getNextPageParam: () => undefined,
  });
}

/**
 * Hook to fetch detail of a single customer
 */
export function useCustomerDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: async () => {
      const res = await customerService.getCustomerById(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Hook to update customer information
 */
export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<CustomerItem> }) => {
      const res = await customerService.updateCustomer(id, payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(variables.id) });
    },
  });
}

/**
 * Hook to create a new customer
 */
export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<CustomerItem>) => {
      const res = await customerService.createCustomer(payload);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}


/**
 * Hook to delete a customer and evict every dependent customer cache entry.
 */
export function useDeleteCustomerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await customerService.deleteCustomer(id);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.customers.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
    },
  });
}
