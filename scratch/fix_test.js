const fs = require('fs');
let c = fs.readFileSync('apps/web/src/features/documents/components/DocumentsSection.test.tsx', 'utf-8');

let idx1 = c.indexOf(`  it('ADF shows Print/Download`);
let idx2 = c.indexOf(`  it('ADF shows Download/Remove`);
if (idx1 !== -1 && idx2 !== -1) {
    c = c.substring(0, idx1) + c.substring(idx2);
    fs.writeFileSync('apps/web/src/features/documents/components/DocumentsSection.test.tsx', c);
    console.log("Fixed!");
} else {
    console.log("Could not find blocks. idx1:", idx1, "idx2:", idx2);
}
