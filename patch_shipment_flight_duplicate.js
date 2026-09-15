const fs = require('fs');

let file = fs.readFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', 'utf8');

file = file.replace(
  `                const airline = airlinesQuery.data?.find((a) => a.id === airlineId);
                if (!airline) throw new Error("Selected airline not found");
                
                const created = await createFlightMutation.mutateAsync({`,
  `                const airline = airlinesQuery.data?.find((a) => a.id === airlineId);
                if (!airline) throw new Error("Selected airline not found");
                
                const existingFlight = flightsQuery.data?.find(
                  (f) => f.airlineId === airlineId && f.flightNo === flightNo
                );
                
                if (existingFlight) {
                  setValue('airlineId', airline.id, { shouldValidate: true, shouldDirty: true });
                  setValue('flightNo', existingFlight.flightNo, { shouldValidate: true, shouldDirty: true });
                  setValue('depTime', existingFlight.depTime, { shouldValidate: true, shouldDirty: true });
                  return { id: existingFlight.id, name: displayFlight(airline.code, existingFlight.flightNo) };
                }

                const created = await createFlightMutation.mutateAsync({`
);

fs.writeFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', file);
