const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://hublanka:hublanka_dev_password@localhost:5433/hublanka_dev?schema=public',
  });
  await client.connect();
  
  try {
    await client.query('ALTER TABLE "airline" ADD COLUMN "awbPrefix" text;');
    console.log('Column added successfully');
  } catch (e) {
    if (e.code === '42701') {
      console.log('Column already exists');
    } else {
      console.error(e);
    }
  }
  
  await client.end();
}
main();
