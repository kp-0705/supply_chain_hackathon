const app = require('./app');
const env = require('./config/env');
const db = require('./config/database');
const AllocationService = require('./services/allocationService');

async function startServer() {
  try {
    // 1. Initialize Database Schema & Seed Data
    await db.initDb();

    // 2. Start Express Server
    const server = app.listen(env.PORT, () => {
      console.log('====================================================');
      console.log(`🚀 MICRON SUPPLY CHAIN SERVER ACTIVE`);
      console.log(`📡 URL: http://localhost:${env.PORT}`);
      console.log(`🌍 Environment: ${env.NODE_ENV}`);
      console.log(`🔐 Database: ${db.getIsPostgres() ? 'PostgreSQL' : 'In-Memory State Engine'}`);
      console.log('====================================================');
    });

    // 3. Background Job: Auto-completion sweep for partial allocations
    // Runs periodically to fulfill PARTIALLY_ALLOCATED demands when inventory replenishes
    const SWEEP_INTERVAL_MS = 30000; // Every 30 seconds
    setInterval(async () => {
      try {
        const results = await AllocationService.triggerAutoCompletion();
        if (results.length > 0) {
          console.log(`[Auto-Completion Sweep]: Processed ${results.length} partial demands.`);
        }
      } catch (sweepErr) {
        // Silent catch for background worker
      }
    }, SWEEP_INTERVAL_MS);

    // Graceful Shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => process.exit(0));
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received. Shutting down gracefully...');
      server.close(() => process.exit(0));
    });

  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

startServer();
