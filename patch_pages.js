const fs = require('fs');

// CommoditiesPage.tsx
let commFile = fs.readFileSync('apps/web/src/features/masterdata/pages/CommoditiesPage.tsx', 'utf8');
commFile = commFile.replace(
  `  useCreateCommodity,\n  useDeactivateCommodity,`,
  `  useCreateCommodity,
  useDeactivateCommodity,
  useUpdateCommodity,`
);
commFile = commFile.replace(
  `useDeactivate={useDeactivateCommodity}`,
  `useDeactivate={useDeactivateCommodity}\n      useUpdate={useUpdateCommodity}`
);
fs.writeFileSync('apps/web/src/features/masterdata/pages/CommoditiesPage.tsx', commFile);

// AirportsPage.tsx
let portFile = fs.readFileSync('apps/web/src/features/masterdata/pages/AirportsPage.tsx', 'utf8');
portFile = portFile.replace(
  `  useCreateAirport,\n  useDeactivateAirport,`,
  `  useCreateAirport,
  useDeactivateAirport,
  useUpdateAirport,`
);
portFile = portFile.replace(
  `useDeactivate={useDeactivateAirport}`,
  `useDeactivate={useDeactivateAirport}\n      useUpdate={useUpdateAirport}`
);
fs.writeFileSync('apps/web/src/features/masterdata/pages/AirportsPage.tsx', portFile);

// FlightsPage.tsx
let flightFile = fs.readFileSync('apps/web/src/features/masterdata/pages/FlightsPage.tsx', 'utf8');
flightFile = flightFile.replace(
  `  useCreateFlight,\n  useDeactivateFlight,`,
  `  useCreateFlight,
  useDeactivateFlight,
  useUpdateFlight,`
);
flightFile = flightFile.replace(
  `useDeactivate={useDeactivateFlight}`,
  `useDeactivate={useDeactivateFlight}\n      useUpdate={useUpdateFlight}`
);
fs.writeFileSync('apps/web/src/features/masterdata/pages/FlightsPage.tsx', flightFile);
