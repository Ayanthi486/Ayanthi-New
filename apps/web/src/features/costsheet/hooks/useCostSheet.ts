import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCostSheetRequest, UpdateCostSheetRequest } from '@hub-lanka/shared';
import {
  approveCostSheet,
  createCostSheet,
  getCostSheetByShipmentId,
  releaseCostSheet,
  updateCostSheet,
} from '@/features/costsheet/api/costSheetApi';

const costSheetKey = (shipmentId: string) => ['costsheet', shipmentId];

export function useCostSheet(shipmentId: string) {
  return useQuery({
    queryKey: costSheetKey(shipmentId),
    queryFn: () => getCostSheetByShipmentId(shipmentId),
    retry: false,
  });
}

export function useCreateCostSheet(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCostSheetRequest) => createCostSheet(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: costSheetKey(shipmentId) }),
  });
}

export function useUpdateCostSheet(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCostSheetRequest }) =>
      updateCostSheet(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: costSheetKey(shipmentId) }),
  });
}

export function useReleaseCostSheet(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => releaseCostSheet(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: costSheetKey(shipmentId) }),
  });
}

export function useApproveCostSheet(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approveCostSheet(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: costSheetKey(shipmentId) }),
  });
}
