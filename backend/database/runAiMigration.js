/**
 * AI Migration Runner
 * Applies the additive AI schema changes (ai_recommendation column + chatbot_messages table).
 * Safe to run multiple times — all statements are idempotent.
 *
 * Usage: node database/runAiMigration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'ai_migration.sql'), 'utf8');
  const client = await pool.connect();
  try {
    console.log('Running AI schema migration...');
    await client.query(sql);
    console.log('✅ AI migration applied successfully.');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
