import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const envFilePath = fileURLToPath(new URL('../../.env', import.meta.url));
dotenv.config({ path: envFilePath });

const rawCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const parsedCorsOrigin = rawCorsOrigin.includes(',')
  ? rawCorsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean)
  : rawCorsOrigin.trim();

export const config = {
  port: Number(process.env.PORT || 5001),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/roots_ems',
  corsOrigin: parsedCorsOrigin,
  appTimezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  nodeEnv: process.env.NODE_ENV || 'development',
};

export default config;
