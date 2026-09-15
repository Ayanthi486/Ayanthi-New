const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/costsheet/components/CostSheetSection.tsx', 'utf8');

// Add imports
file = file.replace(
  `import { escapeHtml } from '@/lib/utils';`,
  `import { escapeHtml } from '@/lib/utils';
import { useAuthStore } from '@/lib/authStore';
import { downloadSignature } from '@/features/profile/api/profileApi';
import { useEffect } from 'react';`
);

// Update printCostSheet signature
file = file.replace(
  `function printCostSheet(costSheet: CostSheet, shipment: Shipment): void {`,
  `function printCostSheet(costSheet: CostSheet, shipment: Shipment, signatureBase64: string | null): void {`
);

// Add signature block
const signatureHtml = `
        <table style="width: 100%; border: none; margin-top: 30px;">
          <tr>
            <td style="border: none; padding: 4px; text-align: left; width: 33%; vertical-align: bottom;">
              <div style="height: 50px; margin-bottom: 5px;">
                \${signatureBase64 ? \`<img src="\${signatureBase64}" style="max-height: 50px; mix-blend-mode: multiply;" alt="Signature" />\` : ''}
              </div>
              <div style="border-top: 1px solid #000; width: 80%; padding-top: 2px;">Prepared By</div>
            </td>
            <td style="border: none; padding: 4px; text-align: left; width: 33%; vertical-align: bottom;">
              <div style="height: 50px; margin-bottom: 5px;"></div>
              <div style="border-top: 1px solid #000; width: 80%; padding-top: 2px;">Checked By</div>
            </td>
            <td style="border: none; padding: 4px; text-align: left; width: 33%; vertical-align: bottom;">
              <div style="height: 50px; margin-bottom: 5px;"></div>
              <div style="border-top: 1px solid #000; width: 80%; padding-top: 2px;">Approved By</div>
            </td>
          </tr>
        </table>
`;

file = file.replace(
  `        </table>
      </body>`,
  `        </table>
` + signatureHtml + `      </body>`
);

// Add state in CostSheetSection
file = file.replace(
  `  const [confirmingCreate, setConfirmingCreate] = useState(false);`,
  `  const [confirmingCreate, setConfirmingCreate] = useState(false);
  const user = useAuthStore((state) => state.user);
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (user?.hasSignature) {
      downloadSignature()
        .then((blob) => {
          if (!active) return;
          const reader = new FileReader();
          reader.onloadend = () => {
            if (active) setSignatureBase64(reader.result as string);
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => {});
    } else {
      setSignatureBase64(null);
    }
    return () => { active = false; };
  }, [user?.hasSignature]);`
);

// Update calls to printCostSheet
file = file.replace(
  /onClick=\{\(\) => printCostSheet\(costSheetQuery\.data!, shipmentQuery\.data!\)\}/g,
  `onClick={() => printCostSheet(costSheetQuery.data!, shipmentQuery.data!, signatureBase64)}`
);

fs.writeFileSync('apps/web/src/features/costsheet/components/CostSheetSection.tsx', file);
