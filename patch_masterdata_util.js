const fs = require('fs');

let file = fs.readFileSync('apps/api/src/masterdata/masterdata.util.ts', 'utf8');

file = file.replace(
  `export function toAirline(row: NameActiveRow & { code: string }): Airline {
  return {
    id: row.id,
    code: row.code,
    name: row.name,`,
  `export function toAirline(row: NameActiveRow & { code: string; awbPrefix: string | null }): Airline {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    awbPrefix: row.awbPrefix,`
);

fs.writeFileSync('apps/api/src/masterdata/masterdata.util.ts', file);
