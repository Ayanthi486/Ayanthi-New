const fs = require('fs');

let file = fs.readFileSync('apps/web/src/features/masterdata/pages/AirlinesPage.tsx', 'utf8');

file = file.replace(
  `const columns: ColumnDef<Airline, unknown>[] = [
  { header: 'Code', accessorKey: 'code' },
  { header: 'Name', accessorKey: 'name' },
];`,
  `const columns: ColumnDef<Airline, unknown>[] = [
  { header: 'Code', accessorKey: 'code' },
  { header: 'Name', accessorKey: 'name' },
  { header: 'MAWB Prefix', accessorKey: 'awbPrefix' },
];`
);

file = file.replace(
  `            <div className="flex flex-col gap-1.5">
              <Label htmlFor="airline-name">Name</Label>
              <Input id="airline-name" placeholder="e.g. Emirates" {...register('name')} />
            </div>
          </>`,
  `            <div className="flex flex-col gap-1.5">
              <Label htmlFor="airline-name">Name</Label>
              <Input id="airline-name" placeholder="e.g. Emirates" {...register('name')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="airline-prefix">MAWB Prefix</Label>
              <Input
                id="airline-prefix"
                placeholder="e.g. 176"
                maxLength={3}
                {...register('awbPrefix')}
              />
            </div>
          </>`
);

fs.writeFileSync('apps/web/src/features/masterdata/pages/AirlinesPage.tsx', file);
