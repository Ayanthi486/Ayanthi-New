const fs = require('fs');

let file = fs.readFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', 'utf8');

file = file.replace(
  `                {
                  key: 'flightNo',
                  label: 'Flight Number',
                  required: true,
                  placeholder: 'e.g. 0654',
                  maxLength: 4,
                  transform: (v) => v.replace(/\\D/g, '').slice(0, 4),
                },`,
  `                {
                  key: 'name',
                  label: 'Flight Number',
                  required: true,
                  placeholder: 'e.g. 0654',
                  maxLength: 4,
                  transform: (v) => v.replace(/\\D/g, '').slice(0, 4),
                },`
);

file = file.replace(
  `                const airlineId = input.airlineId;
                const flightNo = input.flightNo;
                if (!airlineId) throw new Error("Airline is required");
                if (!flightNo) throw new Error("Flight number is required");`,
  `                const airlineId = input.airlineId;
                const flightNo = input.name;
                if (!airlineId) throw new Error("Airline is required");
                if (!flightNo) throw new Error("Flight number is required");`
);

fs.writeFileSync('apps/web/src/features/shipments/components/ShipmentForm.tsx', file);
