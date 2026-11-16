import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';

async function startServer() {
  try {
    await connectDB();
    app.listen(config.port, () => {
      console.log(`Roots EMS Server running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start Roots EMS Server:', err.message);
    process.exit(1);
  }
}

startServer();
