const fs = require('fs');
let file = fs.readFileSync('apps/api/src/shipment/shipment.service.ts', 'utf8');

file = file.replace(
  `  private async autoLearnMawbPrefix(tx: any, mawbNo: string | null | undefined, airlineId: string | null | undefined) {`,
  `  private async assertUniqueCusdec(tx: any, cusdecNo: string | null | undefined, excludeId?: string) {
    if (!cusdecNo) return;
    const existing = await tx.shipment.findFirst({
      where: {
        cusdecNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictError(\`CusDec Number "\${cusdecNo}" is already used by Shipment \${existing.shipmentNo}.\`);
    }
  }

  private async autoLearnMawbPrefix(tx: any, mawbNo: string | null | undefined, airlineId: string | null | undefined) {`
);

// Call in create
file = file.replace(
  `        await this.autoLearnMawbPrefix(tx, input.mawbNo, input.airlineId);
        
        await this.assertActiveReferences(tx, {`,
  `        await this.autoLearnMawbPrefix(tx, input.mawbNo, input.airlineId);
        await this.assertUniqueCusdec(tx, input.cusdecNo);
        
        await this.assertActiveReferences(tx, {`
);

// Call in update
file = file.replace(
  `        const { version, ...changes } = input;
        await this.autoLearnMawbPrefix(tx, changes.mawbNo ?? existing.mawbNo, changes.airlineId ?? existing.airlineId);

        await this.assertActiveReferences(tx, {`,
  `        const { version, ...changes } = input;
        await this.autoLearnMawbPrefix(tx, changes.mawbNo ?? existing.mawbNo, changes.airlineId ?? existing.airlineId);
        await this.assertUniqueCusdec(tx, changes.cusdecNo, existing.id);

        await this.assertActiveReferences(tx, {`
);

fs.writeFileSync('apps/api/src/shipment/shipment.service.ts', file);
