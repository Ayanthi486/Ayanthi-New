import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChangeShipmentStatusRequest,
  CreateShipmentRequest,
  SetCargoRequest,
  ShipmentListQuery,
  UpdateShipmentRequest,
} from '@hub-lanka/shared';
import { ACTIVE_CUTOFF_ALERTS_KEY } from '@/features/cutoff/hooks/useCutoff';
import {
  captureBuyingRate,
  changeShipmentStatus,
  createShipment,
  deleteShipment,
  getShipment,
  listShipments,
  setCargo,
  updateShipment,
} from '@/features/shipments/api/shipmentsApi';

const SHIPMENTS_KEY = ['shipments'];

// Schedule freshness via polling, not WebSockets (ARCHITECTURE §3).
const SCHEDULE_POLL_MS = 25_000;

export function useShipments(query: ShipmentListQuery) {
  return useQuery({
    queryKey: [...SHIPMENTS_KEY, query],
    queryFn: () => listShipments(query),
    refetchInterval: SCHEDULE_POLL_MS,
  });
}

export function useShipment(id: string | undefined) {
  return useQuery({
    queryKey: [...SHIPMENTS_KEY, id],
    queryFn: () => getShipment(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShipmentRequest) => createShipment(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY }),
  });
}

export function useUpdateShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateShipmentRequest }) =>
      updateShipment(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY }),
  });
}

export function useDeleteShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteShipment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY }),
  });
}

/**
 * The direct, no-approval status dropdown (Schedule grid). Invalidates
 * cutoff alerts too — same as the old useRecordActualDeparture used to —
 * since setting DEPARTED resolves any open alert to Passed.
 */
export function useChangeShipmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ChangeShipmentStatusRequest }) =>
      changeShipmentStatus(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: ACTIVE_CUTOFF_ALERTS_KEY });
    },
  });
}

export function useSetCargo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: SetCargoRequest }) => setCargo(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY }),
  });
}

export function useCaptureBuyingRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => captureBuyingRate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY }),
  });
}
