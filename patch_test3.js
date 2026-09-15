const fs = require('fs');
let file = fs.readFileSync('apps/web/src/features/shipments/components/ShipmentForm.test.tsx', 'utf8');

file = file.replace(
`      expect(
        await within(dialog).findByText('No airline found with code "ZZ". Add it in Master Data first.'),
      ).toBeInTheDocument();
      expect(createdPosts.some((p) => p.url.includes('/masterdata/flights'))).toBe(false);`,
`      await waitFor(() => {
        expect(createdPosts.some((p) => p.url.includes('/masterdata/airlines') && p.body?.code === 'ZZ')).toBe(true);
        expect(createdPosts.some((p) => p.url.includes('/masterdata/flights') && p.body?.flightNo === '1234')).toBe(true);
      });`
);

fs.writeFileSync('apps/web/src/features/shipments/components/ShipmentForm.test.tsx', file);
