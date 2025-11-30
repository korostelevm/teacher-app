import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGO_URL || 
  `mongodb://${process.env.MONGOUSER}:${process.env.MONGOPASSWORD}@${process.env.MONGOHOST}:${process.env.MONGOPORT}/rag-takehome`;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGO_URL or MONGOUSER/MONGOPASSWORD/MONGOHOST/MONGOPORT environment variables inside .env.local");
}

interface Cached {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

let cached: Cached = (global as any).mongoose || { conn: null, promise: null };

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      authSource: "admin",
      retryWrites: true,
      w: "majority",
    };

    cached.promise = mongoose
      .connect(MONGODB_URI!, opts)
      .then((mongoose) => {
        console.log("[Mongoose] Connected to MongoDB");
        return mongoose;
      })
      .catch((error) => {
        console.error("[Mongoose] Connection error:", error);
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// Alias for compatibility
export const connectToDatabase = connectDB;

// Get MongoDB URI for use in session store
export function getMongoUri(): string {
  return MONGODB_URI!;
}
