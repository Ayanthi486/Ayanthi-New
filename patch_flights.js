const fs = require('fs');

let flightsPage = fs.readFileSync('apps/web/src/features/masterdata/pages/FlightsPage.tsx', 'utf8');

flightsPage = flightsPage.replace(
  /const createFlightFormSchema = z\.object\(\{[\s\S]*?\}\);/,
  `const createFlightFormSchema = z.object({
  airlineId: z.string().min(1, 'Airline is required'),
  flightNo: z.string().trim().regex(/^\\d{4}$/, 'Expected 4 digits (e.g. 0654)'),
  depTime: z.string().regex(time24Pattern, 'Expected 24-hour time as HH:mm'),
});`
);

flightsPage = flightsPage.replace(
  /const flightNumberField = register\('flightNumber'\);\s*const onSubmit = handleSubmit\(async \(values\) => \{[\s\S]*?\}\);/,
  `const onSubmit = handleSubmit(async (values) => {
    try {
      await createFlightMutation.mutateAsync({ airlineId: values.airlineId, flightNo: values.flightNo, depTime: values.depTime });
      reset();
    } catch {
      // Surfaced below via createFlightMutation.isError.
    }
  });`
);

flightsPage = flightsPage.replace(
  /<div className="flex flex-col gap-1\.5">\s*<Label htmlFor="flight-number">Flight Number<\/Label>[\s\S]*?<\/div>/,
  `<div className="flex flex-col gap-1.5">
            <Label htmlFor="airlineId">Airline</Label>
            <select
              id="airlineId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...register('airlineId')}
            >
              <option value="">Select airline...</option>
              {airlinesQuery.data?.map(a => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
            {errors.airlineId && (
              <p className="text-destructive text-xs">{errors.airlineId.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flight-no">Flight Number</Label>
            <Input
              id="flight-no"
              placeholder="e.g. 0654"
              {...register('flightNo')}
              onChange={(e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                register('flightNo').onChange(e);
              }}
            />
            {errors.flightNo && (
              <p className="text-destructive text-xs">{errors.flightNo.message}</p>
            )}
          </div>`
);

fs.writeFileSync('apps/web/src/features/masterdata/pages/FlightsPage.tsx', flightsPage);

console.log('Updated FlightsPage.tsx');
