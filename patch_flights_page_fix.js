const fs = require('fs');

let file = fs.readFileSync('apps/web/src/features/masterdata/pages/FlightsPage.tsx', 'utf8');

file = file.replace(
  `import { Select } from '@/components/ui/select';`,
  ``
);

file = file.replace(
  `            <Select id="flight-airline" {...register('airlineId')}>`,
  `            <select id="flight-airline" className="border-input h-9 rounded-md border bg-transparent px-3 text-sm" {...register('airlineId')}>`
);

file = file.replace(
  `            </Select>`,
  `            </select>`
);

fs.writeFileSync('apps/web/src/features/masterdata/pages/FlightsPage.tsx', file);
