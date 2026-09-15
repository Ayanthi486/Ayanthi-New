const fs = require('fs');
let file = fs.readFileSync('apps/api/src/cargo/cargo.service.ts', 'utf8');

file = file.replace(
  `        if (existing.status !== 'PENDING') {
          throw new BusinessRuleError(
            'Box and weight can only be entered while a shipment is Pending',
          );
        }`,
  `        if (!['PENDING', 'CONFIRMED', 'CANCELLED'].includes(existing.status)) {
          throw new BusinessRuleError(
            'Box and weight can only be entered while a shipment is Pending, Confirmed, or Cancelled',
          );
        }`
);

fs.writeFileSync('apps/api/src/cargo/cargo.service.ts', file);
