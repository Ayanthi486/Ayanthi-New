import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateAirlineRequest,
  CreateAirportRequest,
  CreateCommodityRequest,
  CreateConsigneeRequest,
  CreateFlightRequest,
  CreateShipperRequest,
} from '@hub-lanka/shared';
import {
  createAirline,
  createAirport,
  createCommodity,
  createConsignee,
  createFlight,
  createShipper,
  deactivateAirline,
  deactivateAirport,
  deactivateCommodity,
  deactivateConsignee,
  deactivateFlight,
  deactivateShipper,
  listAirlines,
  listAirports,
  listCommodities,
  listConsignees,
  listFlights,
  listShippers,
} from '@/features/masterdata/api/masterdataApi';

const KEYS = {
  shippers: ['masterdata', 'shippers'],
  consignees: ['masterdata', 'consignees'],
  airlines: ['masterdata', 'airlines'],
  airports: ['masterdata', 'airports'],
  commodities: ['masterdata', 'commodities'],
  flights: ['masterdata', 'flights'],
} as const;

export function useShippers() {
  return useQuery({ queryKey: KEYS.shippers, queryFn: listShippers });
}
export function useCreateShipper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShipperRequest) => createShipper(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.shippers }),
  });
}
export function useDeactivateShipper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateShipper(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.shippers }),
  });
}

export function useConsignees() {
  return useQuery({ queryKey: KEYS.consignees, queryFn: listConsignees });
}
export function useCreateConsignee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConsigneeRequest) => createConsignee(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.consignees }),
  });
}
export function useDeactivateConsignee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateConsignee(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.consignees }),
  });
}

export function useAirlines() {
  return useQuery({ queryKey: KEYS.airlines, queryFn: listAirlines });
}
export function useCreateAirline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAirlineRequest) => createAirline(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.airlines }),
  });
}
export function useDeactivateAirline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateAirline(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.airlines }),
  });
}

export function useAirports() {
  return useQuery({ queryKey: KEYS.airports, queryFn: listAirports });
}
export function useCreateAirport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAirportRequest) => createAirport(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.airports }),
  });
}
export function useDeactivateAirport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateAirport(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.airports }),
  });
}

export function useCommodities() {
  return useQuery({ queryKey: KEYS.commodities, queryFn: listCommodities });
}
export function useCreateCommodity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommodityRequest) => createCommodity(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.commodities }),
  });
}
export function useDeactivateCommodity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateCommodity(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.commodities }),
  });
}

export function useFlights() {
  return useQuery({ queryKey: KEYS.flights, queryFn: listFlights });
}
export function useCreateFlight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFlightRequest) => createFlight(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.flights }),
  });
}
export function useDeactivateFlight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateFlight(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEYS.flights }),
  });
}

export function useUpdateAirport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateAirport>[1] }) => updateAirport(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['airports'] }),
  });
}

export function useUpdateCommodity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateCommodity>[1] }) => updateCommodity(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['commodities'] }),
  });
}

export function useUpdateFlight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateFlight>[1] }) => updateFlight(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flights'] }),
  });
}

export function useUpdateAirline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateAirline>[1] }) => updateAirline(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['airlines'] }),
  });
}

export function useUpdateShipper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateShipper>[1] }) => updateShipper(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shippers'] }),
  });
}

export function useUpdateConsignee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateConsignee>[1] }) => updateConsignee(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consignees'] }),
  });
}
