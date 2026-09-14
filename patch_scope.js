const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/costsheet/components/CostSheetSection.tsx', 'utf8');

file = file.replace(
`export function CostSheetSection({ shipmentId }: { shipmentId: string }) {
  const costSheetQuery = useCostSheet(shipmentId);
  const shipmentQuery = useShipment(shipmentId);
  const createMutation = useCreateCostSheet(shipmentId);`,
`export function CostSheetSection({ shipmentId }: { shipmentId: string }) {
  const costSheetQuery = useCostSheet(shipmentId);
  const createMutation = useCreateCostSheet(shipmentId);`
);

file = file.replace(
`function CostSheetDetail({ shipmentId, costSheet }: { shipmentId: string; costSheet: CostSheet }) {`,
`function CostSheetDetail({ shipmentId, costSheet }: { shipmentId: string; costSheet: CostSheet }) {
  const shipmentQuery = useShipment(shipmentId);`
);

fs.writeFileSync('apps/web/src/features/costsheet/components/CostSheetSection.tsx', file);
