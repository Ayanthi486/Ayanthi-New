import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRateRequest } from '@hub-lanka/shared';
import { createRate, listRates } from '@/features/rates/api/ratesApi';

const RATES_KEY = ['rates'];

export function useRates() {
  return useQuery({ queryKey: RATES_KEY, queryFn: () => listRates() });
}

export function useCreateRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRateRequest) => createRate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RATES_KEY }),
  });
}
