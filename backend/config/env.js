const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

module.exports = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/micron_supply',
  JWT_SECRET: process.env.JWT_SECRET || 'micron_supply_chain_jwt_secret_key_2026_x89f7',
  NODE_ENV: process.env.NODE_ENV || 'development'
};
