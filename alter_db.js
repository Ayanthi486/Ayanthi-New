const { Client } = require('./apps/api/node_modules/pg');
const client = new Client({
  connectionString: "postgresql://hublanka:hublanka_dev_password@localhost:5433/hublanka_dev?schema=public"
});

async function main() {
  try {
    await client.connect();
    await client.query('ALTER TABLE "user" ADD COLUMN "signatureStorageKey" text;');
    console.log("Column added");
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('Column already exists, ignoring.');
    } else {
      console.error(err);
    }
  } finally {
    await client.end();
  }
}
main();
