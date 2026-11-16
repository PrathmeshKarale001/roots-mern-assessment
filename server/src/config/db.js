import mongoose from 'mongoose';
import { config } from './env.js';

mongoose.set('bufferCommands', false);

if (!globalThis.mongooseConn) {
  globalThis.mongooseConn = {
    conn: null,
    promise: null,
  };
}

export async function connectDB(uri = config.mongoUri) {
  if (mongoose.connection.readyState === 1) {
    globalThis.mongooseConn.conn = mongoose.connection;
    return mongoose.connection;
  }

  if (globalThis.mongooseConn.promise) {
    globalThis.mongooseConn.conn = await globalThis.mongooseConn.promise;
    return globalThis.mongooseConn.conn;
  }

  globalThis.mongooseConn.promise = mongoose
    .connect(uri, {
      bufferCommands: false,
    })
    .then((mongooseInstance) => mongooseInstance.connection)
    .catch((err) => {
      globalThis.mongooseConn.promise = null;
      throw err;
    });

  globalThis.mongooseConn.conn = await globalThis.mongooseConn.promise;
  return globalThis.mongooseConn.conn;
}

export async function disconnectDB() {
  globalThis.mongooseConn = { conn: null, promise: null };
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export default connectDB;
