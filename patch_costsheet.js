const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/costsheet/components/CostSheetSection.tsx', 'utf8');

file = file.replace(
  `onChange={(e) => setLineAmounts((prev) => ({ ...prev, [type]: e.target.value }))}`,
  `onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                  setLineAmounts((prev) => ({ ...prev, [type]: cleaned }));
                }}`
);
fs.writeFileSync('apps/web/src/features/costsheet/components/CostSheetSection.tsx', file);
