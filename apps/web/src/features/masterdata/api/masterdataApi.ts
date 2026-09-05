import type {
  Airline,
  Airport,
  Commodity,
  Consignee,
  CreateAirlineRequest,
  CreateAirportRequest,
  CreateCommodityRequest,
  CreateConsigneeRequest,
  CreateShipperRequest,
  Shipper,
} from '@hub-lanka/shared';
import { apiFetch } from '@/lib/apiClient';

export async function listShippers(): Promise<Shipper[]> {
  return apiFetch<Shipper[]>('/masterdata/shippers');
}
export async function createShipper(input: CreateShipperRequest): Promise<Shipper> {
  return apiFetch<Shipper>('/masterdata/shippers', { method: 'POST', body: JSON.stringify(input) });
}
export async function deactivateShipper(id: string): Promise<Shipper> {
  return apiFetch<Shipper>(`/masterdata/shippers/${id}`, { method: 'DELETE' });
}

export async function listConsignees(): Promise<Consignee[]> {
  return apiFetch<Consignee[]>('/masterdata/consignees');
}
export async function createConsignee(input: CreateConsigneeRequest): Promise<Consignee> {
  return apiFetch<Consignee>('/masterdata/consignees', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
export async function deactivateConsignee(id: string): Promise<Consignee> {
  return apiFetch<Consignee>(`/masterdata/consignees/${id}`, { method: 'DELETE' });
}

export async function listAirlines(): Promise<Airline[]> {
  return apiFetch<Airline[]>('/masterdata/airlines');
}
export async function createAirline(input: CreateAirlineRequest): Promise<Airline> {
  return apiFetch<Airline>('/masterdata/airlines', { method: 'POST', body: JSON.stringify(input) });
}
export async function deactivateAirline(id: string): Promise<Airline> {
  return apiFetch<Airline>(`/masterdata/airlines/${id}`, { method: 'DELETE' });
}

export async function listAirports(): Promise<Airport[]> {
  return apiFetch<Airport[]>('/masterdata/airports');
}
export async function createAirport(input: CreateAirportRequest): Promise<Airport> {
  return apiFetch<Airport>('/masterdata/airports', { method: 'POST', body: JSON.stringify(input) });
}
export async function deactivateAirport(id: string): Promise<Airport> {
  return apiFetch<Airport>(`/masterdata/airports/${id}`, { method: 'DELETE' });
}

export async function listCommodities(): Promise<Commodity[]> {
  return apiFetch<Commodity[]>('/masterdata/commodities');
}
export async function createCommodity(input: CreateCommodityRequest): Promise<Commodity> {
  return apiFetch<Commodity>('/masterdata/commodities', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
export async function deactivateCommodity(id: string): Promise<Commodity> {
  return apiFetch<Commodity>(`/masterdata/commodities/${id}`, { method: 'DELETE' });
}
