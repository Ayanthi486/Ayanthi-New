const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/costsheet/components/CostSheetSection.tsx', 'utf8');

file = file.replace(
`const formatAmount = (val: string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '';
  const num = parseFloat(val.replace(/,/g, ''));
  if (isNaN(num)) return val;
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};`,
`const formatAmount = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '';
  const strVal = String(val);
  const num = parseFloat(strVal.replace(/,/g, ''));
  if (isNaN(num)) return strVal;
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};`
);

fs.writeFileSync('apps/web/src/features/costsheet/components/CostSheetSection.tsx', file);
