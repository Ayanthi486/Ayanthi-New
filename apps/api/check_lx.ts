import { Pool } from 'pg';

const pool = new Pool({
  user: 'hublanka',
  host: 'localhost',
  database: 'hublanka_dev',
  password: 'hublanka_dev_password',
  port: 5433,
});

async function main() {
  const res = await pool.query(`SELECT * FROM airline WHERE code = 'LX'`);
  console.log('LX:', res.rows);
}

main().catch(console.error).finally(() => pool.end());
