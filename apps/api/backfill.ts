import { Pool } from 'pg';

const pool = new Pool({
  user: 'hublanka',
  host: 'localhost',
  database: 'hublanka_dev',
  password: 'hublanka_dev_password',
  port: 5433,
});

async function main() {
  const res = await pool.query(`
    SELECT s."mawbNo", a.id as "airlineId", a.code
    FROM shipment s
    JOIN airline a ON s."airlineId" = a.id
    WHERE s."mawbNo" IS NOT NULL AND a."awbPrefix" IS NULL
  `);

  const rows = res.rows;
  const updates: Record<string, string> = {};
  for (const row of rows) {
    const raw = row.mawbNo.replace(/\D/g, '');
    if (raw.length >= 3) {
      const prefix = raw.slice(0, 3);
      if (!updates[row.airlineId]) {
        updates[row.airlineId] = prefix;
        console.log(`Will update ${row.code} with prefix ${prefix}`);
      }
    }
  }

  for (const [airlineId, prefix] of Object.entries(updates)) {
    await pool.query(`UPDATE airline SET "awbPrefix" = $1 WHERE id = $2`, [prefix, airlineId]);
  }
  
  console.log('Backfill complete!');
}

main().catch(console.error).finally(() => pool.end());
