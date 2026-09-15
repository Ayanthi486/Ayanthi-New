const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/masterdata/pages/FlightsPage.tsx', 'utf8');

// 1. Add useCreateAirline to imports
file = file.replace(
  `  useAirlines,
  useCreateFlight,
  useDeactivateFlight,
  useFlights,
} from '@/features/masterdata/hooks/useMasterdata';`,
  `  useAirlines,
  useCreateAirline,
  useCreateFlight,
  useDeactivateFlight,
  useFlights,
} from '@/features/masterdata/hooks/useMasterdata';`
);

// 2. Add the mutation hook
file = file.replace(
  `  const airlinesQuery = useAirlines();`,
  `  const airlinesQuery = useAirlines();
  const createAirlineMutation = useCreateAirline();`
);

// 3. Update the onSubmit logic
file = file.replace(
`    const airline = airlinesQuery.data?.find((a) => a.code === code);
    if (!airline) {
      setError('flightNumber', {
        message: \`No airline found with code "\${code}". Add it in Master Data → Airlines first.\`,
      });
      return;
    }`,
`    let airline = airlinesQuery.data?.find((a) => a.code === code);
    if (!airline) {
      try {
        airline = await createAirlineMutation.mutateAsync({ code, name: \`\${code} (Auto-created)\` });
      } catch (err) {
        setError('flightNumber', {
          message: \`Failed to auto-create airline "\${code}".\`,
        });
        return;
      }
    }`
);

fs.writeFileSync('apps/web/src/features/masterdata/pages/FlightsPage.tsx', file);
