const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', 'utf8');

// 1. Add useCreateAirline to imports
file = file.replace(
  `  useAirlines,
  useAirports,
  useCommodities,
  useConsignees,
  useCreateFlight,
  useFlights,
  useShippers,
} from '@/features/masterdata/hooks/useMasterdata';`,
  `  useAirlines,
  useAirports,
  useCommodities,
  useConsignees,
  useCreateAirline,
  useCreateFlight,
  useFlights,
  useShippers,
} from '@/features/masterdata/hooks/useMasterdata';`
);

// 2. Add the mutation hook
file = file.replace(
  `  const airlinesQuery = useAirlines();`,
  `  const airlinesQuery = useAirlines();
  const createAirlineMutation = useCreateAirline();`
);

// 3. Update the onCreate logic
file = file.replace(
`                const airline = airlinesQuery.data?.find((a) => a.code === code);
                if (!airline) {
                  setFlightCreateError(
                    \`No airline found with code "\${code}". Add it in Master Data first.\`,
                  );
                  throw new Error('Unknown airline code');
                }`,
`                let airline = airlinesQuery.data?.find((a) => a.code === code);
                if (!airline) {
                  try {
                    airline = await createAirlineMutation.mutateAsync({ code, name: \`\${code} (Auto-created)\` });
                  } catch (err) {
                    setFlightCreateError(\`Failed to auto-create airline "\${code}".\`);
                    throw err;
                  }
                }`
);

fs.writeFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', file);
