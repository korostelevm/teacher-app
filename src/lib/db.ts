import { connectDB } from "./mongodb";
import { ensureSystemUser } from "@/models/user";

// Initialize database connection on module load
let dbConnected = false;

export async function ensureDbConnection() {
  if (!dbConnected) {
    try {
      await connectDB();
      await ensureSystemUser();
      dbConnected = true;
    } catch (error) {
      console.error("Failed to connect to database:", error);
      throw error;
    }
  }
}

// Auto-connect on import
if (typeof window === "undefined") {
  ensureDbConnection().catch(console.error);
}

