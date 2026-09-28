import mongoose from 'mongoose';

let connectionPromise;

export async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error('MONGODB_URI is not configured.');
  }

  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    }).catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }

  return connectionPromise;
}

export async function disconnectDatabase() {
  connectionPromise = undefined;
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
