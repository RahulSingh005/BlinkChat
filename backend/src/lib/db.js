import mongoose from "mongoose";

mongoose.set("strictQuery", true);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Connects to MongoDB, retrying with backoff. Previously a failed connection
 * was only logged, leaving the server "up" but every request hanging until
 * mongoose's buffer timed out. Now startup fails loudly after the retries so
 * the host (Render, Railway, Docker...) can restart the process.
 */
export const connectDB = async (uri = process.env.MONGODB_URI, { retries = 5 } = {}) => {
  let attempt = 0;
  for (;;) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 20,
      });
      console.log(`[db] MongoDB connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      attempt += 1;
      console.error(`[db] MongoDB connection failed (attempt ${attempt}/${retries + 1}): ${error.message}`);
      if (attempt > retries) throw error;
      await sleep(Math.min(1000 * 2 ** attempt, 15000));
    }
  }
};

export const disconnectDB = () => mongoose.disconnect();
