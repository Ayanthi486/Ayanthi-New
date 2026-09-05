import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateShipmentRequest,
  SetCargoRequest,
  ShipmentListQuery,
  UpdateShipmentRequest,
} from '@hub-lanka/shared';
import { ACTIVE_CUTOFF_ALERTS_KEY } from '@/features/cutoff/hooks/useCutoff';
import {
  captureBuyingRate,
  completeShipment,
  createShipment,
  deleteShipment,
  getShipment,
  listCancellationQueue,
  listShipments,
  recordActualDeparture,
  requestCancellation,
  reviewCancellation,
  setCargo,
  updateShipment,
} from '@/features/shipments/api/shipmentsApi';

const SHIPMENTS_KEY = ['shipments'];
const CANCELLATION_QUEUE_KEY = ['shipments', 'cancellation-requests'];

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

export function useRequestCancellation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => requestCancellation(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY }),
  });
}

export function useCancellationQueue() {
  return useQuery({ queryKey: CANCELLATION_QUEUE_KEY, queryFn: listCancellationQueue });
}

export function useReviewCancellation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      decision,
      note,
    }: {
      requestId: string;
      decision: 'approve' | 'reject';
      note?: string;
    }) => reviewCancellation(requestId, decision, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CANCELLATION_QUEUE_KEY });
      void queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY });
    },
  });
}

export function useCompleteShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => completeShipment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY }),
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

export function useRecordActualDeparture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recordActualDeparture(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: ACTIVE_CUTOFF_ALERTS_KEY });
    },
  });
}
