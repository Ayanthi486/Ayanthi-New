const fs = require('fs');

let file = fs.readFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', 'utf8');

file = file.replace(
  `              createFields={[
                // key 'name' (not 'flightNo') deliberately — it's what plugs
                // this field into the dialog's existing
                // prefill-from-search-query and duplicate-detection behaviour.
                {
                  key: 'name',
                  label: 'Flight Number',
                  required: true,
                  placeholder: 'EK 0654',
                  transform: formatFlightNumber,
                },
                { key: 'depTime', label: 'Departure Time', required: true, type: 'time' },
              ]}
              onCreate={async (input) => {
                setFlightCreateError(undefined);
                const { code, flightNo } = splitFlightNumber(input.name ?? '');
                let airline = airlinesQuery.data?.find((a) => a.code === code);
                if (!airline) {
                  try {
                    airline = await createAirlineMutation.mutateAsync({ code, name: \`\${code} (Auto-created)\` });
                  } catch (err) {
                    setFlightCreateError(\`Failed to auto-create airline "\${code}".\`);
                    throw err;
                  }
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
              }}`,
  `              createFields={[
                {
                  key: 'airlineId',
                  label: 'Airline',
                  required: true,
                  type: 'select',
                  options: airlinesQuery.data?.map(a => ({ value: a.id, label: \`\${a.code} — \${a.name}\` })) ?? [],
                  value: currentAirlineId || undefined,
                  readOnly: Boolean(currentAirlineId),
                },
                {
                  key: 'flightNo',
                  label: 'Flight Number',
                  required: true,
                  placeholder: 'e.g. 0654',
                  maxLength: 4,
                  transform: (v) => v.replace(/\\D/g, '').slice(0, 4),
                },
                { key: 'depTime', label: 'Departure Time', required: true, type: 'time' },
              ]}
              onCreate={async (input) => {
                setFlightCreateError(undefined);
                const airlineId = input.airlineId;
                const flightNo = input.flightNo;
                if (!airlineId) throw new Error("Airline is required");
                if (!flightNo) throw new Error("Flight number is required");
                
                const airline = airlinesQuery.data?.find((a) => a.id === airlineId);
                if (!airline) throw new Error("Selected airline not found");
                
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

fs.writeFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', file);
