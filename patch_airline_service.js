const fs = require('fs');

let util = fs.readFileSync('apps/api/src/masterdata/masterdata.util.ts', 'utf8');
util = util.replace(
  `  name: r.name,`,
  `  name: r.name,
  awbPrefix: r.awbPrefix,`
);
fs.writeFileSync('apps/api/src/masterdata/masterdata.util.ts', util);

let svc = fs.readFileSync('apps/api/src/masterdata/airlines.service.ts', 'utf8');
svc = svc.replace(
  `            code: input.code,
            name: input.name,`,
  `            code: input.code,
            name: input.name,
            awbPrefix: input.awbPrefix ?? null,`
);
svc = svc.replace(
  `          data: { name: input.name, code: input.code },`,
  `          data: { name: input.name, code: input.code, awbPrefix: input.awbPrefix ?? null },`
);
fs.writeFileSync('apps/api/src/masterdata/airlines.service.ts', svc);
