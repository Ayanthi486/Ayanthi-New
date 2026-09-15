const fs = require('fs');

let file = fs.readFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', 'utf8');

file = file.replace(
  `              onChange={(id) => {
                setSelectedFlightId(id);
                if (id === '') {
                  setValue('airlineId', '', { shouldValidate: true, shouldDirty: true });
                  setValue('flightNo', '', { shouldValidate: true, shouldDirty: true });
                  setValue('depTime', '', { shouldValidate: true, shouldDirty: true });
                  return;
                }`,
  `              onChange={(id) => {
                setSelectedFlightId(id);
                if (id === '') {
                  // If they clear the flight, don't clear the airline if it's locked by MAWB No!
                  const mawbNo = getValues('mawbNo') || '';
                  const rawMawb = mawbNo.replace(/\\D/g, '');
                  let lockedAirlineId = '';
                  if (rawMawb.length >= 3) {
                    const prefix = rawMawb.slice(0, 3);
                    const airline = airlinesQuery.data?.find((a) => a.awbPrefix === prefix);
                    if (airline) lockedAirlineId = airline.id;
                  }
                  
                  setValue('airlineId', lockedAirlineId, { shouldValidate: true, shouldDirty: true });
                  setValue('flightNo', '', { shouldValidate: true, shouldDirty: true });
                  setValue('depTime', '', { shouldValidate: true, shouldDirty: true });
                  return;
                }`
);

fs.writeFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', file);
