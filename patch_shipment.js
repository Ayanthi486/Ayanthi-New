const fs = require('fs');

let shipmentForm = fs.readFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', 'utf8');

// Add useCreateAirline to imports
shipmentForm = shipmentForm.replace(
  /useCreateFlight,/,
  "useCreateFlight,\n  useCreateAirline,"
);

// Add createAirlineMutation hook
shipmentForm = shipmentForm.replace(
  /const createFlightMutation = useCreateFlight\(\);/,
  "const createFlightMutation = useCreateFlight();\n  const createAirlineMutation = useCreateAirline();"
);

// Update createFields array in MasterDataCombobox for flight
shipmentForm = shipmentForm.replace(
  /createFields=\{\[\s*\{\s*key: 'name',\s*label: 'Flight Number',\s*required: true,\s*placeholder: 'EK 0654',\s*transform: formatFlightNumber,\s*\},\s*\{\s*key: 'depTime',\s*label: 'Departure Time',\s*required: true,\s*type: 'time'\s*\}\s*\]\}/g,
  `createFields={[
                  {
                    key: 'name',
                    label: 'Flight Number',
                    required: true,
                    placeholder: 'EK 0654',
                    transform: formatFlightNumber,
                  },
                  {
                    key: 'airlineName',
                    label: 'Airline Name (only if creating a new Airline)',
                    required: false,
                  },
                  { key: 'depTime', label: 'Departure Time', required: true, type: 'time' },
                ]}`
);

// Update onCreate to handle inline airline creation
shipmentForm = shipmentForm.replace(
  /onCreate=\{async \(input\) => \{[\s\S]*?return \{ id: created\.id, name: displayFlight\(airline\.code, created\.flightNo\) \};\s*\}\}/,
  `onCreate={async (input) => {
                  setFlightCreateError(undefined);
                  const { code, flightNo } = splitFlightNumber(input.name ?? '');
                  let airline = airlinesQuery.data?.find((a) => a.code === code);
                  if (!airline) {
                    if (!input.airlineName) {
                      setFlightCreateError(
                        \`No airline found with code "\${code}". Please provide the Airline Name to create it.\`,
                      );
                      throw new Error('Unknown airline code');
                    }
                    airline = await createAirlineMutation.mutateAsync({
                      code,
                      name: input.airlineName,
                    });
                  }
                  const created = await createFlightMutation.mutateAsync({
                    airlineId: airline.id,
                    flightNo,
                    depTime: input.depTime ?? '',
                  });
                  setValue('airlineId', airline.id, { shouldValidate: true, shouldDirty: true });
                  setValue('flightNo', created.flightNo, { shouldValidate: true, shouldDirty: true });
                  setValue('depTime', created.depTime, { shouldValidate: true, shouldDirty: true });
                  return { id: created.id, name: displayFlight(airline.code, created.flightNo) };
                }}`
);

fs.writeFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', shipmentForm);

console.log('Updated ShipmentForm.tsx');
