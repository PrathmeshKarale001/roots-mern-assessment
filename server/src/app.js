import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import ApiError from './utils/ApiError.js';
import errorHandler from './middleware/errorHandler.js';
import employeeRoutes from './routes/employee.routes.js';
import taskRoutes from './routes/task.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

export const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: config.corsOrigin,
    exposedHeaders: ['Content-Disposition'],
  })
);

app.use(
  morgan(config.nodeEnv === 'production' ? 'tiny' : 'dev', {
    skip: () => process.env.NODE_ENV === 'test',
  })
);

app.use(express.json({ limit: '1mb' }));

app.get(['/', '/api'], (_req, res) => {
  res.status(200).json({
    success: true,
    name: 'Roots EMS API',
    message: 'Roots Employee & Task Management System API is live and operational',
    version: '1.0.0',
    documentation: 'https://github.com/PrathmeshKarale001/roots-mern-assessment#readme',
    endpoints: {
      health: '/api/health',
      dashboard: '/api/dashboard',
      employees: '/api/employees',
      tasks: '/api/tasks',
      csvExport: '/api/tasks/export.csv',
      metadata: '/api/meta',
    },
    clientApp: config.corsOrigin,
  });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', async (_req, _res, next) => {
  if (mongoose.connection.readyState !== 1 && process.env.NODE_ENV !== 'test') {
    await connectDB();
  }
  next();
});

app.use('/api', dashboardRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/tasks', taskRoutes);

app.use((_req, _res, next) => {
  next(ApiError.notFound('Route not found'));
});

app.use(errorHandler);

export default app;
