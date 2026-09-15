const fs = require('fs');

let file = fs.readFileSync('apps/api/src/shipment/shipment.service.ts', 'utf8');

// Add auto-learning utility right above `create`
file = file.replace(
  `  async create(input: CreateShipmentRequest, actor: RequestUser): Promise<Shipment> {`,
  `  private async autoLearnMawbPrefix(tx: any, mawbNo: string | null | undefined, airlineId: string | null | undefined) {
    if (mawbNo && airlineId) {
      const raw = mawbNo.replace(/\\D/g, '');
      if (raw.length >= 3) {
        const prefix = raw.slice(0, 3);
        const airline = await tx.airline.findUnique({ where: { id: airlineId } });
        if (airline && !airline.awbPrefix) {
          await tx.airline.update({
            where: { id: airline.id },
            data: { awbPrefix: prefix },
          });
        }
      }
    }
  }

  async create(input: CreateShipmentRequest, actor: RequestUser): Promise<Shipment> {`
);

// Call in `create`
file = file.replace(
  `        await this.assertActiveReferences(tx, {`,
  `        await this.autoLearnMawbPrefix(tx, input.mawbNo, input.airlineId);
        
        await this.assertActiveReferences(tx, {`
);

// Call in `update`
file = file.replace(
  `        const { version, ...changes } = input;
        await this.assertActiveReferences(tx, {`,
  `        const { version, ...changes } = input;
        await this.autoLearnMawbPrefix(tx, changes.mawbNo ?? existing.mawbNo, changes.airlineId ?? existing.airlineId);

        await this.assertActiveReferences(tx, {`
);

fs.writeFileSync('apps/api/src/shipment/shipment.service.ts', file);
