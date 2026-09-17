const db = require('../config/database');

async function run() {
  console.log('Running standalone database seeder...');
  await db.initDb();
  console.log('Seeder completed successfully.');
  process.exit(0);
}

run().catch(err => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
