const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/masterdata/hooks/useMasterdata.ts', 'utf8');

file = file.replace(
  `import {
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
} from '../api/masterdataApi';`,
  `import {
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
  updateAirport,
  updateCommodity,
  updateFlight,
} from '../api/masterdataApi';`
);

file += `
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
`;

fs.writeFileSync('apps/web/src/features/masterdata/hooks/useMasterdata.ts', file);
