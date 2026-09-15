const fs = require('fs');
let file = fs.readFileSync('apps/web/src/components/shared/MasterDataCombobox.tsx', 'utf8');

file = file.replace(
  `  type?: 'text' | 'time' | 'textarea';`,
  `  type?: 'text' | 'time' | 'textarea' | 'select';
  options?: { value: string; label: string }[];`
);

file = file.replace(
  `                {field.type === 'textarea' ? (`,
  `                {field.type === 'select' ? (
                  <select
                    id={\`create-\${field.key}\`}
                    disabled={field.readOnly}
                    className={cn(
                      'border-input h-9 rounded-md border bg-transparent px-3 text-sm',
                      field.readOnly && 'bg-muted text-muted-foreground'
                    )}
                    value={values[field.key] ?? ''}
                    onChange={(e) => {
                      if (field.readOnly) return;
                      const value = field.transform ? field.transform(e.target.value) : e.target.value;
                      setValues((prev) => ({ ...prev, [field.key]: value }));
                    }}
                  >
                    <option value="">Select...</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (`
);

// We need to parse query dynamically for initial values, or just let the user fill it.
// If the user wants the dropdown to default to the airline, they will pass it via `value: currentAirlineId` in the createFields config.
// Wait, createFields is evaluated on every render in ShipmentForm, so `value` can be passed!

fs.writeFileSync('apps/web/src/components/shared/MasterDataCombobox.tsx', file);
