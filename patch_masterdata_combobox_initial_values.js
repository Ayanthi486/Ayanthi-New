const fs = require('fs');

let file = fs.readFileSync('apps/web/src/components/shared/MasterDataCombobox.tsx', 'utf8');

file = file.replace(
  `      ...Object.fromEntries(
        fields.filter((f) => f.readOnly && f.value !== undefined).map((f) => [f.key, f.value as string]),
      ),`,
  `      ...Object.fromEntries(
        fields.filter((f) => f.value !== undefined).map((f) => [f.key, f.value as string]),
      ),`
);

fs.writeFileSync('apps/web/src/components/shared/MasterDataCombobox.tsx', file);
