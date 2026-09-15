const fs = require('fs');

let file = fs.readFileSync('apps/web/src/features/shipments/hooks/useShipments.ts', 'utf8');

file = file.replace(
  `    onSuccess: () => queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY }),`,
  `    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ['airlines'] }); // Refresh airlines to pick up auto-learned MAWB prefixes
    },`
);

// Do it again for update
file = file.replace(
  `    onSuccess: () => queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY }),`,
  `    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ['airlines'] });
    },`
);

fs.writeFileSync('apps/web/src/features/shipments/hooks/useShipments.ts', file);
