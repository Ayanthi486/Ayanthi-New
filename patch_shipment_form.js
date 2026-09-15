const fs = require('fs');

let file = fs.readFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', 'utf8');

file = file.replace(
  `  const mawbNoField = register('mawbNo');

  const submit = handleSubmit((values) => {`,
  `  const mawbNoField = register('mawbNo');

  const currentAirlineId = watch('airlineId');

  const handleMawbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatMawbNo(e.target.value);
    e.target.value = formatted;
    void mawbNoField.onChange(e);

    const raw = formatted.replace(/\\D/g, '');
    if (raw.length >= 3) {
      const prefix = raw.slice(0, 3);
      const airline = airlinesQuery.data?.find((a) => a.awbPrefix === prefix);
      if (airline) {
        if (getValues('airlineId') !== airline.id) {
          setValue('airlineId', airline.id, { shouldValidate: true, shouldDirty: true });
          if (!isEdit) {
            setSelectedFlightId('');
            setValue('flightNo', '', { shouldValidate: true, shouldDirty: true });
            setValue('depTime', '', { shouldValidate: true, shouldDirty: true });
          }
        }
      }
    }
  };

  const submit = handleSubmit((values) => {`
);

// In edit mode
file = file.replace(
  `            <Input
              id="mawbNo"
              {...mawbNoField}
              inputMode="numeric"
              maxLength={13}
              placeholder="123 4567 8912"
              onChange={(e) => {
                e.target.value = formatMawbNo(e.target.value);
                void mawbNoField.onChange(e);
              }}
            />`,
  `            <Input
              id="mawbNo"
              {...mawbNoField}
              inputMode="numeric"
              maxLength={13}
              placeholder="123 4567 8912"
              onChange={handleMawbChange}
            />`
);

// In create mode
file = file.replace(
  `            <Input
              id="mawbNo"
              {...mawbNoField}
              inputMode="numeric"
              maxLength={13}
              placeholder="123 4567 8912"
              onChange={(e) => {
                e.target.value = formatMawbNo(e.target.value);
                void mawbNoField.onChange(e);
              }}
            />`,
  `            <Input
              id="mawbNo"
              {...mawbNoField}
              inputMode="numeric"
              maxLength={13}
              placeholder="123 4567 8912"
              onChange={handleMawbChange}
            />`
);

// Filter flight options in Create mode
file = file.replace(
  `              options={
                flightsQuery.data?.map((flight) => {
                  const airline = airlinesQuery.data?.find((a) => a.id === flight.airlineId);
                  return {
                    id: flight.id,
                    name: airline ? displayFlight(airline.code, flight.flightNo) : flight.flightNo,
                  };
                }) ?? []
              }`,
  `              options={
                flightsQuery.data
                  ?.filter((flight) => (currentAirlineId ? flight.airlineId === currentAirlineId : true))
                  .map((flight) => {
                    const airline = airlinesQuery.data?.find((a) => a.id === flight.airlineId);
                    return {
                      id: flight.id,
                      name: airline ? displayFlight(airline.code, flight.flightNo) : flight.flightNo,
                    };
                  }) ?? []
              }`
);

fs.writeFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', file);
