const dotenv = require('dotenv');
const path = require('path');

const fs = require('fs');

const envPath = path.join(__dirname, '../.env');
const examplePath = path.join(__dirname, '../.env.example');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
if (fs.existsSync(examplePath)) {
  dotenv.config({ path: examplePath, override: false });
}

module.exports = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/micron_supply',
  JWT_SECRET: process.env.JWT_SECRET || 'micron_supply_chain_jwt_secret_key_2026_x89f7',
  NODE_ENV: process.env.NODE_ENV || 'development',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY
};
