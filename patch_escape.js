const fs = require('fs');
let file = fs.readFileSync('apps/web/src/lib/utils.ts', 'utf8');

file = file.replace(
`export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}`,
`export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}`
);

fs.writeFileSync('apps/web/src/lib/utils.ts', file);
